"use client";

import { useRef, useEffect, useMemo } from "react";
import type { LyricLine, PausePoint, PausePointScore } from "@/lib/types";

interface KaraokeLyricsProps {
  lyrics: LyricLine[];
  activeLineIndex: number;
  pausePoints: PausePoint[];
  completedPausePointIds: string[];
  pausePointScores: Record<string, PausePointScore>;
  activePausePointId: string | null;
  playerId: 1 | 2;
}

const VISIBLE_BEFORE = 1; // 1 past line visible
const VISIBLE_AFTER = 2; // 2 future lines visible

export function KaraokeLyrics({
  lyrics,
  activeLineIndex,
  pausePoints,
  completedPausePointIds,
  pausePointScores,
  activePausePointId,
  playerId,
}: KaraokeLyricsProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  const blankToPP = useMemo(() => {
    const map = new Map<number, PausePoint>();
    for (const pp of pausePoints) {
      for (const idx of pp.blankIndices) map.set(idx, pp);
    }
    return map;
  }, [pausePoints]);

  const completedSet = useMemo(
    () => new Set(completedPausePointIds),
    [completedPausePointIds]
  );

  // Auto-scroll
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeLineIndex]);

  // Compute visible window
  const visibleStart = Math.max(0, activeLineIndex - VISIBLE_BEFORE);
  const visibleEnd = Math.min(lyrics.length - 1, activeLineIndex + VISIBLE_AFTER);

  // Build global index offset for visible lines
  let giOffset = 0;
  for (let i = 0; i < visibleStart; i++) {
    giOffset += lyrics[i].words.length;
  }

  let gi = giOffset;

  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] py-8 px-4 overflow-hidden">
      {lyrics.slice(visibleStart, visibleEnd + 1).map((line) => {
        const isActive = line.index === activeLineIndex;
        const isPast = line.index < activeLineIndex;
        const isFuture = line.index > activeLineIndex;
        const isNextLine = line.index === activeLineIndex + 1;

        const lineWords = line.words.map((word) => {
          const currentGi = gi++;
          const pp = blankToPP.get(currentGi);
          const isBlank = !!pp;

          // Non-blank word
          if (!isBlank) {
            return (
              <span key={currentGi} className="mx-[2px]">
                {word.text}
              </span>
            );
          }

          const ppCompleted = completedSet.has(pp.id);
          const ppActive = pp.id === activePausePointId;

          // Completed — show green/red result
          if (ppCompleted) {
            const score = pausePointScores[pp.id];
            if (score) {
              const expected = score.correctAnswers[currentGi];
              const playerAnswer =
                playerId === 1
                  ? score.p1Answers[currentGi]
                  : score.p2Answers[currentGi];
              const norm = (s: string) =>
                s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
              const isCorrect = !!expected && !!playerAnswer && norm(playerAnswer) === norm(expected);

              return (
                <span key={currentGi} className="mx-[2px] inline-block">
                  {isCorrect ? (
                    <span className="text-success font-bold">{expected}</span>
                  ) : (
                    <span className="text-error font-bold underline decoration-wavy">{expected}</span>
                  )}
                </span>
              );
            }
          }

          // Active pause — show "????"
          if (ppActive) {
            return (
              <span
                key={currentGi}
                className="mx-[2px] inline-block px-2 py-0.5 bg-accent/30 rounded text-accent font-extrabold animate-pulse"
              >
                {"?".repeat(Math.min(5, Math.max(2, word.text.length)))}
              </span>
            );
          }

          // Not yet reached — show word normally (player reads them in karaoke)
          return (
            <span key={currentGi} className="mx-[2px]">
              {word.text}
            </span>
          );
        });

        return (
          <div
            key={line.index}
            ref={isActive ? activeRef : undefined}
            className={`text-center w-full transition-all duration-700 ease-out ${
              isActive
                ? "text-3xl sm:text-4xl font-extrabold text-white py-4 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                : isPast
                  ? "text-lg text-white/20 py-1 -translate-y-2"
                  : isNextLine
                    ? "text-xl text-white/50 py-2"
                    : isFuture
                      ? "text-lg text-white/25 py-1"
                      : ""
            }`}
          >
            {lineWords}
          </div>
        );
      })}
    </div>
  );
}
