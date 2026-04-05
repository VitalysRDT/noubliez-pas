"use client";

import { useState, type ReactNode } from "react";

interface SplitScreenLayoutProps {
  player1Name: string;
  player2Name: string;
  player1Panel: ReactNode;
  player2Panel: ReactNode;
  player1HasAnswers: boolean;
  player2HasAnswers: boolean;
  onSubmitBoth: () => void;
  submitted: boolean;
  disabled: boolean;
}

export function SplitScreenLayout({
  player1Name,
  player2Name,
  player1Panel,
  player2Panel,
  player1HasAnswers,
  player2HasAnswers,
  onSubmitBoth,
  submitted,
  disabled,
}: SplitScreenLayoutProps) {
  const [activeTab, setActiveTab] = useState<1 | 2>(1);

  return (
    <div className="w-full space-y-3">
      {/* ── Mobile: Tab switcher (visible < md) ── */}
      <div className="flex md:hidden gap-1 bg-bg-card rounded-xl p-1">
        <button
          onClick={() => setActiveTab(1)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 1
              ? "bg-primary text-white"
              : "text-white/50 hover:text-white/70"
          }`}
        >
          {player1Name}
          {activeTab !== 1 && player1HasAnswers && (
            <span className="w-2 h-2 rounded-full bg-success" />
          )}
        </button>
        <button
          onClick={() => setActiveTab(2)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 2
              ? "bg-accent text-black"
              : "text-white/50 hover:text-white/70"
          }`}
        >
          {player2Name}
          {activeTab !== 2 && player2HasAnswers && (
            <span className="w-2 h-2 rounded-full bg-success" />
          )}
        </button>
      </div>

      {/* ── Desktop: Side by side (visible >= md) ── */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-4">
        <PlayerColumn name={player1Name} color="primary">
          {player1Panel}
        </PlayerColumn>
        <PlayerColumn name={player2Name} color="accent">
          {player2Panel}
        </PlayerColumn>
      </div>

      {/* ── Mobile: Active tab content ── */}
      <div className="md:hidden">
        <div className={activeTab === 1 ? "block" : "hidden"}>
          {player1Panel}
        </div>
        <div className={activeTab === 2 ? "block" : "hidden"}>
          {player2Panel}
        </div>
      </div>

      {/* ── Submit button ── */}
      {!submitted && !disabled && (
        <button
          onClick={onSubmitBoth}
          className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02]"
        >
          Valider pour les deux
        </button>
      )}
      {submitted && (
        <div className="text-center text-white/50 py-3 flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Calcul des résultats...
        </div>
      )}
    </div>
  );
}

function PlayerColumn({
  name,
  color,
  children,
}: {
  name: string;
  color: "primary" | "accent";
  children: ReactNode;
}) {
  const borderColor =
    color === "primary" ? "border-primary/40" : "border-accent/40";
  const textColor =
    color === "primary" ? "text-primary" : "text-accent";
  const bgColor =
    color === "primary" ? "bg-primary/10" : "bg-accent/10";

  return (
    <div
      className={`rounded-xl border ${borderColor} overflow-hidden`}
    >
      <div
        className={`px-4 py-2 ${bgColor} text-center font-bold text-sm ${textColor}`}
      >
        {name}
      </div>
      <div className="p-3 max-h-[55vh] overflow-y-auto">{children}</div>
    </div>
  );
}
