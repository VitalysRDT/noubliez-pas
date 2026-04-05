import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { songs } from "@/lib/db/schema";
import { and, eq, ilike } from "drizzle-orm";
import { FRENCH_SONG_CATALOG } from "@/lib/song-catalog";
import { getSong, searchSongs, delay } from "@/lib/lrclib";
import {
  parseLyricsFromText,
  parseLyricsFromLRC,
} from "@/lib/lyrics-processor";

export const maxDuration = 60;

type AutoImportRequest = {
  mode: "catalog" | "search" | "import-one";
  query?: string;
  offset?: number;
  batchSize?: number;
  // For import-one mode
  title?: string;
  artist?: string;
  year?: number;
  genre?: string;
};

type BatchReport = {
  imported: number;
  skipped: number;
  notFound: string[];
  errors: string[];
  nextOffset: number;
  total: number;
  done: boolean;
};

export async function POST(request: Request) {
  try {
    const adminKey = request.headers.get("x-admin-key");
    if (adminKey !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AutoImportRequest;

    if (body.mode === "search") {
      if (!body.query) {
        return NextResponse.json(
          { error: "query required for search mode" },
          { status: 400 }
        );
      }
      const results = await searchSongs(body.query);
      return NextResponse.json({
        results: results.map((r) => ({
          id: r.id,
          trackName: r.trackName,
          artistName: r.artistName,
          albumName: r.albumName,
          duration: r.duration,
          hasPlainLyrics: !!r.plainLyrics,
          hasSyncedLyrics: !!r.syncedLyrics,
        })),
      });
    }

    if (body.mode === "import-one") {
      if (!body.title || !body.artist) {
        return NextResponse.json(
          { error: "title and artist required" },
          { status: 400 }
        );
      }
      const result = await importSingleSong(
        body.title,
        body.artist,
        body.year ?? null,
        body.genre ?? "variété"
      );
      return NextResponse.json(result);
    }

    // mode === "catalog"
    const offset = body.offset ?? 0;
    const batchSize = body.batchSize ?? 10;
    const catalog = FRENCH_SONG_CATALOG;
    const batch = catalog.slice(offset, offset + batchSize);

    const report: BatchReport = {
      imported: 0,
      skipped: 0,
      notFound: [],
      errors: [],
      nextOffset: offset + batchSize,
      total: catalog.length,
      done: offset + batchSize >= catalog.length,
    };

    for (const entry of batch) {
      try {
        // Check if already in DB
        const existing = await db
          .select({ id: songs.id })
          .from(songs)
          .where(
            and(
              ilike(songs.title, entry.title),
              ilike(songs.artist, entry.artist)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          report.skipped++;
          continue;
        }

        // Fetch from LRCLIB
        const lrcResult = await getSong(entry.artist, entry.title);
        if (
          !lrcResult ||
          (!lrcResult.plainLyrics && !lrcResult.syncedLyrics)
        ) {
          report.notFound.push(`${entry.artist} — ${entry.title}`);
          await delay(200);
          continue;
        }

        // Parse lyrics
        let lyrics;
        let lrcTimestamps = null;
        if (lrcResult.syncedLyrics) {
          const parsed = parseLyricsFromLRC(lrcResult.syncedLyrics);
          lyrics = parsed.lyrics;
          lrcTimestamps = parsed.timestamps;
        } else if (lrcResult.plainLyrics) {
          lyrics = parseLyricsFromText(lrcResult.plainLyrics);
        } else {
          report.notFound.push(`${entry.artist} — ${entry.title}`);
          await delay(200);
          continue;
        }

        // Filter: minimum 4 lines
        if (lyrics.length < 4) {
          report.notFound.push(
            `${entry.artist} — ${entry.title} (trop court: ${lyrics.length} lignes)`
          );
          await delay(200);
          continue;
        }

        // Insert
        await db.insert(songs).values({
          title: entry.title,
          artist: entry.artist,
          year: entry.year,
          genre: entry.genre,
          difficulty: 2,
          lyrics,
          lrcTimestamps,
        });

        report.imported++;
      } catch (err) {
        report.errors.push(
          `${entry.artist} — ${entry.title}: ${err instanceof Error ? err.message : "unknown"}`
        );
      }

      await delay(200);
    }

    return NextResponse.json(report);
  } catch (err) {
    console.error("POST /api/songs/auto-import error:", err);
    return NextResponse.json(
      { error: "Auto-import failed" },
      { status: 500 }
    );
  }
}

async function importSingleSong(
  title: string,
  artist: string,
  year: number | null,
  genre: string
) {
  const lrcResult = await getSong(artist, title);
  if (!lrcResult || (!lrcResult.plainLyrics && !lrcResult.syncedLyrics)) {
    return { success: false, error: "Not found on LRCLIB" };
  }

  let lyrics;
  let lrcTimestamps = null;
  if (lrcResult.syncedLyrics) {
    const parsed = parseLyricsFromLRC(lrcResult.syncedLyrics);
    lyrics = parsed.lyrics;
    lrcTimestamps = parsed.timestamps;
  } else if (lrcResult.plainLyrics) {
    lyrics = parseLyricsFromText(lrcResult.plainLyrics);
  } else {
    return { success: false, error: "No lyrics content" };
  }

  if (lyrics.length < 4) {
    return { success: false, error: `Too short: ${lyrics.length} lines` };
  }

  const [inserted] = await db
    .insert(songs)
    .values({
      title,
      artist,
      year,
      genre,
      difficulty: 2,
      lyrics,
      lrcTimestamps,
    })
    .returning({ id: songs.id, title: songs.title });

  return { success: true, song: inserted };
}
