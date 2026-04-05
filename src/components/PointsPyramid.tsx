"use client";

import type { PausePoint, PausePointScore } from "@/lib/types";

interface PointsPyramidProps {
  pausePoints: PausePoint[];
  completedIds: string[];
  scores: Record<string, PausePointScore>;
  activePausePointId: string | null;
  playerId: 1 | 2;
}

export function PointsPyramid({
  pausePoints,
  completedIds,
  scores,
  activePausePointId,
  playerId,
}: PointsPyramidProps) {
  const completedSet = new Set(completedIds);

  return (
    <div className="flex flex-col-reverse gap-1.5 w-full max-w-xs mx-auto">
      {pausePoints.map((pp) => {
        const isCompleted = completedSet.has(pp.id);
        const isActive = pp.id === activePausePointId;
        const score = scores[pp.id];
        const playerAllCorrect =
          score &&
          (playerId === 1 ? score.p1AllCorrect : score.p2AllCorrect);

        let bg: string;
        let border: string;
        let textColor: string;

        if (isActive) {
          bg = "bg-accent/20";
          border = "border-accent animate-glow-pulse";
          textColor = "text-accent";
        } else if (isCompleted && playerAllCorrect) {
          bg = "bg-success/15";
          border = "border-success/40";
          textColor = "text-success";
        } else if (isCompleted && !playerAllCorrect) {
          bg = "bg-error/10";
          border = "border-error/30";
          textColor = "text-error/60";
        } else {
          bg = "bg-white/5";
          border = "border-white/10";
          textColor = "text-white/40";
        }

        return (
          <div
            key={pp.id}
            className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${bg} ${border} transition-all`}
          >
            <span className={`text-xs font-bold ${textColor}`}>
              {pp.wordCount} mot{pp.wordCount > 1 ? "s" : ""}
            </span>
            <span className={`text-sm font-extrabold tabular-nums ${textColor}`}>
              {pp.points} pts
              {isCompleted && playerAllCorrect && " \u2713"}
              {isCompleted && !playerAllCorrect && " \u2717"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
