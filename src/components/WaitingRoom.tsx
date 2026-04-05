"use client";

import { useState } from "react";

interface WaitingRoomProps {
  roomCode: string;
  playerName: string;
}

export function WaitingRoom({ roomCode, playerName }: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col items-center justify-center gap-8 text-center animate-fade-in-up">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          Bienvenue, <span className="text-accent">{playerName}</span>
        </h2>
        <p className="text-white/50">
          En attente de votre adversaire...
        </p>
      </div>

      <div className="bg-bg-card rounded-2xl p-8 space-y-4">
        <p className="text-sm text-white/50 uppercase tracking-wider">
          Code de la room
        </p>
        <button
          onClick={handleCopy}
          className="text-5xl font-mono font-extrabold tracking-[0.4em] text-accent hover:text-accent-light transition cursor-pointer"
          aria-label={`Copier le code ${roomCode}`}
        >
          {roomCode}
        </button>
        <p className="text-xs text-white/40">
          {copied
            ? "Copié !"
            : "Cliquez pour copier — partagez ce code avec votre adversaire"}
        </p>
      </div>

      <div className="flex items-center gap-3 text-white/40">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm">En attente du joueur 2...</span>
      </div>
    </div>
  );
}
