"use client";

import { useEffect, useRef, useCallback, useState, forwardRef, useImperativeHandle } from "react";

export interface AudioPlayerHandle {
  play: () => void;
  pause: () => void;
  resume: () => void;
  seekTo: (timeMs: number) => void;
  getCurrentTimeMs: () => number;
}

interface AudioPlayerProps {
  audioUrl: string;
  onReady: () => void;
  onTimeUpdate: (timeMs: number) => void;
  onEnded: () => void;
  onError: () => void;
}

export const AudioPlayer = forwardRef<AudioPlayerHandle, AudioPlayerProps>(
  function AudioPlayer({ audioUrl, onReady, onTimeUpdate, onEnded, onError }, ref) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [progress, setProgress] = useState(0);

    const startPolling = useCallback(() => {
      function tick() {
        if (audioRef.current) {
          const ms = audioRef.current.currentTime * 1000;
          onTimeUpdate(ms);
          const dur = audioRef.current.duration;
          if (dur > 0) setProgress(audioRef.current.currentTime / dur);
        }
        rafRef.current = requestAnimationFrame(tick);
      }
      rafRef.current = requestAnimationFrame(tick);
    }, [onTimeUpdate]);

    const stopPolling = useCallback(() => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    }, []);

    useEffect(() => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.crossOrigin = "anonymous";
      audioRef.current = audio;

      audio.addEventListener("canplaythrough", () => {
        setLoaded(true);
        onReady();
      });
      audio.addEventListener("ended", () => {
        stopPolling();
        onEnded();
      });
      audio.addEventListener("error", () => {
        onError();
      });
      audio.addEventListener("play", startPolling);
      audio.addEventListener("pause", stopPolling);

      audio.src = audioUrl;
      audio.load();

      return () => {
        stopPolling();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        audioRef.current = null;
      };
    }, [audioUrl, onReady, onEnded, onError, startPolling, stopPolling]);

    useImperativeHandle(ref, () => ({
      play() {
        audioRef.current?.play();
      },
      pause() {
        audioRef.current?.pause();
      },
      resume() {
        audioRef.current?.play();
      },
      seekTo(timeMs: number) {
        if (audioRef.current) {
          audioRef.current.currentTime = timeMs / 1000;
        }
      },
      getCurrentTimeMs() {
        return (audioRef.current?.currentTime ?? 0) * 1000;
      },
    }));

    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 h-1">
        {!loaded && (
          <div className="absolute inset-0 bg-white/5 animate-pulse" />
        )}
        <div
          className="h-full bg-accent/60 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    );
  }
);
