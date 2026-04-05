import { NextResponse } from "next/server";
import {
  getGameState,
  setGameState,
  getPlayerAnswers,
  setPlayerAnswers,
} from "@/lib/redis";
import { resolveRound } from "@/lib/game-engine";
import type { SubmitAnswerRequest } from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = (await request.json()) as SubmitAnswerRequest;

    if (body.playerId !== 1 && body.playerId !== 2) {
      return NextResponse.json(
        { error: "Invalid playerId" },
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

    if (state.status !== "playing") {
      return NextResponse.json(
        { error: "Not in playing state" },
        { status: 409 }
      );
    }

    // Save this player's answers
    await setPlayerAnswers(roomId, body.playerId, body.answers);

    // Check if both players have answered
    const p1Answers = body.playerId === 1
      ? body.answers
      : await getPlayerAnswers(roomId, 1);
    const p2Answers = body.playerId === 2
      ? body.answers
      : await getPlayerAnswers(roomId, 2);

    const p1Submitted = Object.keys(p1Answers).length > 0;
    const p2Submitted = Object.keys(p2Answers).length > 0;

    // Also check timeout
    const timedOut =
      state.roundDeadline !== null && Date.now() > state.roundDeadline;

    if ((p1Submitted && p2Submitted) || timedOut) {
      const resolved = resolveRound(state, p1Answers, p2Answers);
      await setGameState(roomId, resolved);
      return NextResponse.json({ resolved: true, state: resolved });
    }

    return NextResponse.json({
      resolved: false,
      message: "Waiting for other player",
    });
  } catch (err) {
    console.error("POST /api/rooms/[roomId]/answer error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
