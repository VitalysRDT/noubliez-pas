import { NextResponse } from "next/server";
import { getGameState, setGameState } from "@/lib/redis";
import type { JoinRoomRequest } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = (await request.json()) as JoinRoomRequest;

    if (!body.playerName?.trim()) {
      return NextResponse.json(
        { error: "playerName is required" },
        { status: 400 }
      );
    }

    const state = await getGameState(roomId);
    if (!state) {
      return NextResponse.json(
        { error: "Room not found" },
        { status: 404 }
      );
    }

    if (state.players[2] !== null) {
      return NextResponse.json(
        { error: "Room is full" },
        { status: 409 }
      );
    }

    if (state.status !== "waiting") {
      return NextResponse.json(
        { error: "Game already started" },
        { status: 409 }
      );
    }

    const updated = {
      ...state,
      players: {
        ...state.players,
        2: { name: body.playerName.trim(), score: 0, connected: true },
      },
      status: "countdown" as const,
    };
    await setGameState(roomId, updated);

    return NextResponse.json({ playerId: 2, state: updated });
  } catch (err) {
    console.error("POST /api/rooms/[roomId]/join error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
