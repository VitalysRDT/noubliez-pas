/**
 * Remove duplicate songs (keep the best version per title+artist).
 * "Best" = the one with the most LRC timestamps.
 *
 * Usage: npx tsx scripts/dedup-songs.ts
 */

import path from "path";
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

const sqlClient = neon(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/\(.*?\)/g, "") // remove parenthetical info
    .replace(/\[.*?\]/g, "") // remove bracket info
    .replace(/ - .*$/, "")   // remove " - Live", " - Remaster" etc
    .replace(/feat\..*$/i, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeArtist(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''`]/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/ feat\..*$/i, "")
    .replace(/[,&\/].*$/, "") // Keep only first artist
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const allSongs = await db
    .select({
      id: schema.songs.id,
      title: schema.songs.title,
      artist: schema.songs.artist,
      lrcTimestamps: schema.songs.lrcTimestamps,
    })
    .from(schema.songs);

  console.log(`\n🔍 Déduplication — ${allSongs.length} chansons en base\n`);

  // Group by normalized title+artist
  const groups = new Map<string, typeof allSongs>();
  for (const song of allSongs) {
    const key = `${normalizeTitle(song.title)}|||${normalizeArtist(song.artist)}`;
    const group = groups.get(key) ?? [];
    group.push(song);
    groups.set(key, group);
  }

  const toDelete: string[] = [];
  let dupeGroups = 0;

  for (const [key, songs] of groups) {
    if (songs.length <= 1) continue;
    dupeGroups++;

    // Sort: prefer more timestamps, then shorter title (less "(Live)" etc)
    songs.sort((a, b) => {
      const aTs = Array.isArray(a.lrcTimestamps) ? (a.lrcTimestamps as unknown[]).length : 0;
      const bTs = Array.isArray(b.lrcTimestamps) ? (b.lrcTimestamps as unknown[]).length : 0;
      if (bTs !== aTs) return bTs - aTs;
      return a.title.length - b.title.length;
    });

    const keep = songs[0];
    const dupes = songs.slice(1);

    console.log(`  📌 Garder: ${keep.artist} — ${keep.title}`);
    for (const d of dupes) {
      console.log(`     🗑  Suppr: ${d.artist} — ${d.title}`);
      toDelete.push(d.id);
    }
  }

  console.log(`\n${dupeGroups} groupes de doublons trouvés`);
  console.log(`${toDelete.length} doublons à supprimer\n`);

  for (const id of toDelete) {
    await db.delete(schema.songs).where(eq(schema.songs.id, id));
  }

  const remaining = allSongs.length - toDelete.length;
  console.log(`📊 Résultat : ${remaining} chansons uniques restantes\n`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
