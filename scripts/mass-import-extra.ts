/**
 * Extra round of imports to reach 1000 songs.
 * Uses more diverse search queries.
 *
 * Usage: npx tsx scripts/mass-import-extra.ts
 */

import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import {
  parseLyricsFromText,
  parseLyricsFromLRC,
} from "../src/lib/lyrics-processor";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

const LRCLIB = "https://lrclib.net/api";
const UA = "noubliez-pas/1.0";
const DELAY = 200;
const TARGET = 1000;

type LRC = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

async function search(q: string): Promise<LRC[]> {
  try {
    const r = await fetch(`${LRCLIB}/search?q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const FR_WORDS = [
  " je "," tu "," les "," des "," dans "," pour "," avec ",
  " pas "," que "," qui "," est "," sont "," mais "," comme ",
  " mon "," ton "," son "," nous "," vous "," cette ",
  " tout "," une "," sur "," plus "," quand "," encore ",
];

function looksLikeFrench(text: string): boolean {
  const lower = ` ${text.toLowerCase()} `;
  let hits = 0;
  for (const w of FR_WORDS) if (lower.includes(w)) hits++;
  return hits >= 3;
}

const seenKeys = new Set<string>();

async function loadExisting() {
  const rows = await db
    .select({ title: schema.songs.title, artist: schema.songs.artist })
    .from(schema.songs);
  for (const r of rows) {
    seenKeys.add(`${r.title.toLowerCase()}|||${r.artist.toLowerCase()}`);
  }
  return rows.length;
}

async function tryImport(r: LRC): Promise<boolean> {
  if (!r.trackName || !r.artistName) return false;
  const key = `${r.trackName.toLowerCase()}|||${r.artistName.toLowerCase()}`;
  if (seenKeys.has(key)) return false;

  const lyrics = r.syncedLyrics || r.plainLyrics;
  if (!lyrics) return false;
  if (!looksLikeFrench(lyrics)) return false;

  const lineCount = lyrics.split("\n").filter(l => l.trim().length > 0).length;
  if (lineCount < 4) return false;

  let parsed;
  let timestamps = null;
  if (r.syncedLyrics) {
    const p = parseLyricsFromLRC(r.syncedLyrics);
    parsed = p.lyrics;
    timestamps = p.timestamps;
  } else {
    parsed = parseLyricsFromText(r.plainLyrics!);
  }
  if (parsed.length < 4) return false;

  await db.insert(schema.songs).values({
    title: r.trackName,
    artist: r.artistName,
    genre: "variété",
    difficulty: 2,
    lyrics: parsed,
    lrcTimestamps: timestamps,
  });

  seenKeys.add(key);
  return true;
}

async function main() {
  let total = await loadExisting();
  let imported = 0;

  console.log(`\n🎵 Import complémentaire — ${total} en base, objectif ${TARGET}\n`);

  if (total >= TARGET) {
    console.log("✅ Objectif déjà atteint !");
    return;
  }

  // Massive variety of French search terms
  const queries = [
    // Feelings / themes
    "toi et moi","je t'aime","mon coeur","ma vie","notre histoire",
    "dis-moi","regarde-moi","prends-moi","embrasse-moi","pardonne-moi",
    "laisse-moi","attends-moi","rappelle-toi","souviens-toi",
    "je rêve","je danse","je chante","je pleure","je ris","je cours",
    "elle danse","elle chante","il pleut","il fait beau",
    "bonne nuit","bonsoir","bonjour","au revoir","à demain",
    // Places
    "paris","marseille","lyon","bordeaux","toulouse","montmartre",
    "seine","loire","provence","bretagne","côte d'azur",
    // Nature
    "soleil levant","clair de lune","arc en ciel","rose rouge",
    "océan","rivière","montagne","forêt","jardin","île",
    "printemps","automne","hiver","pluie d'été",
    // Life events
    "mariage","anniversaire","naissance","premier pas",
    "école","vacances","fête","carnaval","noël chanson",
    // Music styles
    "valse","tango","java","musette","accordéon",
    "guitare","piano","violon","harmonica",
    // Emotions
    "mélancolie","nostalgie","espérance","courage",
    "passion","tendresse","douceur","tristesse","joie",
    "bonheur","malheur","folie","sagesse",
    // Daily life
    "café","croissant","baguette","vin rouge",
    "dimanche","lundi matin","vendredi soir","week-end",
    "métro","bus","voiture","vélo","train",
    // Love
    "premier amour","dernier amour","grand amour",
    "coup de foudre","rendez-vous","lettre d'amour",
    "chanson douce","berceuse","comptine",
    // Pop culture
    "cinéma","théâtre","danse","cirque","fête foraine",
    "rock and roll","disco","funk","soul","reggae",
    "hip hop français","slam","spoken word",
    // Abstract
    "liberté égalité","fraternité","république",
    "révolution","résistance","paix","guerre",
    "avenir","passé","présent","destin","hasard",
    "rêve éveillé","conte de fées","il était une fois",
    // More specific
    "je ne regrette rien","comme d'habitude","la vie en rose",
    "champs elysees","tour eiffel","moulin rouge",
    "petit prince","belle et la bête","cendrillon",
    // Misc FR
    "allez","bravo","magnifique","formidable","incroyable",
    "c'est parti","on y va","viens avec moi","suis-moi",
    "ne pleure pas","ne pars pas","reste avec moi",
    "donne-moi ta main","ferme les yeux","ouvre ton coeur",
  ];

  for (const q of queries) {
    if (total >= TARGET) break;

    const results = await search(q);
    await wait(DELAY);

    let batch = 0;
    for (const r of results.slice(0, 20)) {
      if (total >= TARGET) break;
      try {
        if (await tryImport(r)) { batch++; imported++; total++; }
      } catch { /* skip */ }
    }
    if (batch > 0) console.log(`  "${q}": +${batch} (total: ${total})`);
  }

  console.log(`\n📊 Résultat :`);
  console.log(`   ✅ ${imported} nouvelles chansons`);
  console.log(`   📦 ${total} total en base`);
  console.log(
    total >= TARGET
      ? `   🎯 Objectif atteint !`
      : `   ⚠️  ${TARGET - total} manquantes`
  );
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
