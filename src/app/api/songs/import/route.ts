import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { songs } from "@/lib/db/schema";
import { parseLyrics } from "@/lib/lyrics-processor";

type SongImport = {
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  difficulty?: number;
  lines: string[];
};

export async function POST(request: Request) {
  try {
    const { key, songs: importSongs } = (await request.json()) as {
      key: string;
      songs: SongImport[];
    };

    if (key !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!Array.isArray(importSongs) || importSongs.length === 0) {
      return NextResponse.json(
        { error: "No songs provided" },
        { status: 400 }
      );
    }

    const rows = importSongs.map((s) => ({
      title: s.title,
      artist: s.artist,
      year: s.year ?? null,
      genre: s.genre ?? null,
      difficulty: s.difficulty ?? 2,
      lyrics: parseLyrics(s.lines),
    }));

    const inserted = await db.insert(songs).values(rows).returning({
      id: songs.id,
      title: songs.title,
    });

    return NextResponse.json({
      imported: inserted.length,
      songs: inserted,
    });
  } catch (err) {
    console.error("POST /api/songs/import error:", err);
    return NextResponse.json(
      { error: "Import failed" },
      { status: 500 }
    );
  }
}
