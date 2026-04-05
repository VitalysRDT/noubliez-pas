"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

type Song = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  genre: string | null;
  difficulty: number;
  audioUrl: string | null;
  youtubeId: string | null;
  timingOffsetMs: number | null;
};

type LRCSearchResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  hasPlainLyrics: boolean;
  hasSyncedLyrics: boolean;
};

type BatchReport = {
  imported: number;
  skipped: number;
  notFound: string[];
  errors: string[];
  nextOffset: number;
  total: number;
  done: boolean;
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
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"auto" | "manual" | "json" | "songs">("auto");

  // Auto-import state
  const [catalogProgress, setCatalogProgress] = useState<{
    running: boolean;
    current: number;
    total: number;
    imported: number;
    skipped: number;
    notFound: string[];
    errors: string[];
  } | null>(null);

  // LRCLIB search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LRCSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Manual add form
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [genre, setGenre] = useState("variété");
  const [linesText, setLinesText] = useState("");
  const [jsonInput, setJsonInput] = useState("");

  // YouTube ID editor
  const [editingSongId, setEditingSongId] = useState<string | null>(null);
  const [editYoutubeId, setEditYoutubeId] = useState("");
  const [editOffset, setEditOffset] = useState("0");

  const loadSongs = useCallback(async () => {
    try {
      const res = await fetch("/api/songs");
      if (res.ok) setSongs(await res.json());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  // ── Auto-import catalog (batch by batch) ──
  async function handleCatalogImport() {
    setCatalogProgress({
      running: true,
      current: 0,
      total: 0,
      imported: 0,
      skipped: 0,
      notFound: [],
      errors: [],
    });

    let offset = 0;
    const batchSize = 10;
    let totalImported = 0;
    let totalSkipped = 0;
    const allNotFound: string[] = [];
    const allErrors: string[] = [];

    while (true) {
      try {
        const res = await fetch("/api/songs/auto-import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-key": adminKey,
          },
          body: JSON.stringify({ mode: "catalog", offset, batchSize }),
        });
        const data = (await res.json()) as BatchReport;

        totalImported += data.imported;
        totalSkipped += data.skipped;
        allNotFound.push(...data.notFound);
        allErrors.push(...data.errors);

        setCatalogProgress({
          running: !data.done,
          current: data.nextOffset,
          total: data.total,
          imported: totalImported,
          skipped: totalSkipped,
          notFound: allNotFound,
          errors: allErrors,
        });

        if (data.done) break;
        offset = data.nextOffset;
      } catch (err) {
        allErrors.push(`Batch error: ${err}`);
        break;
      }
    }

    setCatalogProgress((prev) =>
      prev ? { ...prev, running: false } : null
    );
    loadSongs();
  }

  // ── LRCLIB search ──
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const res = await fetch("/api/songs/auto-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({ mode: "search", query: searchQuery }),
      });
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch {
      setStatus("Erreur de recherche");
    } finally {
      setSearching(false);
    }
  }

  async function handleImportOne(result: LRCSearchResult) {
    setLoading(true);
    try {
      const res = await fetch("/api/songs/auto-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          mode: "import-one",
          title: result.trackName,
          artist: result.artistName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(`Importé : ${result.trackName}`);
        setSearchResults((prev) => prev.filter((r) => r.id !== result.id));
        loadSongs();
      } else {
        setStatus(`Erreur : ${data.error}`);
      }
    } catch {
      setStatus("Erreur d'import");
    } finally {
      setLoading(false);
    }
  }

  // ── JSON import ──
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

  // ── Manual add ──
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
              difficulty: 2,
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

  // ── Delete ──
  async function handleDelete(id: string) {
    if (!confirm("Supprimer cette chanson ?")) return;
    try {
      await fetch(`/api/songs/${id}?key=${adminKey}`, { method: "DELETE" });
      loadSongs();
    } catch {
      /* ignore */
    }
  }

  // ── Update YouTube ID / offset ──
  async function handleUpdateSong(id: string) {
    try {
      const res = await fetch(`/api/songs/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey,
        },
        body: JSON.stringify({
          youtubeId: editYoutubeId || null,
          timingOffsetMs: parseInt(editOffset) || 0,
        }),
      });
      if (res.ok) {
        setEditingSongId(null);
        setStatus("Chanson mise à jour");
        loadSongs();
      }
    } catch {
      setStatus("Erreur de mise à jour");
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
    <main className="flex-1 px-4 py-8 max-w-3xl mx-auto w-full space-y-6">
      <h1 className="text-3xl font-extrabold text-accent">
        Admin — Chansons
      </h1>

      {status && (
        <div className="bg-bg-card rounded-xl p-3 text-sm text-center animate-fade-in-up">
          {status}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(
          [
            ["auto", "Auto-import"],
            ["manual", "Manuel"],
            ["json", "JSON"],
            ["songs", `Chansons (${songs.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition ${
              tab === key
                ? "bg-primary text-white"
                : "bg-bg-card text-white/50 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Auto-import tab ── */}
      {tab === "auto" && (
        <div className="space-y-6">
          {/* Catalog import */}
          <section className="bg-bg-card rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Import catalogue LRCLIB</h2>
            <p className="text-sm text-white/50">
              Importe automatiquement 60+ chansons françaises depuis LRCLIB
              (par batch de 10).
            </p>
            <button
              onClick={handleCatalogImport}
              disabled={catalogProgress?.running}
              className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition disabled:opacity-50"
            >
              {catalogProgress?.running
                ? "Import en cours..."
                : "Importer le catalogue complet"}
            </button>

            {catalogProgress && (
              <div className="space-y-3">
                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-accent h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${catalogProgress.total > 0 ? (catalogProgress.current / catalogProgress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div>
                    <div className="text-lg font-bold text-success">
                      {catalogProgress.imported}
                    </div>
                    <div className="text-white/40">importées</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white/60">
                      {catalogProgress.skipped}
                    </div>
                    <div className="text-white/40">ignorées</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-warning">
                      {catalogProgress.notFound.length}
                    </div>
                    <div className="text-white/40">non trouvées</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-error">
                      {catalogProgress.errors.length}
                    </div>
                    <div className="text-white/40">erreurs</div>
                  </div>
                </div>
                {catalogProgress.notFound.length > 0 && (
                  <details className="text-sm text-white/40">
                    <summary className="cursor-pointer hover:text-white/60">
                      Non trouvées ({catalogProgress.notFound.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                      {catalogProgress.notFound.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </section>

          {/* LRCLIB search */}
          <section className="bg-bg-card rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Recherche LRCLIB</h2>
            <div className="flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Titre, artiste, paroles..."
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-light font-bold transition disabled:opacity-50"
              >
                {searching ? "..." : "Chercher"}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate text-sm">
                        {r.trackName}
                      </div>
                      <div className="text-xs text-white/50">
                        {r.artistName} — {r.albumName}
                        {r.hasSyncedLyrics && (
                          <span className="ml-2 text-success">LRC</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleImportOne(r)}
                      disabled={loading}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-success/20 text-success text-sm font-bold hover:bg-success/30 transition disabled:opacity-50"
                    >
                      Importer
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── Manual tab ── */}
      {tab === "manual" && (
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
              className="col-span-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary"
            >
              <option value="variété">Variété</option>
              <option value="pop">Pop</option>
              <option value="rock">Rock</option>
              <option value="rap">Rap</option>
              <option value="chanson">Chanson</option>
              <option value="disney">Disney</option>
            </select>
          </div>
          <textarea
            value={linesText}
            onChange={(e) => setLinesText(e.target.value)}
            rows={8}
            placeholder="Paroles (une ligne par ligne)"
            className="w-full rounded-xl bg-white/5 border border-white/10 p-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleManualAdd}
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition disabled:opacity-50"
          >
            {loading ? "Ajout..." : "Ajouter"}
          </button>
        </section>
      )}

      {/* ── JSON tab ── */}
      {tab === "json" && (
        <section className="bg-bg-card rounded-2xl p-6 space-y-4">
          <h2 className="text-xl font-bold">Import JSON</h2>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            rows={10}
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
      )}

      {/* ── Songs tab ── */}
      {tab === "songs" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              Chansons en base ({songs.length})
            </h2>
            <button
              onClick={loadSongs}
              className="text-sm text-white/40 hover:text-white transition"
            >
              Rafraîchir
            </button>
          </div>
          {songs.length === 0 && (
            <p className="text-white/40 text-sm">Aucune chanson.</p>
          )}
          {songs.map((s) => (
            <div
              key={s.id}
              className="bg-bg-card rounded-xl p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-bold truncate">{s.title}</div>
                  <div className="text-sm text-white/50">
                    {s.artist} {s.year ? `(${s.year})` : ""} — {s.genre}
                    {s.audioUrl ? (
                      <span className="ml-2 text-success text-xs" title={s.audioUrl}>
                        MP3
                      </span>
                    ) : (
                      <span className="ml-2 text-error/60 text-xs">
                        pas d&apos;audio
                      </span>
                    )}
                    {s.youtubeId && (
                      <span className="ml-1 text-primary text-xs">
                        YT
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditingSongId(
                        editingSongId === s.id ? null : s.id
                      );
                      setEditYoutubeId(s.youtubeId ?? "");
                      setEditOffset(String(s.timingOffsetMs ?? 0));
                    }}
                    className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm hover:bg-primary/30 transition"
                  >
                    YT
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className="px-3 py-1 rounded-lg bg-error/20 text-error text-sm hover:bg-error/30 transition"
                  >
                    Suppr.
                  </button>
                </div>
              </div>
              {editingSongId === s.id && (
                <div className="flex gap-2 items-end animate-fade-in-up">
                  <div className="flex-1">
                    <label className="text-xs text-white/40">
                      YouTube Video ID
                    </label>
                    <input
                      value={editYoutubeId}
                      onChange={(e) => setEditYoutubeId(e.target.value)}
                      placeholder="dQw4w9WgXcQ"
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-white/40">
                      Offset (ms)
                    </label>
                    <input
                      value={editOffset}
                      onChange={(e) => setEditOffset(e.target.value)}
                      type="number"
                      className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateSong(s.id)}
                    className="px-4 py-1.5 rounded-lg bg-success/20 text-success text-sm font-bold hover:bg-success/30 transition"
                  >
                    Sauver
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
