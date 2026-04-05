"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { LyricLine, PausePoint } from "@/lib/types";

interface UseKaraokeProps {
  audioUrl: string | null;
  lyrics: LyricLine[];
  pausePoints: PausePoint[];
  timingOffsetMs: number;
  enabled: boolean;
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

  // Store latest values in refs so polling closure always sees current data
  const lyricsRef = useRef(lyrics);
  const pausePointsRef = useRef(pausePoints);
  const offsetRef = useRef(timingOffsetMs);
  lyricsRef.current = lyrics;
  pausePointsRef.current = pausePoints;
  offsetRef.current = timingOffsetMs;

  // ── Audio element lifecycle ──
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
      cancelRaf();
    };

    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("error", onError);
    audio.addEventListener("ended", onEnded);
    audio.load();

    return () => {
      cancelRaf();
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

  function cancelRaf() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  // ── Polling tick — reads from refs, never stale ──
  function tick() {
    const audio = audioRef.current;
    if (!audio) return;

    const timeMs = audio.currentTime * 1000 + offsetRef.current;
    const currentLyrics = lyricsRef.current;
    const currentPPs = pausePointsRef.current;
    const completed = completedRef.current;

    // Check pause points first
    for (const pp of currentPPs) {
      if (completed.has(pp.id)) continue;
      if (timeMs >= pp.timeMs - 300 && timeMs <= pp.timeMs + 1000) {
        audio.pause();
        setActivePausePoint(pp);
        setIsPlaying(false);
        // Don't schedule next tick — we're paused
        return;
      }
    }

    // Find active line (last line whose timeMs <= currentTimeMs)
    let foundIndex = 0;
    for (const line of currentLyrics) {
      if (line.timeMs !== undefined && line.timeMs <= timeMs) {
        foundIndex = line.index;
      } else if (line.timeMs !== undefined && line.timeMs > timeMs) {
        break;
      }
    }
    setActiveLineIndex(foundIndex);

    // Schedule next tick
    rafRef.current = requestAnimationFrame(tick);
  }

  const startPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setStarted(true);
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
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
      rafRef.current = requestAnimationFrame(tick);
    }).catch(console.error);
  }, []);

  const stopPlayback = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
    cancelRaf();
  }, []);

  const reset = useCallback(() => {
    cancelRaf();
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
    startPlayback,
    resumeAfterPausePoint,
    stopPlayback,
    reset,
  };
}
