"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PausePoint, LyricLine } from "@/lib/types";
import { PAUSE_DURATION_MS } from "@/lib/types";

interface PausePointOverlayProps {
  pausePoint: PausePoint;
  lyrics: LyricLine[];
  onSubmit: (answers: Record<number, string>) => void;
  onUseInitials: () => void;
  initialsUsed: boolean;
  initials: Record<number, string> | null; // wordIndex → first letter
}

export function PausePointOverlay({
  pausePoint,
  lyrics,
  onSubmit,
  onUseInitials,
  initialsUsed,
  initials,
}: PausePointOverlayProps) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(
    Math.ceil(PAUSE_DURATION_MS / 1000)
  );
  const deadlineRef = useRef(Date.now() + PAUSE_DURATION_MS);
  const submittedRef = useRef(false);

  // Reset on new pause point
  useEffect(() => {
    setAnswers({});
    setSecondsLeft(Math.ceil(PAUSE_DURATION_MS / 1000));
    deadlineRef.current = Date.now() + PAUSE_DURATION_MS;
    submittedRef.current = false;
  }, [pausePoint.id]);

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.ceil((deadlineRef.current - Date.now()) / 1000)
      );
      setSecondsLeft(left);
      if (left <= 0 && !submittedRef.current) {
        submittedRef.current = true;
        onSubmit(answers);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [pausePoint.id, answers, onSubmit]);

  const handleSubmit = useCallback(() => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(answers);
  }, [answers, onSubmit]);

  // Build context: find the lines containing blanks
  const blanksSet = new Set(pausePoint.blankIndices);
  const contextLines: {
    lineIndex: number;
    fragments: { text: string; isBlank: boolean; gi: number }[];
  }[] = [];

  let gi = 0;
  for (const line of lyrics) {
    const fragments: { text: string; isBlank: boolean; gi: number }[] = [];
    let hasBlank = false;
    for (const word of line.words) {
      if (blanksSet.has(gi)) {
        hasBlank = true;
        fragments.push({ text: word.text, isBlank: true, gi });
      } else {
        fragments.push({ text: word.text, isBlank: false, gi });
      }
      gi++;
    }
    if (hasBlank) {
      contextLines.push({ lineIndex: line.index, fragments });
    }
  }

  const urgent = secondsLeft <= 5;
  const inputOrder = pausePoint.blankIndices;

  function focusNextInput(currentGi: number) {
    const idx = inputOrder.indexOf(currentGi);
    if (idx < inputOrder.length - 1) {
      const next = document.querySelector<HTMLInputElement>(
        `[data-pp-blank="${inputOrder[idx + 1]}"]`
      );
      next?.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in-up">
      <div className="w-full max-w-lg mx-4 bg-bg-dark border border-accent/30 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-accent/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-accent font-extrabold text-lg">
              Arrêt {pausePoint.index + 1}/5
            </span>
            <span className="text-white/60 text-sm">
              {pausePoint.wordCount} mot{pausePoint.wordCount > 1 ? "s" : ""}{" "}
              — {pausePoint.points} pts
            </span>
          </div>
          <div
            className={`font-mono font-bold text-xl tabular-nums ${
              urgent ? "text-error animate-pulse" : "text-white"
            }`}
          >
            {secondsLeft}s
          </div>
        </div>

        {/* Lyrics context with blanks */}
        <div className="px-6 py-5 space-y-3">
          {contextLines.map((cl) => (
            <p
              key={cl.lineIndex}
              className="text-center text-lg leading-relaxed"
            >
              {cl.fragments.map((f) => {
                if (!f.isBlank) {
                  return (
                    <span key={f.gi} className="text-white/70 mx-0.5">
                      {f.text}
                    </span>
                  );
                }
                const width = Math.max(3, f.text.length) * 0.7 + 1;
                const hint = initials?.[f.gi];
                return (
                  <input
                    key={f.gi}
                    type="text"
                    data-pp-blank={f.gi}
                    value={answers[f.gi] ?? ""}
                    onChange={(e) =>
                      setAnswers((prev) => ({
                        ...prev,
                        [f.gi]: e.target.value,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Tab" || e.key === "Enter") {
                        e.preventDefault();
                        focusNextInput(f.gi);
                      }
                    }}
                    placeholder={hint ? `${hint}...` : "___"}
                    autoFocus={f.gi === inputOrder[0]}
                    className="inline-block mx-1 px-2 py-1 rounded-lg border-b-2 border-accent text-center font-bold bg-white/10 text-white placeholder-white/30 outline-none focus:bg-white/15 focus:shadow-[0_0_16px_rgba(245,158,11,0.5)] transition-all"
                    style={{ width: `${width}em`, fontSize: "inherit" }}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                );
              })}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 space-y-3">
          <button
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02]"
          >
            Valider
          </button>
          {!initialsUsed && (
            <button
              onClick={onUseInitials}
              className="w-full py-2.5 rounded-xl bg-primary/20 border border-primary/30 text-primary font-bold text-sm hover:bg-primary/30 transition"
            >
              Joker : Initiales
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
