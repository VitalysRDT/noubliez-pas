"use client";

import type { GameState } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";

interface ScoreBoardProps {
  state: GameState;
  currentPlayerId: 1 | 2;
}

export function ScoreBoard({ state, currentPlayerId }: ScoreBoardProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-white/40 uppercase tracking-wider text-center mb-1">
        Manche {state.currentRound} / {state.totalRounds}
      </div>
      <PlayerCard
        name={state.players[1].name}
        score={state.players[1].score}
        isCurrentPlayer={currentPlayerId === 1}
        highlight={
          state.status === "revealing" &&
          state.roundResults !== null &&
          state.roundResults.player1Correct >
            state.roundResults.player2Correct
        }
      />
      {state.players[2] && (
        <PlayerCard
          name={state.players[2].name}
          score={state.players[2].score}
          isCurrentPlayer={currentPlayerId === 2}
          highlight={
            state.status === "revealing" &&
            state.roundResults !== null &&
            state.roundResults.player2Correct >
              state.roundResults.player1Correct
          }
        />
      )}
    </div>
  );
}
