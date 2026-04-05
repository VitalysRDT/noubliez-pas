import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
      {/* Stage lights effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-lg w-full space-y-8">
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
            N&apos;oubliez pas
            <span className="block text-accent">les paroles</span>
          </h1>
          <p className="text-lg text-white/60">
            Duel en temps réel — Complétez les paroles, battez votre
            adversaire&nbsp;!
          </p>
        </div>

        <Link
          href="/lobby"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-4 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-lg transition-all duration-200 hover:scale-105 animate-glow-pulse"
        >
          Jouer maintenant
        </Link>

        <div className="grid grid-cols-3 gap-4 pt-4 text-sm text-white/50">
          <div className="bg-bg-card rounded-xl p-4">
            <div className="text-2xl font-bold text-accent">2</div>
            <div>joueurs</div>
          </div>
          <div className="bg-bg-card rounded-xl p-4">
            <div className="text-2xl font-bold text-accent">5</div>
            <div>manches</div>
          </div>
          <div className="bg-bg-card rounded-xl p-4">
            <div className="text-2xl font-bold text-accent">30s</div>
            <div>par manche</div>
          </div>
        </div>
      </div>
    </main>
  );
}
