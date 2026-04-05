"use client";

import { useCallback, useRef } from "react";
import type { PresenterLineType } from "@/lib/tts-lines";

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(
    async (type: PresenterLineType, params: Record<string, string | number>) => {
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, params }),
        });

        if (!res.ok) return;

        const contentType = res.headers.get("Content-Type");
        if (contentType?.includes("audio")) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);

          if (audioRef.current) {
            audioRef.current.pause();
            URL.revokeObjectURL(audioRef.current.src);
          }

          const audio = new Audio(url);
          audioRef.current = audio;
          await audio.play();
        }
      } catch {
        // TTS is non-blocking — game works without it
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  return { play, stop };
}
