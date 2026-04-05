"use client";

import { useState, useEffect } from "react";

interface TimerProps {
  deadline: number | null;
  onExpired?: () => void;
}

export function Timer({ deadline, onExpired }: TimerProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) {
      setSecondsLeft(null);
      return;
    }

    function tick() {
      const left = Math.max(0, Math.ceil((deadline! - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        onExpired?.();
      }
    }

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline, onExpired]);

  if (secondsLeft === null) return null;

  const urgent = secondsLeft <= 5;

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-mono text-lg font-bold tabular-nums transition-colors ${
        urgent
          ? "bg-error/20 text-error animate-pulse"
          : "bg-bg-card text-white/80"
      }`}
      role="timer"
      aria-label={`${secondsLeft} secondes restantes`}
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {secondsLeft}s
    </div>
  );
}
