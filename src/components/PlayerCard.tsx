"use client";

interface PlayerCardProps {
  name: string;
  score: number;
  isCurrentPlayer: boolean;
  highlight?: boolean;
  accentColor?: "primary" | "accent";
}

export function PlayerCard({
  name,
  score,
  isCurrentPlayer,
  highlight,
  accentColor,
}: PlayerCardProps) {
  const borderLeft = accentColor === "primary"
    ? "border-l-4 border-l-primary"
    : accentColor === "accent"
      ? "border-l-4 border-l-accent"
      : "";

  return (
    <div
      className={`rounded-xl px-4 py-3 flex items-center gap-3 transition-all ${borderLeft} ${
        highlight
          ? "bg-accent/20 border border-accent/40"
          : "bg-bg-card border border-white/5"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
          accentColor === "accent"
            ? "bg-accent text-black"
            : isCurrentPlayer || accentColor === "primary"
              ? "bg-primary text-white"
              : "bg-white/10 text-white/70"
        }`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate text-sm">
          {name}
          {isCurrentPlayer && (
            <span className="ml-1 text-xs text-primary">(vous)</span>
          )}
        </div>
      </div>
      <div
        className={`text-2xl font-extrabold tabular-nums ${
          highlight ? "text-accent animate-score-pop" : "text-white/80"
        }`}
      >
        {score}
      </div>
    </div>
  );
}
