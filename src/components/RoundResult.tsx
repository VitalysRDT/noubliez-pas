"use client";

import type { RoundResults } from "@/lib/types";

interface RoundResultProps {
  results: RoundResults;
  player1Name: string;
  player2Name: string;
  blanksCount: number;
}

export function RoundResult({
  results,
  player1Name,
  player2Name,
  blanksCount,
}: RoundResultProps) {
  const p1Won =
    results.player1Correct > results.player2Correct;
  const p2Won =
    results.player2Correct > results.player1Correct;
  const tie =
    results.player1Correct === results.player2Correct;

  return (
    <div className="animate-fade-in-up space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div
          className={`rounded-xl p-4 text-center ${
            p1Won ? "bg-success/20 border border-success/30" : "bg-bg-card"
          }`}
        >
          <div className="text-sm text-white/50 truncate">{player1Name}</div>
          <div className="text-3xl font-extrabold tabular-nums mt-1">
            <span className={p1Won ? "text-success" : "text-white"}>
              {results.player1Correct}
            </span>
            <span className="text-white/30 text-lg">/{blanksCount}</span>
          </div>
          {p1Won && (
            <div className="text-xs text-success font-bold mt-1 uppercase">
              Victoire
            </div>
          )}
        </div>
        <div
          className={`rounded-xl p-4 text-center ${
            p2Won ? "bg-success/20 border border-success/30" : "bg-bg-card"
          }`}
        >
          <div className="text-sm text-white/50 truncate">{player2Name}</div>
          <div className="text-3xl font-extrabold tabular-nums mt-1">
            <span className={p2Won ? "text-success" : "text-white"}>
              {results.player2Correct}
            </span>
            <span className="text-white/30 text-lg">/{blanksCount}</span>
          </div>
          {p2Won && (
            <div className="text-xs text-success font-bold mt-1 uppercase">
              Victoire
            </div>
          )}
        </div>
      </div>
      {tie && (
        <p className="text-center text-accent font-bold text-sm">
          Egalité sur cette manche !
        </p>
      )}
    </div>
  );
}
