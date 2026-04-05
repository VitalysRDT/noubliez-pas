import { NextResponse } from "next/server";
import { getGameState, setGameState, clearRoundAnswers } from "@/lib/redis";
import { prepareSong, startRound } from "@/lib/game-engine";
import { db } from "@/lib/db";
import { songs } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { notInArray } from "drizzle-orm";
import type { LyricLine } from "@/lib/types";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const state = await getGameState(roomId);
    if (!state) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    if (
      state.status !== "countdown" &&
      state.status !== "revealing"
    ) {
      return NextResponse.json(
        { error: "Cannot start next round in current state" },
        { status: 409 }
      );
    }

    if (state.currentRound >= state.totalRounds) {
      return NextResponse.json(
        { error: "All rounds completed" },
        { status: 409 }
      );
    }

    // Pick a random song not yet used
    const usedIds = state.usedSongIds;
    let songRows;
    if (usedIds.length > 0) {
      songRows = await db
        .select()
        .from(songs)
        .where(notInArray(songs.id, usedIds))
        .orderBy(sql`RANDOM()`)
        .limit(1);
    } else {
      songRows = await db
        .select()
        .from(songs)
        .orderBy(sql`RANDOM()`)
        .limit(1);
    }

    if (songRows.length === 0) {
      return NextResponse.json(
        { error: "No more songs available" },
        { status: 500 }
      );
    }

    const songRow = songRows[0];
    const currentSong = prepareSong({
      id: songRow.id,
      title: songRow.title,
      artist: songRow.artist,
      year: songRow.year,
      lyrics: songRow.lyrics as LyricLine[],
      audioUrl: songRow.audioUrl,
      youtubeId: songRow.youtubeId,
      timingOffsetMs: songRow.timingOffsetMs,
    });

    await clearRoundAnswers(roomId);
    const updated = startRound(state, currentSong);
    await setGameState(roomId, updated);

    return NextResponse.json({ state: updated });
  } catch (err) {
    console.error("POST /api/rooms/[roomId]/next error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
