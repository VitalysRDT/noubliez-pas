"use client";

import { useState, useCallback } from "react";

export function useGameState() {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const setAnswer = useCallback((wordIndex: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [wordIndex]: value }));
  }, []);

  const resetRound = useCallback(() => {
    setAnswers({});
    setSubmitted(false);
  }, []);

  return { answers, setAnswer, submitted, setSubmitted, resetRound };
}
