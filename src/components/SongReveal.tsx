"use client";

interface SongRevealProps {
  title: string;
  artist: string;
  year: number | null;
}

export function SongReveal({ title, artist, year }: SongRevealProps) {
  return (
    <div className="text-center animate-fade-in-up space-y-1">
      <p className="text-xs text-white/40 uppercase tracking-wider">
        La chanson était
      </p>
      <h3 className="text-xl sm:text-2xl font-extrabold text-accent">
        {title}
      </h3>
      <p className="text-white/60">
        {artist}
        {year ? ` (${year})` : ""}
      </p>
    </div>
  );
}
