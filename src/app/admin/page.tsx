"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type Song = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  genre: string | null;
  difficulty: number;
};

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const adminKey = searchParams.get("key") ?? "";
  const [songs, setSongs] = useState<Song[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Manual add form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("variété");
  const [difficulty, setDifficulty] = useState("2");
  const [linesText, setLinesText] = useState("");

  async function loadSongs() {
    try {
      const res = await fetch("/api/songs");
      if (res.ok) setSongs(await res.json());
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadSongs();
  }, []);

  async function handleJsonImport() {
    if (!jsonInput.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const parsed = JSON.parse(jsonInput);
      const payload = Array.isArray(parsed) ? parsed : [parsed];
      const res = await fetch("/api/songs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: adminKey, songs: payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`${data.imported} chanson(s) importée(s)`);
        setJsonInput("");
        loadSongs();
      } else {
        setStatus(`Erreur: ${data.error}`);
      }
    } catch (err) {
      setStatus(`JSON invalide: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualAdd() {
    if (!title.trim() || !artist.trim() || !linesText.trim()) {
      setStatus("Remplissez titre, artiste et paroles");
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const lines = linesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch("/api/songs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: adminKey,
          songs: [
            {
              title: title.trim(),
              artist: artist.trim(),
              year: year ? parseInt(year) : undefined,
              genre: genre || undefined,
              difficulty: parseInt(difficulty),
              lines,
            },
          ],
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("Chanson ajoutée !");
        setTitle("");
        setArtist("");
        setYear("");
        setLinesText("");
        loadSongs();
      } else {
        setStatus(`Erreur: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Erreur: ${err}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette chanson ?")) return;
    try {
      await fetch(`/api/songs/${id}?key=${adminKey}`, { method: "DELETE" });
      loadSongs();
    } catch {
      // ignore
    }
  }

  if (!adminKey) {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-white/50">
          Accès refusé. Ajoutez ?key=VOTRE_SECRET dans l&apos;URL.
        </p>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full space-y-8">
      <h1 className="text-3xl font-extrabold text-accent">Admin — Chansons</h1>

      {status && (
        <div className="bg-bg-card rounded-xl p-3 text-sm text-center">
          {status}
        </div>
      )}

      {/* JSON Import */}
      <section className="bg-bg-card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold">Import JSON</h2>
        <p className="text-sm text-white/50">
          Collez un tableau JSON de chansons au format attendu.
        </p>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={8}
          className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm font-mono text-white placeholder-white/20 focus:outline-none focus:border-primary"
          placeholder={`[{"title":"...","artist":"...","year":2000,"lines":["ligne 1","ligne 2"]}]`}
        />
        <button
          onClick={handleJsonImport}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-light font-bold transition disabled:opacity-50"
        >
          {loading ? "Import..." : "Importer"}
        </button>
      </section>

      {/* Manual add */}
      <section className="bg-bg-card rounded-2xl p-6 space-y-4">
        <h2 className="text-xl font-bold">Ajout manuel</h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="col-span-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary"
          />
          <input
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artiste"
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary"
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Année"
            type="number"
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary"
          />
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary"
          >
            <option value="variété">Variété</option>
            <option value="pop">Pop</option>
            <option value="rock">Rock</option>
            <option value="rap">Rap</option>
            <option value="disney">Disney</option>
            <option value="classique">Classique</option>
          </select>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary"
          >
            <option value="1">Facile</option>
            <option value="2">Moyen</option>
            <option value="3">Difficile</option>
          </select>
        </div>
        <textarea
          value={linesText}
          onChange={(e) => setLinesText(e.target.value)}
          rows={8}
          placeholder={"Paroles (une ligne par ligne)\nEx:\nLe soleil brille\nSur la colline verte"}
          className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary"
        />
        <button
          onClick={handleManualAdd}
          disabled={loading}
          className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition disabled:opacity-50"
        >
          {loading ? "Ajout..." : "Ajouter la chanson"}
        </button>
      </section>

      {/* Songs list */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold">
          Chansons en base ({songs.length})
        </h2>
        {songs.length === 0 && (
          <p className="text-white/40 text-sm">Aucune chanson.</p>
        )}
        {songs.map((s) => (
          <div
            key={s.id}
            className="bg-bg-card rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="font-bold truncate">{s.title}</div>
              <div className="text-sm text-white/50">
                {s.artist} {s.year ? `(${s.year})` : ""} — {s.genre} — diff.{" "}
                {s.difficulty}
              </div>
            </div>
            <button
              onClick={() => handleDelete(s.id)}
              className="shrink-0 px-3 py-1 rounded-lg bg-error/20 text-error text-sm hover:bg-error/30 transition"
            >
              Suppr.
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
