"use client";

import { useRef, useCallback } from "react";
import type { LyricLine, RoundResults } from "@/lib/types";
import { WordInput } from "./WordInput";

interface LyricsDisplayProps {
  lyrics: LyricLine[];
  blanks: number[];
  answers: Record<number, string>;
  onAnswerChange: (wordIndex: number, value: string) => void;
  disabled: boolean;
  roundResults?: RoundResults | null;
  playerId: 1 | 2;
}

export function LyricsDisplay({
  lyrics,
  blanks,
  answers,
  onAnswerChange,
  disabled,
  roundResults,
  playerId,
}: LyricsDisplayProps) {
  const blanksSet = new Set(blanks);
  const blanksOrdered = [...blanks].sort((a, b) => a - b);
  const inputRefs = useRef<Map<number, () => void>>(new Map());

  const registerNext = useCallback(
    (globalIndex: number, focusFn: () => void) => {
      inputRefs.current.set(globalIndex, focusFn);
    },
    []
  );

  const focusNext = useCallback(
    (currentGlobalIndex: number) => {
      const currentPos = blanksOrdered.indexOf(currentGlobalIndex);
      if (currentPos < blanksOrdered.length - 1) {
        const nextEl = document.querySelector<HTMLInputElement>(
          `[data-blank-index="${blanksOrdered[currentPos + 1]}"]`
        );
        nextEl?.focus();
      }
    },
    [blanksOrdered]
  );

  const revealing = roundResults !== null && roundResults !== undefined;
  const playerAnswers =
    playerId === 1
      ? roundResults?.player1Answers
      : roundResults?.player2Answers;

  let globalIndex = 0;

  return (
    <div className="space-y-3 text-lg sm:text-xl leading-relaxed">
      {lyrics.map((line) => (
        <p key={line.index} className="text-center">
          {line.words.map((word) => {
            const gi = globalIndex++;
            const isBlank = blanksSet.has(gi);

            if (!isBlank) {
              return (
                <span key={gi} className="mx-0.5 text-white/90">
                  {word.text}
                </span>
              );
            }

            if (revealing && roundResults) {
              const correct = roundResults.correctAnswers[gi] === undefined
                ? false
                : (() => {
                    const pa = (playerAnswers ?? {})[gi] ?? "";
                    const expected = roundResults.correctAnswers[gi];
                    // Simple check — the server already scored this
                    const norm = (s: string) =>
                      s
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]/g, "");
                    return norm(pa) === norm(expected) ||
                      // Also accept if server scored it as correct
                      (playerId === 1
                        ? roundResults.player1Correct > 0
                        : roundResults.player2Correct > 0);
                  })();

              return (
                <WordInput
                  key={gi}
                  globalIndex={gi}
                  expectedLength={word.text.length}
                  value=""
                  onChange={() => {}}
                  disabled
                  revealed={{
                    correct: (() => {
                      const pa = (playerAnswers ?? {})[gi] ?? "";
                      const expected = roundResults.correctAnswers[gi];
                      if (!expected) return false;
                      const norm = (s: string) =>
                        s
                          .toLowerCase()
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .replace(/[^a-z0-9]/g, "");
                      const dist = (a: string, b: string) => {
                        const m = a.length, n = b.length;
                        const dp: number[][] = Array.from({length: m+1}, () => Array(n+1).fill(0));
                        for (let i = 0; i <= m; i++) dp[i][0] = i;
                        for (let j = 0; j <= n; j++) dp[0][j] = j;
                        for (let i = 1; i <= m; i++)
                          for (let j = 1; j <= n; j++)
                            dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
                        return dp[m][n];
                      };
                      const na = norm(pa), nb = norm(expected);
                      if (na === nb) return true;
                      if (na.length === 0) return false;
                      const ratio = 1 - dist(na, nb) / Math.max(na.length, nb.length);
                      return ratio >= 0.8;
                    })(),
                    answer: roundResults.correctAnswers[gi],
                    playerAnswer: (playerAnswers ?? {})[gi] ?? "",
                  }}
                />
              );
            }

            const isFirst = blanksOrdered[0] === gi;

            return (
              <span key={gi} className="inline-block" data-blank-index={gi}>
                <input
                  type="text"
                  value={answers[gi] ?? ""}
                  onChange={(e) => onAnswerChange(gi, e.target.value)}
                  disabled={disabled}
                  data-blank-index={gi}
                  autoFocus={isFirst}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" || e.key === "Enter") {
                      e.preventDefault();
                      focusNext(gi);
                    }
                  }}
                  aria-label={`Mot manquant numéro ${gi + 1}`}
                  className={`inline-block mx-0.5 px-1.5 py-0.5 rounded-md border-b-2 text-center font-bold bg-white/5 transition-all
                    ${
                      disabled
                        ? "border-white/10 text-white/30 cursor-not-allowed"
                        : "border-primary focus:border-accent focus:bg-white/10 focus:shadow-[0_0_12px_rgba(99,102,241,0.4)] text-white outline-none"
                    }`}
                  style={{
                    width: `${Math.max(3, word.text.length) * 0.7 + 1}em`,
                    fontSize: "inherit",
                  }}
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );
}
