import { NextResponse } from "next/server";
import { createInitialState, generateRoomCode } from "@/lib/game-engine";
import { setGameState, getGameState } from "@/lib/redis";
import type { CreateRoomRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateRoomRequest;
    if (!body.playerName?.trim()) {
      return NextResponse.json(
        { error: "playerName is required" },
        { status: 400 }
      );
    }

    // Generate a unique room code
    let roomCode: string;
    let attempts = 0;
    do {
      roomCode = generateRoomCode();
      const existing = await getGameState(roomCode);
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return NextResponse.json(
        { error: "Could not generate unique room code" },
        { status: 500 }
      );
    }

    const totalRounds = body.totalRounds ?? 5;
    const state = createInitialState(roomCode, body.playerName.trim(), totalRounds);
    await setGameState(roomCode, state);

    return NextResponse.json({ roomCode, playerId: 1, state });
  } catch (err) {
    console.error("POST /api/rooms error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
