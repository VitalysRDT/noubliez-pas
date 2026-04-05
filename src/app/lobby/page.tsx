"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LobbyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [name2, setName2] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState<
    "choose" | "create" | "join" | "local"
  >("choose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError("Entrez votre nom");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name.trim() }),
      });
      if (!res.ok) throw new Error("Erreur création");
      const data = await res.json();
      sessionStorage.setItem("playerId", "1");
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.removeItem("localMode");
      router.push(`/game/${data.roomCode}`);
    } catch {
      setError("Impossible de créer la partie");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!name.trim()) {
      setError("Entrez votre nom");
      return;
    }
    if (!roomCode.trim()) {
      setError("Entrez le code de la room");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = roomCode.trim().toUpperCase();
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur");
      }
      sessionStorage.setItem("playerId", "2");
      sessionStorage.setItem("playerName", name.trim());
      sessionStorage.removeItem("localMode");
      router.push(`/game/${code}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de rejoindre"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLocal() {
    if (!name.trim() || !name2.trim()) {
      setError("Entrez les noms des 2 joueurs");
      return;
    }
    if (name.trim().toLowerCase() === name2.trim().toLowerCase()) {
      setError("Les 2 joueurs doivent avoir des noms différents");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Create room as player 1
      const res1 = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name.trim() }),
      });
      if (!res1.ok) throw new Error("Erreur création");
      const { roomCode: code } = await res1.json();

      // Immediately join as player 2
      const res2 = await fetch(`/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: name2.trim() }),
      });
      if (!res2.ok) throw new Error("Erreur join P2");

      sessionStorage.setItem("localMode", "true");
      sessionStorage.setItem("player1Name", name.trim());
      sessionStorage.setItem("player2Name", name2.trim());
      router.push(`/game/${code}`);
    } catch {
      setError("Impossible de créer la partie locale");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-3xl font-extrabold text-center">
          <span className="text-accent">Lobby</span>
        </h1>

        {/* Name input — visible for online modes */}
        {mode !== "local" && (
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-white/70 mb-1"
            >
              Votre nom
            </label>
            <input
              id="name"
              type="text"
              maxLength={20}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marie"
              className="w-full px-4 py-3 rounded-xl bg-bg-card border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
            />
          </div>
        )}

        {mode === "choose" && (
          <div className="space-y-3">
            <button
              onClick={() => setMode("create")}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]"
            >
              Créer une partie
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-4 rounded-xl bg-bg-card border border-white/10 hover:border-primary font-bold text-lg transition-all hover:scale-[1.02]"
            >
              Rejoindre une partie
            </button>
            <div className="relative flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30 uppercase">ou</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              onClick={() => setMode("local")}
              className="w-full py-4 rounded-xl bg-accent/20 border border-accent/30 hover:bg-accent/30 text-accent font-bold text-lg transition-all hover:scale-[1.02]"
            >
              Jouer sur cet écran
            </button>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-4 animate-fade-in-up">
            <p className="text-white/50 text-center text-sm">
              Créez une room et partagez le code avec votre adversaire.
            </p>
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Création..." : "Lancer la partie"}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-white/40 hover:text-white/70 transition"
            >
              Retour
            </button>
          </div>
        )}

        {mode === "join" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-white/70 mb-1"
              >
                Code de la room
              </label>
              <input
                id="code"
                type="text"
                maxLength={4}
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                className="w-full px-4 py-3 rounded-xl bg-bg-card border border-white/10 text-white placeholder-white/30 text-center text-2xl font-mono tracking-[0.3em] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Connexion..." : "Rejoindre"}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-white/40 hover:text-white/70 transition"
            >
              Retour
            </button>
          </div>
        )}

        {mode === "local" && (
          <div className="space-y-4 animate-fade-in-up">
            <p className="text-white/50 text-center text-sm">
              2 joueurs, 1 écran — entrez vos noms.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-primary mb-1">
                  Joueur 1
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Marie"
                  className="w-full px-4 py-3 rounded-xl bg-bg-card border border-primary/30 text-white placeholder-white/30 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-accent mb-1">
                  Joueur 2
                </label>
                <input
                  type="text"
                  maxLength={20}
                  value={name2}
                  onChange={(e) => setName2(e.target.value)}
                  placeholder="Paul"
                  className="w-full px-4 py-3 rounded-xl bg-bg-card border border-accent/30 text-white placeholder-white/30 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                />
              </div>
            </div>
            <button
              onClick={handleLocal}
              disabled={loading}
              className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
            >
              {loading ? "Lancement..." : "C'est parti !"}
            </button>
            <button
              onClick={() => setMode("choose")}
              className="w-full text-sm text-white/40 hover:text-white/70 transition"
            >
              Retour
            </button>
          </div>
        )}

        {error && (
          <p className="text-error text-center text-sm font-medium animate-fade-in-up">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
