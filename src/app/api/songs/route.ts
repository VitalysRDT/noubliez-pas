import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { songs } from "@/lib/db/schema";

export async function GET() {
  try {
    const allSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        artist: songs.artist,
        year: songs.year,
        genre: songs.genre,
        difficulty: songs.difficulty,
        youtubeId: songs.youtubeId,
        timingOffsetMs: songs.timingOffsetMs,
      })
      .from(songs);
    return NextResponse.json(allSongs);
  } catch (err) {
    console.error("GET /api/songs error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
