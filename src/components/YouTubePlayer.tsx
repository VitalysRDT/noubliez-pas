"use client";

import { useEffect, useRef, useCallback, useState } from "react";

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onReady: () => void;
  onTimeUpdate: (timeMs: number) => void;
  onError: () => void;
}

let apiLoaded = false;
let apiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded && window.YT?.Player) return Promise.resolve();

  return new Promise((resolve) => {
    if (apiLoaded) {
      apiCallbacks.push(resolve);
      return;
    }
    apiLoaded = true;
    apiCallbacks.push(resolve);

    window.onYouTubeIframeAPIReady = () => {
      for (const cb of apiCallbacks) cb();
      apiCallbacks = [];
    };

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
}

export function YouTubePlayer({
  videoId,
  onReady,
  onTimeUpdate,
  onError,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);

  const startPolling = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      if (playerRef.current?.getCurrentTime) {
        const t = playerRef.current.getCurrentTime();
        onTimeUpdate(t * 1000);
      }
    }, 100);
  }, [onTimeUpdate]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      await loadYouTubeAPI();
      if (!mounted || !containerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        width: 200,
        height: 112,
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (mounted) {
              setReady(true);
              onReady();
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (event.data === YT.PlayerState.PLAYING) {
              startPolling();
            } else {
              stopPolling();
            }
          },
          onError: () => {
            if (mounted) onError();
          },
        },
      });
    }

    init();

    return () => {
      mounted = false;
      stopPolling();
      playerRef.current?.destroy();
    };
  }, [videoId, onReady, onError, startPolling, stopPolling]);

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10 opacity-60 hover:opacity-100 transition-opacity">
      <div ref={containerRef} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-bg-dark">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// Imperative handle for parent to control playback
export function useYouTubeControl() {
  const playerRef = useRef<YT.Player | null>(null);

  const play = useCallback(() => {
    playerRef.current?.playVideo();
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
  }, []);

  const seekTo = useCallback((seconds: number) => {
    playerRef.current?.seekTo(seconds, true);
  }, []);

  const setPlayerRef = useCallback((player: YT.Player | null) => {
    playerRef.current = player;
  }, []);

  return { play, pause, seekTo, setPlayerRef };
}
