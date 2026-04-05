"use client";

import { useState, useCallback, useRef } from "react";
import type { LyricLine } from "@/lib/types";
import { buildKaraokeLines, onTimeUpdate } from "@/lib/karaoke-engine";
import type { AudioPlayerHandle } from "@/components/AudioPlayer";

interface UseKaraokeProps {
  lyrics: LyricLine[];
  blanks: number[];
  timingOffsetMs: number;
}

export function useKaraoke({ lyrics, blanks, timingOffsetMs }: UseKaraokeProps) {
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [pausedForLine, setPausedForLine] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const pausedLinesRef = useRef<Set<number>>(new Set());
  const playerRef = useRef<AudioPlayerHandle | null>(null);
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const karaokeLines = buildKaraokeLines(lyrics, blanks);

  const handleTimeUpdate = useCallback(
    (timeMs: number) => {
      const adjustedMs = timeMs + timingOffsetMs;
      const action = onTimeUpdate(adjustedMs, karaokeLines, pausedLinesRef.current);

      if (action.type === "UPDATE_ACTIVE_LINE") {
        setActiveLineIndex(action.lineIndex);
      } else if (action.type === "PAUSE_FOR_BLANKS") {
        playerRef.current?.pause();
        pausedLinesRef.current.add(action.lineIndex);
        setPausedForLine(action.lineIndex);
        setActiveLineIndex(action.lineIndex);
        setIsPlaying(false);

        // Auto-resume after 15s
        if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
        lineTimerRef.current = setTimeout(() => {
          resumePlayback();
        }, 15_000);
      }
    },
    [karaokeLines, timingOffsetMs]
  );

  const startPlayback = useCallback(() => {
    playerRef.current?.play();
    setStarted(true);
    setIsPlaying(true);
  }, []);

  const resumePlayback = useCallback(() => {
    setPausedForLine(null);
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    playerRef.current?.resume();
    setIsPlaying(true);
  }, []);

  const stopPlayback = useCallback(() => {
    playerRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setActiveLineIndex(0);
    setPausedForLine(null);
    setIsPlaying(false);
    setStarted(false);
    pausedLinesRef.current = new Set();
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
  }, []);

  const setPlayerRef = useCallback((handle: AudioPlayerHandle | null) => {
    playerRef.current = handle;
  }, []);

  return {
    activeLineIndex,
    pausedForLine,
    isPlaying,
    started,
    handleTimeUpdate,
    startPlayback,
    resumePlayback,
    stopPlayback,
    reset,
    setPlayerRef,
  };
}
