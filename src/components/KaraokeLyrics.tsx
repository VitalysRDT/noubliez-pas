"use client";

import { useRef, useEffect } from "react";
import type { LyricLine, PausePoint, PausePointScore } from "@/lib/types";

interface KaraokeLyricsProps {
  lyrics: LyricLine[];
  activeLineIndex: number;
  pausePoints: PausePoint[];
  completedPausePointIds: string[];
  pausePointScores: Record<string, PausePointScore>;
  activePausePointId: string | null;
  playerId: 1 | 2;
  containerId?: string;
}

export function KaraokeLyrics({
  lyrics,
  activeLineIndex,
  pausePoints,
  completedPausePointIds,
  pausePointScores,
  activePausePointId,
  playerId,
  containerId,
}: KaraokeLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Build a set of all blank indices and map to their pause point
  const blankToPP = new Map<number, PausePoint>();
  for (const pp of pausePoints) {
    for (const idx of pp.blankIndices) {
      blankToPP.set(idx, pp);
    }
  }

  const completedSet = new Set(completedPausePointIds);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLineIndex]);

  let gi = 0;

  return (
    <div
      ref={containerRef}
      id={containerId}
      className="space-y-2 text-lg sm:text-xl leading-relaxed overflow-y-auto max-h-[50vh] py-4 px-2 scroll-smooth"
    >
      {lyrics.map((line) => {
        const isActive = line.index === activeLineIndex;
        const isPast = line.index < activeLineIndex;
        const isFuture = line.index > activeLineIndex;

        const lineWords = line.words.map((word) => {
          const currentGi = gi++;
          const pp = blankToPP.get(currentGi);
          const isBlank = !!pp;

          if (!isBlank) {
            return (
              <span
                key={currentGi}
                className={`mx-0.5 ${
                  isPast
                    ? "text-white/30"
                    : isActive
                      ? "text-white"
                      : "text-white/50"
                }`}
              >
                {word.text}
              </span>
            );
          }

          // This word is a blank — determine its display state
          const ppCompleted = completedSet.has(pp.id);
          const ppActive = pp.id === activePausePointId;

          // Completed pause point — show results
          if (ppCompleted) {
            const score = pausePointScores[pp.id];
            if (score) {
              const expected = score.correctAnswers[currentGi];
              const playerAnswer =
                playerId === 1
                  ? score.p1Answers[currentGi]
                  : score.p2Answers[currentGi];
              const isCorrect = (() => {
                if (!expected || !playerAnswer) return false;
                const norm = (s: string) =>
                  s
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "");
                return norm(playerAnswer) === norm(expected);
              })();

              return (
                <span key={currentGi} className="inline-block mx-0.5">
                  {isCorrect ? (
                    <span className="px-1.5 py-0.5 rounded bg-success/20 text-success font-bold border-b-2 border-success">
                      {expected}
                    </span>
                  ) : (
                    <span className="inline-flex flex-col items-center">
                      <span className="px-1.5 py-0.5 rounded bg-error/20 text-error line-through text-sm">
                        {playerAnswer || "..."}
                      </span>
                      <span className="text-xs text-warning font-bold">
                        {expected}
                      </span>
                    </span>
                  )}
                </span>
              );
            }
          }

          // Active pause point — show as highlighted blanks (inputs are in the overlay)
          if (ppActive) {
            return (
              <span
                key={currentGi}
                className="inline-block mx-0.5 px-2 py-0.5 rounded bg-accent/20 border-b-2 border-accent text-accent font-bold animate-pulse"
              >
                {"?".repeat(Math.max(2, word.text.length))}
              </span>
            );
          }

          // Future / not yet reached — show as hidden
          if (isFuture || !isPast) {
            return (
              <span
                key={currentGi}
                className={`mx-0.5 ${
                  isPast ? "text-white/30" : isActive ? "text-white" : "text-white/50"
                }`}
              >
                {word.text}
              </span>
            );
          }

          // Past but not yet completed (shouldn't happen normally)
          return (
            <span
              key={currentGi}
              className="mx-0.5 px-1 border-b border-white/20 text-white/20"
            >
              {"_".repeat(Math.max(2, word.text.length))}
            </span>
          );
        });

        return (
          <div
            key={line.index}
            ref={isActive ? activeRef : undefined}
            className={`text-center py-1.5 px-2 rounded-lg transition-all duration-500 ${
              isActive
                ? "text-white font-bold text-xl sm:text-2xl scale-105"
                : isPast
                  ? "text-sm opacity-50"
                  : "opacity-70"
            }`}
          >
            {lineWords}
          </div>
        );
      })}
    </div>
  );
}
