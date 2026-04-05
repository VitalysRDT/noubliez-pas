/**
 * Mass import French songs from LRCLIB into the database.
 * Targets 1000+ songs by searching many French artists and keywords.
 *
 * Usage: npx tsx scripts/mass-import.ts
 */

import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, ilike, sql } from "drizzle-orm";
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

type LRC = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

async function search(params: string): Promise<LRC[]> {
  try {
    const r = await fetch(`${LRCLIB}/search?${params}`, {
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d : [];
  } catch { return []; }
}

async function getLyrics(artist: string, track: string): Promise<LRC | null> {
  try {
    const r = await fetch(
      `${LRCLIB}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`,
      { headers: { "User-Agent": UA } }
    );
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Known French artists — trust these, skip French detection
const KNOWN_FR = new Set(
  [
    "joe dassin","claude françois","michel sardou","jean-jacques goldman",
    "francis cabrel","edith piaf","jacques brel","charles aznavour",
    "georges brassens","serge gainsbourg","dalida","johnny hallyday",
    "sylvie vartan","france gall","michel berger","daniel balavoine",
    "alain bashung","alain souchon","laurent voulzy","michel polnareff",
    "nino ferrer","jean ferrat","eddy mitchell","jacques dutronc",
    "hugues aufray","christophe","mike brant","enrico macias",
    "gilbert bécaud","yves montand","mireille mathieu","lara fabian",
    "patricia kaas","florent pagny","patrick bruel","pascal obispo",
    "garou","céline dion","téléphone","indochine","noir désir",
    "louise attaque","mano negra","les rita mitsouko","niagara",
    "mylène farmer","vanessa paradis","etienne daho","marc lavoine",
    "zazie","calogero","raphaël","bénabar","vincent delerm",
    "benjamin biolay","thomas dutronc","christophe maé","m pokora",
    "-m-","superbus","dionysos","saez","tryo","renan luce",
    "stromae","angèle","zaz","vianney","louane","julien doré",
    "clara luciani","pomme","hoshi","suzane","eddy de pretto",
    "orelsan","grand corps malade","soprano","kendji girac",
    "amir","slimane","vitaa","maître gims","aya nakamura",
    "dadju","tayc","ninho","jul","pnl","nekfeu","lomepal",
    "sch","damso","niska","mhd","la fouine","booba","rohff",
    "sexion d'assaut","bigflo et oli","therapie taxi",
    "trois cafés gourmands","boulevard des airs","claudio capéo",
    "patrick fiori","lorie","jenifer","nolwenn leroy",
    "iam","ntm","mc solaar","oxmo puccino","fonky family",
    "113","sniper","kery james","youssoupha","diam's","alizée",
    "kids united","les enfoirés","matmatah","les ogres de barback",
    "zebda","christine and the queens","jain","videoclub",
    "keen'v","aldebert","cali","la grande sophie","l.e.j",
    "natasha st-pier","chimène badi","shy'm","tal",
    "patrick sébastien","claude nougaro","léo ferré",
    "renaud","francis lemarque","barbara","anne sylvestre",
    "maxime le forestier","pierre perret","yves duteil",
    "michel fugain","gérard lenorman","michel delpech",
    "hervé vilard","alain barrière","joe cocker","serge lama",
    "richard anthony","sheila","claude barzotti","frédéric françois",
    "david hallyday","patrick hernandez","desireless","images",
    "gold","cookie dingler","jean-pierre mader","partenaire particulier",
    "jeanne mas","elsa","jordy","hélène ségara","laam",
    "gaëtan roussel","olivia ruiz","camille","sanseverino",
    "emily loizeau","camelia jordana","coeur de pirate",
    "patrick watson","zaho","amel bent","shy'm","black m",
    "matt pokora","christophe willem","grégoire",
  ].map(s => s.toLowerCase())
);

function isKnownFrench(artist: string): boolean {
  return KNOWN_FR.has(artist.toLowerCase().trim());
}

// DB dedup cache (faster than querying each time)
const seenKeys = new Set<string>();

async function loadExistingKeys() {
  const rows = await db
    .select({ title: schema.songs.title, artist: schema.songs.artist })
    .from(schema.songs);
  for (const r of rows) {
    seenKeys.add(`${r.title.toLowerCase()}|||${r.artist.toLowerCase()}`);
  }
}

function isDuplicate(title: string, artist: string): boolean {
  return seenKeys.has(`${title.toLowerCase()}|||${artist.toLowerCase()}`);
}

function markSeen(title: string, artist: string) {
  seenKeys.add(`${title.toLowerCase()}|||${artist.toLowerCase()}`);
}

async function tryImport(r: LRC): Promise<boolean> {
  if (!r.trackName || !r.artistName) return false;
  if (isDuplicate(r.trackName, r.artistName)) return false;

  // Get full lyrics if search result didn't include them
  let lyrics = r.syncedLyrics || r.plainLyrics;
  if (!lyrics) {
    const full = await getLyrics(r.artistName, r.trackName);
    await wait(DELAY);
    if (!full) return false;
    lyrics = full.syncedLyrics || full.plainLyrics;
    if (!lyrics) return false;
    r.syncedLyrics = full.syncedLyrics;
    r.plainLyrics = full.plainLyrics;
  }

  // Must have enough content
  const lineCount = lyrics.split("\n").filter(l => l.trim().length > 0).length;
  if (lineCount < 4) return false;

  // Parse
  let parsedLyrics;
  let timestamps = null;
  if (r.syncedLyrics) {
    const p = parseLyricsFromLRC(r.syncedLyrics);
    parsedLyrics = p.lyrics;
    timestamps = p.timestamps;
  } else {
    parsedLyrics = parseLyricsFromText(r.plainLyrics!);
  }

  if (parsedLyrics.length < 4) return false;

  await db.insert(schema.songs).values({
    title: r.trackName,
    artist: r.artistName,
    genre: "variété",
    difficulty: 2,
    lyrics: parsedLyrics,
    lrcTimestamps: timestamps,
  });

  markSeen(r.trackName, r.artistName);
  return true;
}

// ── Artist list (expanded) ──
const ARTISTS = [
  "Joe Dassin","Claude François","Michel Sardou","Jean-Jacques Goldman",
  "Francis Cabrel","Edith Piaf","Jacques Brel","Charles Aznavour",
  "Georges Brassens","Serge Gainsbourg","Dalida","Johnny Hallyday",
  "Sylvie Vartan","France Gall","Michel Berger","Daniel Balavoine",
  "Alain Bashung","Alain Souchon","Laurent Voulzy","Michel Polnareff",
  "Nino Ferrer","Jean Ferrat","Eddy Mitchell","Jacques Dutronc",
  "Hugues Aufray","Christophe","Mike Brant","Enrico Macias",
  "Gilbert Bécaud","Yves Montand","Mireille Mathieu","Lara Fabian",
  "Patricia Kaas","Florent Pagny","Patrick Bruel","Pascal Obispo",
  "Garou","Céline Dion","Téléphone","Indochine","Noir Désir",
  "Louise Attaque","Les Rita Mitsouko","Niagara","Mylène Farmer",
  "Vanessa Paradis","Etienne Daho","Marc Lavoine","Zazie","Calogero",
  "Raphaël","Bénabar","Vincent Delerm","Benjamin Biolay",
  "Thomas Dutronc","Christophe Maé","-M-","Superbus",
  "Dionysos","Saez","Tryo","Renan Luce","Aldebert","Cali",
  "Stromae","Angèle","Zaz","Vianney","Louane","Julien Doré",
  "Clara Luciani","Pomme","Hoshi","Suzane","Eddy de Pretto",
  "Orelsan","Grand Corps Malade","Soprano","Kendji Girac",
  "Amir","Slimane","Vitaa","Maître Gims","Aya Nakamura",
  "Dadju","Tayc","Ninho","Jul","PNL","Nekfeu","Lomepal",
  "SCH","Damso","Niska","MHD","La Fouine","Booba","Rohff",
  "Sexion d'Assaut","BigFlo et Oli","Therapie Taxi",
  "Trois Cafés Gourmands","Boulevard des Airs","Claudio Capéo",
  "Patrick Fiori","Lorie","Jenifer","Nolwenn Leroy",
  "IAM","NTM","MC Solaar","Oxmo Puccino","Fonky Family",
  "Kery James","Youssoupha","Diam's","Alizée",
  "Kids United","Les Enfoirés","Matmatah","Zebda",
  "Christine and the Queens","Jain","Videoclub",
  "Keen'V","Shy'm","Tal","Black M","Christophe Willem","Grégoire",
  "Renaud","Claude Nougaro","Léo Ferré","Barbara","Anne Sylvestre",
  "Maxime Le Forestier","Pierre Perret","Yves Duteil",
  "Michel Fugain","Gérard Lenorman","Michel Delpech",
  "Serge Lama","Sheila","Patrick Sébastien",
  "Desireless","Images","Gold","Jeanne Mas","Elsa",
  "Hélène Ségara","Laam","Gaëtan Roussel","Olivia Ruiz","Camille",
  "Emily Loizeau","Camélia Jordana","Zaho","Amel Bent",
  "Matt Pokora","Natasha St-Pier","Chimène Badi",
  "La Grande Sophie","L.E.J","Sanseverino",
  "Patrick Hernandez","Cookie Dingler","Jean-Pierre Mader",
  "Partenaire Particulier","Hervé Vilard","Frédéric François",
  "Richard Anthony","Gérard De Palmas","Tina Arena",
  "Véronique Sanson","Françoise Hardy","Brigitte Bardot",
  "Jane Birkin","Michel Jonasz","William Sheller",
  "Bernard Lavilliers","Charlélie Couture","Alain Chamfort",
  "Jean-Louis Aubert","Louis Bertignac","Axel Bauer",
  "Catherine Lara","Enzo Enzo","Maurane","Liane Foly",
  "Véronique Rivière","Isabelle Boulay","Corneille",
  "Yannick Noah","Gérald De Palmas","Tété",
  "Ben l'Oncle Soul","Hindi Zahra","Zaz","Ayo",
  "Coeur de Pirate","Mika","La Femme","Juliette Armanet",
  "Fishbach","Aloïse Sauvage","Malik Djoudi",
  "Voyou","Flavien Berger","Lewis OfMan",
  "Terrenoire","Pierre de Maere","Santa","Naps",
  "Hatik","Wejdene","Imen Es","Soolking","L'Algérino",
  "Dj Snake","Kungs","Ofenbach","Petit Biscuit",
  "Madeon","Kavinsky","Justice","Breakbot",
];

async function main() {
  console.log("\n🎵 Mass Import — Objectif : 1000 chansons françaises\n");

  await loadExistingKeys();
  let total = seenKeys.size;
  let imported = 0;
  const TARGET = 1000;

  console.log(`📦 Déjà en base : ${total}\n`);

  // Phase 1: Search by each artist
  console.log("── Phase 1 : Recherche par artiste ──\n");
  for (const artist of ARTISTS) {
    if (total >= TARGET) break;

    const results = await search(`artist_name=${encodeURIComponent(artist)}`);
    await wait(DELAY);

    let batch = 0;
    // Try up to 30 results per artist (for prolific artists)
    for (const r of results.slice(0, 30)) {
      if (total >= TARGET) break;
      // Trust known French artists, skip language check
      if (!isKnownFrench(r.artistName)) continue;
      try {
        if (await tryImport(r)) { batch++; imported++; total++; }
      } catch { /* skip */ }
    }
    if (batch > 0) console.log(`  ${artist}: +${batch} (total: ${total})`);
    else process.stdout.write(`  ${artist}: 0\r`);
  }
  console.log(`\n  Phase 1 terminée: ${imported} importées, ${total} total\n`);

  // Phase 2: Broad search queries
  if (total < TARGET) {
    console.log("── Phase 2 : Recherche par mots-clés ──\n");
    const keywords = [
      "je t'aime","mon amour","chanson","soleil","paris","france",
      "vie","coeur","danse","nuit","été","rêve","enfant","femme",
      "maman","papa","liberté","voyage","mer","pluie","chanson française",
      "toujours","encore","jours","demain","bonheur","triste",
      "espoir","partir","reviens","oublier","souvenir","musique",
      "folie","belle","monde","temps","jour","étoile","lumière",
      "histoire","route","vent","feu","terre","ciel","fleur",
    ];
    for (const kw of keywords) {
      if (total >= TARGET) break;
      const results = await search(`q=${encodeURIComponent(kw)}`);
      await wait(DELAY);

      let batch = 0;
      for (const r of results.slice(0, 20)) {
        if (total >= TARGET) break;
        if (!isKnownFrench(r.artistName)) continue;
        try {
          if (await tryImport(r)) { batch++; imported++; total++; }
        } catch { /* skip */ }
      }
      if (batch > 0) console.log(`  "${kw}": +${batch} (total: ${total})`);
    }
    console.log(`\n  Phase 2 terminée: ${imported} importées, ${total} total\n`);
  }

  // Phase 3: Also accept non-known-French artists if lyrics look French
  if (total < TARGET) {
    console.log("── Phase 3 : Recherche élargie (détection FR) ──\n");
    const frWords = [
      " je "," tu "," les "," des "," dans "," pour "," avec ",
      " pas "," que "," qui "," est "," sont "," mais "," comme ",
      " mon "," ton "," son "," nous "," vous "," cette ",
    ];

    function looksLikeFrench(text: string): boolean {
      const lower = ` ${text.toLowerCase()} `;
      let hits = 0;
      for (const w of frWords) if (lower.includes(w)) hits++;
      return hits >= 4;
    }

    const broadQueries = [
      "amour chanson","vie belle","soleil brille","danse encore",
      "coeur battant","nuit étoilée","rêve bleu","liberté chérie",
      "voyage loin","mer bleue","paris lumière","je suis",
      "tu me manques","c'est la vie","comme toi","ensemble",
      "pour toujours","jamais sans toi","si tu savais",
      "allons danser","ce soir","demain matin","la vie est belle",
      "french pop","variété","chanson d'amour","ballade",
    ];

    for (const q of broadQueries) {
      if (total >= TARGET) break;
      const results = await search(`q=${encodeURIComponent(q)}`);
      await wait(DELAY);

      let batch = 0;
      for (const r of results.slice(0, 20)) {
        if (total >= TARGET) break;
        const text = r.syncedLyrics || r.plainLyrics || "";
        if (!isKnownFrench(r.artistName) && !looksLikeFrench(text)) continue;
        try {
          if (await tryImport(r)) { batch++; imported++; total++; }
        } catch { /* skip */ }
      }
      if (batch > 0) console.log(`  "${q}": +${batch} (total: ${total})`);
    }
  }

  console.log(`\n📊 Résultat final :`);
  console.log(`   ✅ ${imported} nouvelles chansons importées`);
  console.log(`   📦 ${total} chansons en base au total`);
  console.log(
    total >= TARGET
      ? `   🎯 Objectif ${TARGET} atteint !`
      : `   ⚠️  ${TARGET - total} manquantes — relancer ou ajouter des artistes`
  );
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
