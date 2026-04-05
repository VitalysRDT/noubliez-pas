"use client";

import { useState, useCallback, useRef } from "react";
import type { LyricLine, PausePoint } from "@/lib/types";
import { onTimeUpdate } from "@/lib/karaoke-engine";
import type { AudioPlayerHandle } from "@/components/AudioPlayer";

interface UseKaraokeProps {
  lyrics: LyricLine[];
  pausePoints: PausePoint[];
  timingOffsetMs: number;
}

export function useKaraoke({
  lyrics,
  pausePoints,
  timingOffsetMs,
}: UseKaraokeProps) {
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [activePausePoint, setActivePausePoint] = useState<PausePoint | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [songEnded, setSongEnded] = useState(false);
  const completedRef = useRef<Set<string>>(new Set());
  const playerRef = useRef<AudioPlayerHandle | null>(null);

  const handleTimeUpdate = useCallback(
    (timeMs: number) => {
      const adjustedMs = timeMs + timingOffsetMs;
      const action = onTimeUpdate(
        adjustedMs,
        lyrics,
        pausePoints,
        completedRef.current
      );

      if (action.type === "PAUSE_FOR_POINT") {
        playerRef.current?.pause();
        setActivePausePoint(action.pausePoint);
        setActiveLineIndex(action.pausePoint.index);
        setIsPlaying(false);
      } else if (action.type === "UPDATE_ACTIVE_LINE") {
        setActiveLineIndex(action.lineIndex);
      } else if (action.type === "SONG_ENDED") {
        setSongEnded(true);
      }
    },
    [lyrics, pausePoints, timingOffsetMs]
  );

  const startPlayback = useCallback(() => {
    playerRef.current?.play();
    setStarted(true);
    setIsPlaying(true);
  }, []);

  const resumeAfterPausePoint = useCallback(
    (pausePointId: string) => {
      completedRef.current.add(pausePointId);
      setActivePausePoint(null);

      // Check if all pause points done
      if (completedRef.current.size >= pausePoints.length) {
        // Let the song continue playing to the end
        playerRef.current?.resume();
        setIsPlaying(true);
        return;
      }

      // Resume audio
      playerRef.current?.resume();
      setIsPlaying(true);
    },
    [pausePoints.length]
  );

  const stopPlayback = useCallback(() => {
    playerRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setActiveLineIndex(0);
    setActivePausePoint(null);
    setIsPlaying(false);
    setStarted(false);
    setSongEnded(false);
    completedRef.current = new Set();
  }, []);

  const setPlayerRef = useCallback((handle: AudioPlayerHandle | null) => {
    playerRef.current = handle;
  }, []);

  return {
    activeLineIndex,
    activePausePoint,
    isPlaying,
    started,
    songEnded,
    completedPausePoints: completedRef.current,
    handleTimeUpdate,
    startPlayback,
    resumeAfterPausePoint,
    stopPlayback,
    reset,
    setPlayerRef,
  };
}
