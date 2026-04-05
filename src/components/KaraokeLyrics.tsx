"use client";

import { useRef, useEffect } from "react";
import type { LyricLine, RoundResults } from "@/lib/types";

interface KaraokeLyricsProps {
  lyrics: LyricLine[];
  blanks: number[];
  activeLineIndex: number;
  pausedForLineIndex: number | null;
  answers: Record<number, string>;
  onAnswerChange: (wordIndex: number, value: string) => void;
  disabled: boolean;
  roundResults?: RoundResults | null;
  playerId: 1 | 2;
}

export function KaraokeLyrics({
  lyrics,
  blanks,
  activeLineIndex,
  pausedForLineIndex,
  answers,
  onAnswerChange,
  disabled,
  roundResults,
  playerId,
}: KaraokeLyricsProps) {
  const blanksSet = new Set(blanks);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active line
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeLineIndex, pausedForLineIndex]);

  const revealing = roundResults !== null && roundResults !== undefined;
  const playerAnswers =
    playerId === 1
      ? roundResults?.player1Answers
      : roundResults?.player2Answers;

  // Build blank indices per line
  let globalIndex = 0;
  const lineData = lyrics.map((line) => {
    const wordData = line.words.map((word) => {
      const gi = globalIndex++;
      return { word, gi, isBlank: blanksSet.has(gi) };
    });
    const lineBlanks = wordData.filter((w) => w.isBlank);
    return { line, wordData, hasBlanks: lineBlanks.length > 0 };
  });

  // Find first unfilled blank in paused line for autofocus
  const pausedLineData = pausedForLineIndex !== null
    ? lineData.find((ld) => ld.line.index === pausedForLineIndex)
    : null;
  const firstBlankInPausedLine = pausedLineData
    ? pausedLineData.wordData.find(
        (w) => w.isBlank && !answers[w.gi]
      )?.gi
    : null;

  return (
    <div
      ref={containerRef}
      className="space-y-2 text-base sm:text-lg leading-relaxed overflow-y-auto max-h-[60vh] py-4 px-2 scroll-smooth"
    >
      {lineData.map(({ line, wordData, hasBlanks }) => {
        const isActive = line.index === activeLineIndex;
        const isPausedLine = line.index === pausedForLineIndex;
        const isPast = line.index < activeLineIndex;
        const isFuture = line.index > activeLineIndex;

        return (
          <div
            key={line.index}
            ref={isActive || isPausedLine ? activeRef : undefined}
            className={`text-center py-1.5 px-2 rounded-lg transition-all duration-500 ${
              isPausedLine
                ? "bg-accent/10 border border-accent/30 scale-105 animate-glow-pulse"
                : isActive
                  ? "text-white font-bold text-lg sm:text-xl"
                  : isPast
                    ? "text-white/30 text-sm"
                    : isFuture
                      ? "text-white/50"
                      : ""
            }`}
          >
            {wordData.map(({ word, gi, isBlank }) => {
              if (!isBlank) {
                return (
                  <span key={gi} className="mx-0.5">
                    {word.text}
                  </span>
                );
              }

              // Revealing mode
              if (revealing && roundResults) {
                const expected = roundResults.correctAnswers[gi];
                const given = (playerAnswers ?? {})[gi] ?? "";
                const norm = (s: string) =>
                  s
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9]/g, "");
                const isCorrect = !!expected && norm(given) === norm(expected);

                return (
                  <span key={gi} className="inline-block mx-0.5">
                    {isCorrect ? (
                      <span className="px-1.5 py-0.5 rounded bg-success/20 text-success font-bold border-b-2 border-success">
                        {expected}
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-center">
                        <span className="px-1.5 py-0.5 rounded bg-error/20 text-error line-through text-sm">
                          {given || "..."}
                        </span>
                        <span className="text-xs text-warning font-bold">
                          {expected}
                        </span>
                      </span>
                    )}
                  </span>
                );
              }

              // Not paused for this line yet — show blank placeholder
              if (!isPausedLine) {
                return (
                  <span
                    key={gi}
                    className="inline-block mx-0.5 px-2 border-b-2 border-accent/40 text-accent/60 font-bold"
                  >
                    {"_".repeat(Math.max(3, word.text.length))}
                  </span>
                );
              }

              // Paused on this line — show inputs
              const isFirstBlank = gi === firstBlankInPausedLine;
              const width = Math.max(3, word.text.length) * 0.7 + 1;

              return (
                <input
                  key={gi}
                  type="text"
                  value={answers[gi] ?? ""}
                  onChange={(e) => onAnswerChange(gi, e.target.value)}
                  disabled={disabled}
                  autoFocus={isFirstBlank}
                  data-blank-index={gi}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" || e.key === "Enter") {
                      e.preventDefault();
                      // Focus next blank in this line
                      const allInputs =
                        containerRef.current?.querySelectorAll<HTMLInputElement>(
                          `[data-blank-index]`
                        );
                      if (allInputs) {
                        const arr = Array.from(allInputs);
                        const idx = arr.findIndex(
                          (el) => el.dataset.blankIndex === String(gi)
                        );
                        if (idx >= 0 && idx < arr.length - 1) {
                          arr[idx + 1].focus();
                        }
                      }
                    }
                  }}
                  aria-label={`Mot manquant`}
                  className="inline-block mx-0.5 px-1.5 py-0.5 rounded-md border-b-2 text-center font-bold bg-white/10 transition-all
                    border-accent focus:border-accent focus:bg-white/15 focus:shadow-[0_0_16px_rgba(245,158,11,0.5)] text-white outline-none"
                  style={{ width: `${width}em`, fontSize: "inherit" }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
