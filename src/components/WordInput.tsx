"use client";

import { useRef, useEffect } from "react";

interface WordInputProps {
  globalIndex: number;
  expectedLength: number;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  revealed?: {
    correct: boolean;
    answer: string;
    playerAnswer: string;
  };
  autoFocus?: boolean;
  onNext?: () => void;
}

export function WordInput({
  globalIndex,
  expectedLength,
  value,
  onChange,
  disabled,
  revealed,
  autoFocus,
  onNext,
}: WordInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
    }
  }, [autoFocus]);

  if (revealed) {
    return (
      <span className="inline-block mx-0.5 align-baseline">
        {revealed.correct ? (
          <span className="px-1.5 py-0.5 rounded bg-success/20 text-success font-bold border-b-2 border-success">
            {revealed.answer}
          </span>
        ) : (
          <span className="inline-flex flex-col items-center">
            <span className="px-1.5 py-0.5 rounded bg-error/20 text-error line-through text-sm">
              {revealed.playerAnswer || "..."}
            </span>
            <span className="text-xs text-warning font-bold">
              {revealed.answer}
            </span>
          </span>
        )}
      </span>
    );
  }

  const width = Math.max(3, expectedLength) * 0.7 + 1;

  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault();
          onNext?.();
        }
      }}
      aria-label={`Mot manquant numéro ${globalIndex + 1}`}
      className={`inline-block mx-0.5 px-1.5 py-0.5 rounded-md border-b-2 text-center font-bold bg-white/5 transition-all
        ${
          disabled
            ? "border-white/10 text-white/30 cursor-not-allowed"
            : "border-primary focus:border-accent focus:bg-white/10 focus:shadow-[0_0_12px_rgba(99,102,241,0.4)] text-white outline-none"
        }`}
      style={{ width: `${width}em`, fontSize: "inherit" }}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
}
