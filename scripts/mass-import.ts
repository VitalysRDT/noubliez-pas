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
import { and, ilike } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import {
  parseLyricsFromText,
  parseLyricsFromLRC,
} from "../src/lib/lyrics-processor";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const LRCLIB_BASE = "https://lrclib.net/api";
const USER_AGENT = "noubliez-pas/1.0";
const DELAY_MS = 250;

type LRCResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

async function fetchLRC(url: string): Promise<LRCResult[]> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [data];
  } catch {
    return [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isFrench(text: string): boolean {
  const frenchWords = [
    " je ", " tu ", " il ", " elle ", " nous ", " vous ", " les ", " des ",
    " une ", " dans ", " pour ", " avec ", " sur ", " pas ", " que ", " qui ",
    " est ", " sont ", " mais ", " comme ", " tout ", " mon ", " ton ",
    " son ", " notre ", " votre ", " leur ", " cette ", " ces ",
    " quand ", " même ", " encore ", " toujours ", " jamais ",
    " amour ", " coeur ", " vie ", " monde ", " temps ", " jour ", " nuit ",
  ];
  const lower = ` ${text.toLowerCase()} `;
  let hits = 0;
  for (const w of frenchWords) {
    if (lower.includes(w)) hits++;
  }
  return hits >= 3;
}

// ── Massive list of French artists to search ──
const FRENCH_ARTISTS = [
  // Variété classique
  "Joe Dassin", "Claude François", "Michel Sardou", "Jean-Jacques Goldman",
  "Francis Cabrel", "Edith Piaf", "Jacques Brel", "Charles Aznavour",
  "Georges Brassens", "Serge Gainsbourg", "Dalida", "Johnny Hallyday",
  "Sylvie Vartan", "France Gall", "Michel Berger", "Daniel Balavoine",
  "Alain Bashung", "Alain Souchon", "Laurent Voulzy", "Michel Polnareff",
  "Nino Ferrer", "Jean Ferrat", "Eddy Mitchell", "Jacques Dutronc",
  "Hugues Aufray", "Christophe", "Mike Brant", "Enrico Macias",
  "Gilbert Bécaud", "Yves Montand", "Mireille Mathieu", "Lara Fabian",
  "Patricia Kaas", "Florent Pagny", "Patrick Bruel", "Pascal Obispo",
  "Garou", "Céline Dion",

  // Pop/Rock FR
  "Téléphone", "Indochine", "Noir Désir", "Louise Attaque", "Mano Negra",
  "Les Rita Mitsouko", "Niagara", "Mylène Farmer", "Vanessa Paradis",
  "Etienne Daho", "Marc Lavoine", "Zazie", "Calogero",
  "Raphaël", "Bénabar", "Vincent Delerm", "Benjamin Biolay",
  "Thomas Dutronc", "Christophe Maé", "Keen'V", "M Pokora",
  "-M-", "Superbus", "Phoenix", "Air", "Daft Punk",
  "Noir Désir", "Dionysos", "Luke", "Saez", "Tryo",
  "Renan Luce", "Aldebert", "Cali", "La Grande Sophie",

  // Chanson française moderne
  "Stromae", "Angèle", "Zaz", "Vianney", "Louane", "Julien Doré",
  "Clara Luciani", "Pomme", "Hoshi", "Suzane", "Eddy de Pretto",
  "Orelsan", "Grand Corps Malade", "Soprano", "Kendji Girac",
  "Amir", "Slimane", "Vitaa", "Maître Gims", "Aya Nakamura",
  "Dadju", "Tayc", "Ninho", "Jul", "PNL",
  "Nekfeu", "Lomepal", "Hamza", "SCH", "Damso",
  "Niska", "MHD", "La Fouine", "Booba", "Rohff",
  "Sexion d'Assaut", "BigFlo et Oli", "Therapie Taxi",
  "L.E.J", "Trois Cafés Gourmands", "Boulevard des Airs",
  "Claudio Capéo", "Patrick Fiori", "Lorie", "Jenifer",
  "Nolwenn Leroy", "Natasha St-Pier", "Chimène Badi",

  // Rap FR
  "IAM", "NTM", "MC Solaar", "Oxmo Puccino", "Fonky Family",
  "113", "Sniper", "Kery James", "Youssoupha", "Abd Al Malik",
  "Disiz", "Sinik", "La Rumeur", "Diam's", "Alizée",

  // Groupes / Divers
  "Kids United", "Les Enfoirés", "Les Prêtres", "Il était une fois",
  "Les Compagnons de la chanson", "Les Innocents", "FFF",
  "Matmatah", "Les Wriggles", "Oldelaf", "Les Ogres de Barback",
  "La Rue Kétanou", "Debout sur le Zinc", "Java", "Têtes Raides",
  "Les Negresses Vertes", "Zebda", "Massilia Sound System",
  "I Am", "Stupeflip", "Naive New Beaters",
  "Christine and the Queens", "Jain", "Videoclub", "Feu! Chatterton",
  "Last Train", "Her", "Polo & Pan",
];

// Additional keyword searches
const SEARCH_KEYWORDS = [
  "chanson française", "chanson amour français", "variété française",
  "tube français", "chanson populaire france", "musique française classique",
  "rock français", "pop française", "rap français classique",
  "comptine française", "berceuse française", "chanson enfant français",
  "karaoké français", "disco français", "ballade française",
  "été français", "fête française", "noël français",
  "chanson mariage français", "chanson triste français",
  "années 80 français", "années 90 français", "années 2000 français",
  "chanson disney français", "comédie musicale français",
  "reggae français", "ska français", "electro français",
  "slam français", "chanson engagée français",
  "bossa nova français", "jazz vocal français",
];

async function songExistsInDb(title: string, artist: string): Promise<boolean> {
  const rows = await db
    .select({ id: schema.songs.id })
    .from(schema.songs)
    .where(
      and(ilike(schema.songs.title, title), ilike(schema.songs.artist, artist))
    )
    .limit(1);
  return rows.length > 0;
}

async function importResult(r: LRCResult, genre: string): Promise<boolean> {
  if (!r.plainLyrics && !r.syncedLyrics) return false;

  const text = r.syncedLyrics || r.plainLyrics || "";
  if (!isFrench(text)) return false;

  if (await songExistsInDb(r.trackName, r.artistName)) return false;

  let lyrics;
  let lrcTimestamps = null;
  if (r.syncedLyrics) {
    const parsed = parseLyricsFromLRC(r.syncedLyrics);
    lyrics = parsed.lyrics;
    lrcTimestamps = parsed.timestamps;
  } else {
    lyrics = parseLyricsFromText(r.plainLyrics!);
  }

  if (lyrics.length < 4) return false;

  await db.insert(schema.songs).values({
    title: r.trackName,
    artist: r.artistName,
    genre,
    difficulty: 2,
    lyrics,
    lrcTimestamps,
  });

  return true;
}

async function main() {
  console.log("\n🎵 Mass Import — Objectif : 1000 chansons françaises\n");

  // Count existing
  const existing = await db
    .select({ id: schema.songs.id })
    .from(schema.songs);
  let totalInDb = existing.length;
  let imported = 0;
  let skipped = 0;
  let notFrench = 0;
  const TARGET = 1000;

  console.log(`📦 Déjà en base : ${totalInDb}\n`);

  if (totalInDb >= TARGET) {
    console.log(`✅ Objectif atteint (${totalInDb}/${TARGET})`);
    return;
  }

  // Phase 1: Search by artist name
  console.log("── Phase 1 : Recherche par artiste ──\n");
  for (const artist of FRENCH_ARTISTS) {
    if (totalInDb >= TARGET) break;

    process.stdout.write(`  ${artist}... `);
    const results = await fetchLRC(
      `${LRCLIB_BASE}/search?artist_name=${encodeURIComponent(artist)}`
    );

    let batchImported = 0;
    for (const r of results.slice(0, 20)) {
      if (totalInDb >= TARGET) break;
      try {
        const ok = await importResult(r, "variété");
        if (ok) {
          batchImported++;
          imported++;
          totalInDb++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
    console.log(`+${batchImported} (total: ${totalInDb})`);
    await delay(DELAY_MS);
  }

  // Phase 2: Keyword searches
  if (totalInDb < TARGET) {
    console.log("\n── Phase 2 : Recherche par mots-clés ──\n");
    for (const kw of SEARCH_KEYWORDS) {
      if (totalInDb >= TARGET) break;

      process.stdout.write(`  "${kw}"... `);
      const results = await fetchLRC(
        `${LRCLIB_BASE}/search?q=${encodeURIComponent(kw)}`
      );

      let batchImported = 0;
      for (const r of results.slice(0, 20)) {
        if (totalInDb >= TARGET) break;
        try {
          const ok = await importResult(r, "variété");
          if (ok) {
            batchImported++;
            imported++;
            totalInDb++;
          } else {
            skipped++;
          }
        } catch {
          skipped++;
        }
      }
      console.log(`+${batchImported} (total: ${totalInDb})`);
      await delay(DELAY_MS);
    }
  }

  // Phase 3: Deep search per artist (albums, specific songs)
  if (totalInDb < TARGET) {
    console.log("\n── Phase 3 : Recherche approfondie par artiste ──\n");
    const topArtists = FRENCH_ARTISTS.slice(0, 60);
    for (const artist of topArtists) {
      if (totalInDb >= TARGET) break;

      // Search with different queries
      const queries = [
        `${artist} album`,
        `${artist} best`,
        `${artist} live`,
        `${artist} greatest hits`,
      ];

      for (const q of queries) {
        if (totalInDb >= TARGET) break;

        const results = await fetchLRC(
          `${LRCLIB_BASE}/search?q=${encodeURIComponent(q)}`
        );

        for (const r of results.slice(0, 15)) {
          if (totalInDb >= TARGET) break;
          try {
            const ok = await importResult(r, "variété");
            if (ok) {
              imported++;
              totalInDb++;
            }
          } catch {
            /* skip */
          }
        }
        await delay(DELAY_MS);
      }
      process.stdout.write(`  ${artist}: total ${totalInDb}\r`);
    }
    console.log();
  }

  console.log(`\n📊 Résultat final :`);
  console.log(`   ✅ ${imported} nouvelles chansons importées`);
  console.log(`   ⏭  ${skipped} ignorées (doublon/trop court/non FR)`);
  console.log(`   📦 ${totalInDb} chansons en base au total`);
  console.log(
    totalInDb >= TARGET
      ? `   🎯 Objectif atteint !`
      : `   ⚠️  ${TARGET - totalInDb} chansons manquantes pour l'objectif`
  );
  console.log();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
