"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LyricLine, PausePoint } from "@/lib/types";
import { onTimeUpdate } from "@/lib/karaoke-engine";

interface UseKaraokeProps {
  audioUrl: string | null;
  lyrics: LyricLine[];
  pausePoints: PausePoint[];
  timingOffsetMs: number;
  enabled: boolean; // false when not playing
}

export function useKaraoke({
  audioUrl,
  lyrics,
  pausePoints,
  timingOffsetMs,
  enabled,
}: UseKaraokeProps) {
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [activePausePoint, setActivePausePoint] = useState<PausePoint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [songEnded, setSongEnded] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef<Set<string>>(new Set());

  // ── Create and manage audio element ──
  useEffect(() => {
    if (!audioUrl || !enabled) return;

    const audio = new Audio();
    audio.preload = "auto";
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audioRef.current = audio;

    const onCanPlay = () => setAudioReady(true);
    const onError = () => setAudioError(true);
    const onEnded = () => {
      setSongEnded(true);
      setIsPlaying(false);
      stopPolling();
    };

    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    audio.load();

    return () => {
      stopPolling();
      audio.pause();
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("ended", onEnded);
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
      setAudioReady(false);
    };
  }, [audioUrl, enabled]);

  // ── Polling loop via requestAnimationFrame ──
  function startPolling() {
    function tick() {
      const audio = audioRef.current;
      if (!audio) return;
      const timeMs = audio.currentTime * 1000 + timingOffsetMs;

      const action = onTimeUpdate(timeMs, lyrics, pausePoints, completedRef.current);

      if (action.type === "PAUSE_FOR_POINT") {
        audio.pause();
        setActivePausePoint(action.pausePoint);
        setIsPlaying(false);
        stopPolling();
        return; // Stop polling during pause
      } else if (action.type === "UPDATE_ACTIVE_LINE") {
        setActiveLineIndex(action.lineIndex);
      }

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopPolling() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setStarted(true);
      setIsPlaying(true);
      startPolling();
    }).catch((err) => {
      console.error("Audio play failed:", err);
      setAudioError(true);
    });
  }, []);

  const resumeAfterPausePoint = useCallback((pausePointId: string) => {
    completedRef.current.add(pausePointId);
    setActivePausePoint(null);

    const audio = audioRef.current;
    if (!audio) return;

    audio.play().then(() => {
      setIsPlaying(true);
      startPolling();
    }).catch(console.error);
  }, []);

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    stopPolling();
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveLineIndex(0);
    setActivePausePoint(null);
    setIsPlaying(false);
    setStarted(false);
    setSongEnded(false);
    setAudioReady(false);
    setAudioError(false);
    completedRef.current = new Set();
  }, []);

  return {
    activeLineIndex,
    activePausePoint,
    isPlaying,
    started,
    audioReady,
    audioError,
    songEnded,
    completedPausePoints: completedRef.current,
    startPlayback,
    resumeAfterPausePoint,
    stopPlayback,
    reset,
  };
}
