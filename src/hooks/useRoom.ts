"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GameState } from "@/lib/types";

export function useRoom(roomCode: string | null) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchState = useCallback(async () => {
    if (!roomCode) return;
    try {
      const res = await fetch(`/api/rooms/${roomCode}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Room introuvable");
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as GameState;
      setState(data);
      setError(null);
    } catch (err) {
      console.error("Polling error:", err);
      setError("Connexion perdue");
    }
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) return;
    fetchState();
    intervalRef.current = setInterval(fetchState, 1500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [roomCode, fetchState]);

  return { state, error, refetch: fetchState };
}
