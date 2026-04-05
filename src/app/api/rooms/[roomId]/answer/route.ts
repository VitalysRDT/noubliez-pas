import { NextResponse } from "next/server";
import {
  getGameState,
  setGameState,
} from "@/lib/redis";
import { scorePausePoint, resolveRound } from "@/lib/game-engine";
import type { SubmitPauseAnswerRequest } from "@/lib/types";
import { redis } from "@/lib/redis-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = (await request.json()) as SubmitPauseAnswerRequest;

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

    if (state.status !== "playing" || !state.currentSong || !state.karaoke) {
      return NextResponse.json(
        { error: "Not in playing state" },
        { status: 409 }
      );
    }

    const ppId = body.pausePointId;
    const pp = state.currentSong.pausePoints.find((p) => p.id === ppId);
    if (!pp) {
      return NextResponse.json(
        { error: "Invalid pausePointId" },
        { status: 400 }
      );
    }

    // Store this player's answers for this pause point
    const answerKey = `room:${roomId}:pp:${ppId}:${body.playerId}`;
    await redis().set(answerKey, JSON.stringify(body.answers), { ex: 3600 });

    // Check if the other player has also answered
    const otherId = body.playerId === 1 ? 2 : 1;
    const otherKey = `room:${roomId}:pp:${ppId}:${otherId}`;
    const otherRaw = await redis().get<string>(otherKey);

    // For single player (player 2 is null), auto-resolve
    const isSingleOrBothAnswered =
      state.players[2] === null || otherRaw !== null;

    if (!isSingleOrBothAnswered) {
      return NextResponse.json({
        resolved: false,
        message: "Waiting for other player",
      });
    }

    // Both answered (or solo mode) — score this pause point
    const p1Raw =
      body.playerId === 1
        ? body.answers
        : JSON.parse(
            (await redis().get<string>(`room:${roomId}:pp:${ppId}:1`)) ?? "{}"
          );
    const p2Raw =
      body.playerId === 2
        ? body.answers
        : state.players[2]
          ? JSON.parse(
              (await redis().get<string>(`room:${roomId}:pp:${ppId}:2`)) ?? "{}"
            )
          : {};

    const ppScore = scorePausePoint(
      state.currentSong.lyrics,
      pp.blankIndices,
      p1Raw,
      p2Raw
    );

    // Update karaoke state
    const updatedKaraoke = {
      ...state.karaoke,
      activePausePointId: null,
      completedPausePoints: [...state.karaoke.completedPausePoints, ppId],
      pausePointScores: {
        ...state.karaoke.pausePointScores,
        [ppId]: ppScore,
      },
      pauseDeadline: null,
    };

    // Update player scores immediately (all-or-nothing)
    const p1Points = ppScore.p1AllCorrect ? pp.points : 0;
    const p2Points = ppScore.p2AllCorrect ? pp.points : 0;

    // Check if all pause points are done
    const allDone =
      updatedKaraoke.completedPausePoints.length >=
      state.currentSong.pausePoints.length;

    let updatedState;
    if (allDone) {
      // Resolve the full round
      updatedState = resolveRound(state, updatedKaraoke.pausePointScores);
    } else {
      // Continue playing — update scores + karaoke state
      updatedState = {
        ...state,
        players: {
          1: {
            ...state.players[1],
            score: state.players[1].score + p1Points,
          },
          2: state.players[2]
            ? {
                ...state.players[2],
                score: state.players[2].score + p2Points,
              }
            : null,
        },
        karaoke: updatedKaraoke,
      };
    }

    await setGameState(roomId, updatedState);

    // Clean up per-PP answer keys
    await Promise.all([
      redis().del(`room:${roomId}:pp:${ppId}:1`),
      redis().del(`room:${roomId}:pp:${ppId}:2`),
    ]);

    return NextResponse.json({
      resolved: true,
      allDone,
      ppScore,
      p1Points,
      p2Points,
      state: updatedState,
    });
  } catch (err) {
    console.error("POST /api/rooms/[roomId]/answer error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
