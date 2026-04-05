"use client";

import type { GameState } from "@/lib/types";
import { PlayerCard } from "./PlayerCard";

interface ScoreBoardProps {
  state: GameState;
  currentPlayerId: 1 | 2;
  isLocalMode?: boolean;
}

export function ScoreBoard({ state, currentPlayerId, isLocalMode }: ScoreBoardProps) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-white/40 uppercase tracking-wider text-center mb-1">
        Manche {state.currentRound} / {state.totalRounds}
        {isLocalMode && (
          <span className="ml-2 text-accent/60">local</span>
        )}
      </div>
      <div className={isLocalMode ? "grid grid-cols-2 gap-2" : "space-y-2"}>
        <PlayerCard
          name={state.players[1].name}
          score={state.players[1].score}
          isCurrentPlayer={!isLocalMode && currentPlayerId === 1}
          highlight={
            state.status === "revealing" &&
            state.roundResults !== null &&
            state.roundResults.player1Correct >
              state.roundResults.player2Correct
          }
          accentColor={isLocalMode ? "primary" : undefined}
        />
        {state.players[2] && (
          <PlayerCard
            name={state.players[2].name}
            score={state.players[2].score}
            isCurrentPlayer={!isLocalMode && currentPlayerId === 2}
            highlight={
              state.status === "revealing" &&
              state.roundResults !== null &&
              state.roundResults.player2Correct >
                state.roundResults.player1Correct
            }
            accentColor={isLocalMode ? "accent" : undefined}
          />
        )}
      </div>
    </div>
  );
}
