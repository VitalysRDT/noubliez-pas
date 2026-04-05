"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useAudio } from "@/hooks/useAudio";
import { useKaraoke } from "@/hooks/useKaraoke";
import { WaitingRoom } from "@/components/WaitingRoom";
import { ScoreBoard } from "@/components/ScoreBoard";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { PausePointOverlay } from "@/components/PausePointOverlay";
import { PointsPyramid } from "@/components/PointsPyramid";
import { RoundResult } from "@/components/RoundResult";
import { SongReveal } from "@/components/SongReveal";
import { buildPausePointAnswerKey } from "@/lib/karaoke-engine";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { state, error: roomError, refetch } = useRoom(roomId);
  const { play: playTts } = useAudio();

  const [playerId, setPlayerId] = useState<1 | 2>(1);
  const [playerName, setPlayerName] = useState("");
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [initialsUsed, setInitialsUsed] = useState(false);
  const [initials, setInitials] = useState<Record<number, string> | null>(null);

  const song = state?.currentSong ?? null;
  const isPlaying = state?.status === "playing";

  // Karaoke — audio managed internally by the hook
  const karaoke = useKaraoke({
    audioUrl: song?.audioUrl ?? null,
    lyrics: song?.lyrics ?? [],
    pausePoints: song?.pausePoints ?? [],
    timingOffsetMs: song?.timingOffsetMs ?? 0,
    enabled: isPlaying && !!song?.hasKaraoke,
  });

  // Load player info
  useEffect(() => {
    const local = sessionStorage.getItem("localMode") === "true";
    setIsLocalMode(local);
    if (!local) {
      const id = sessionStorage.getItem("playerId");
      const name = sessionStorage.getItem("playerName");
      if (id) setPlayerId(Number(id) as 1 | 2);
      if (name) setPlayerName(name);
    } else {
      setPlayerName(sessionStorage.getItem("player1Name") ?? "");
    }
  }, []);

  // Reset on new round
  useEffect(() => {
    if (state?.status === "playing" && prevStatus !== "playing") {
      setInitialsUsed(false);
      setInitials(null);
      karaoke.reset();
    }
  }, [state?.status, prevStatus, karaoke]);

  // ── Status transitions ──
  useEffect(() => {
    if (!state) return;
    if (state.status === prevStatus) return;

    if (state.status === "countdown" && prevStatus !== "countdown") {
      setCountdown(3);
      playTts("welcome", {
        player1: state.players[1].name,
        player2: state.players[2]?.name ?? "Joueur 2",
      });
      let count = 3;
      const timer = setInterval(() => {
        count--;
        setCountdown(count);
        if (count <= 0) {
          clearInterval(timer);
          setCountdown(null);
          fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
        }
      }, 1000);
    }

    if (state.status === "playing" && prevStatus !== "playing") {
      playTts("roundStart", {
        round: state.currentRound,
        total: state.totalRounds,
      });
    }

    if (state.status === "revealing" && prevStatus !== "revealing") {
      karaoke.stopPlayback();
      if (state.currentSong && state.roundResults) {
        const p1 = state.roundResults.player1Correct;
        const p2 = state.roundResults.player2Correct;
        if (p1 === p2) {
          playTts("tie", {});
        } else {
          playTts("roundEnd", {
            winner: p1 > p2 ? state.players[1].name : state.players[2]?.name ?? "",
            score: Math.max(p1, p2),
            title: state.currentSong.title,
            artist: state.currentSong.artist,
          });
        }
      }
    }

    if (state.status === "finished" && prevStatus !== "finished") {
      karaoke.stopPlayback();
      const s1 = state.players[1].score;
      const s2 = state.players[2]?.score ?? 0;
      if (s1 !== s2) {
        playTts("gameEnd", {
          winner: s1 > s2 ? state.players[1].name : state.players[2]?.name ?? "",
          score: Math.max(s1, s2),
          score1: s1,
          score2: s2,
        });
      }
    }

    setPrevStatus(state.status);
  }, [state, prevStatus, roomId, playTts, karaoke]);

  // ── Submit pause point answers ──
  const handlePausePointSubmit = useCallback(
    async (answers: Record<number, string>) => {
      if (!karaoke.activePausePoint) return;
      const ppId = karaoke.activePausePoint.id;

      try {
        if (isLocalMode) {
          await Promise.all([
            fetch(`/api/rooms/${roomId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId: 1, pausePointId: ppId, answers }),
            }),
            fetch(`/api/rooms/${roomId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ playerId: 2, pausePointId: ppId, answers }),
            }),
          ]);
        } else {
          await fetch(`/api/rooms/${roomId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ playerId, pausePointId: ppId, answers }),
          });
        }

        await refetch();

        // Brief pause to show result, then resume
        setTimeout(() => {
          karaoke.resumeAfterPausePoint(ppId);
        }, 2000);
      } catch (err) {
        console.error("PausePoint submit error:", err);
        karaoke.resumeAfterPausePoint(ppId);
      }
    },
    [karaoke, roomId, playerId, isLocalMode, refetch]
  );

  // ── Joker: Initiales ──
  const handleUseInitials = useCallback(() => {
    if (!karaoke.activePausePoint || !song || initialsUsed) return;
    setInitialsUsed(true);
    const answerKey = buildPausePointAnswerKey(
      song.lyrics,
      karaoke.activePausePoint.blankIndices
    );
    const hints: Record<number, string> = {};
    for (const [idx, word] of Object.entries(answerKey)) {
      hints[Number(idx)] = word.charAt(0).toUpperCase();
    }
    setInitials(hints);
  }, [karaoke.activePausePoint, song, initialsUsed]);

  const handleNextRound = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
    } catch (err) {
      console.error("Next round error:", err);
    }
  }, [roomId]);

  // ── Rendering ──
  if (roomError) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center gap-4">
        <p className="text-error text-lg font-bold">{roomError}</p>
        <button onClick={() => router.push("/lobby")} className="px-6 py-3 rounded-xl bg-primary text-white font-bold">
          Retour au lobby
        </button>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  const p1Name = state.players[1].name;
  const p2Name = state.players[2]?.name ?? "Joueur 2";

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full gap-4 relative">
      {/* PausePoint Overlay (fullscreen modal) */}
      {karaoke.activePausePoint && song && isPlaying && (
        <PausePointOverlay
          pausePoint={karaoke.activePausePoint}
          lyrics={song.lyrics}
          onSubmit={handlePausePointSubmit}
          onUseInitials={handleUseInitials}
          initialsUsed={initialsUsed}
          initials={initials}
        />
      )}

      {/* Waiting */}
      {state.status === "waiting" && !isLocalMode && (
        <WaitingRoom roomCode={roomId} playerName={playerName} />
      )}
      {state.status === "waiting" && isLocalMode && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-8xl font-extrabold text-accent animate-countdown-tick" key={countdown}>
            {countdown > 0 ? countdown : "GO !"}
          </div>
        </div>
      )}

      {/* ══ PLAYING ══ */}
      {isPlaying && song && (
        <>
          {/* Scores */}
          <ScoreBoard
            state={state}
            currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
            isLocalMode={isLocalMode}
          />

          {/* Song has karaoke: audio + lyrics */}
          {song.hasKaraoke && (
            <div className="w-full flex-1 flex flex-col gap-4">
              {/* Song info + start button */}
              {!karaoke.started && (
                <div className="flex-1 flex flex-col items-center justify-center gap-6 py-8">
                  <div className="text-center space-y-2">
                    <p className="text-xs text-white/40 uppercase tracking-wider">
                      Manche {state.currentRound} / {state.totalRounds}
                    </p>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-accent">
                      {song.title}
                    </h2>
                    <p className="text-xl text-white/60">{song.artist}</p>
                  </div>

                  {karaoke.audioReady && (
                    <button
                      onClick={karaoke.startPlayback}
                      className="px-10 py-5 rounded-2xl bg-accent hover:bg-accent-light text-black font-extrabold text-xl transition-all hover:scale-105 animate-glow-pulse"
                    >
                      Lancer la musique
                    </button>
                  )}

                  {!karaoke.audioReady && !karaoke.audioError && (
                    <div className="flex items-center gap-3 text-white/50">
                      <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Chargement de la musique...
                    </div>
                  )}

                  {karaoke.audioError && (
                    <p className="text-error">Erreur de chargement audio</p>
                  )}
                </div>
              )}

              {/* Karaoke active */}
              {karaoke.started && (
                <div className="w-full flex gap-4 flex-1">
                  {/* Pyramid (desktop) */}
                  <div className="shrink-0 w-32 hidden sm:block">
                    <PointsPyramid
                      pausePoints={song.pausePoints}
                      completedIds={state.karaoke?.completedPausePoints ?? []}
                      scores={state.karaoke?.pausePointScores ?? {}}
                      activePausePointId={karaoke.activePausePoint?.id ?? null}
                      playerId={playerId}
                    />
                  </div>

                  {/* Lyrics */}
                  <div className="flex-1 min-w-0">
                    <KaraokeLyrics
                      lyrics={song.lyrics}
                      activeLineIndex={karaoke.activeLineIndex}
                      pausePoints={song.pausePoints}
                      completedPausePointIds={state.karaoke?.completedPausePoints ?? []}
                      pausePointScores={state.karaoke?.pausePointScores ?? {}}
                      activePausePointId={karaoke.activePausePoint?.id ?? null}
                      playerId={playerId}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No karaoke: fallback text */}
          {!song.hasKaraoke && (
            <div className="text-center py-8 space-y-4">
              <h2 className="text-2xl font-bold text-accent">{song.title}</h2>
              <p className="text-white/60">{song.artist}</p>
              <p className="text-white/40 text-sm">
                Cette chanson n&apos;a pas d&apos;audio synchronisé.
              </p>
              <button
                onClick={handleNextRound}
                className="px-6 py-3 rounded-xl bg-primary text-white font-bold"
              >
                Chanson suivante
              </button>
            </div>
          )}
        </>
      )}

      {/* ══ REVEALING ══ */}
      {state.status === "revealing" && state.roundResults && (
        <div className="w-full space-y-4">
          <ScoreBoard
            state={state}
            currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
            isLocalMode={isLocalMode}
          />
          {song && <SongReveal title={song.title} artist={song.artist} year={song.year} />}
          <RoundResult
            results={state.roundResults}
            player1Name={p1Name}
            player2Name={p2Name}
            blanksCount={song?.blanks.length ?? 0}
          />
          {state.currentRound < state.totalRounds && (
            <button onClick={handleNextRound} className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]">
              Manche suivante
            </button>
          )}
        </div>
      )}

      {/* ══ FINISHED ══ */}
      {state.status === "finished" && (
        <div className="w-full space-y-6 text-center animate-fade-in-up">
          <ScoreBoard
            state={state}
            currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
            isLocalMode={isLocalMode}
          />
          {song && <SongReveal title={song.title} artist={song.artist} year={song.year} />}
          {state.roundResults && (
            <RoundResult
              results={state.roundResults}
              player1Name={p1Name}
              player2Name={p2Name}
              blanksCount={song?.blanks.length ?? 0}
            />
          )}
          <div className="bg-bg-card rounded-2xl p-8 space-y-3">
            <h2 className="text-2xl font-extrabold">Partie terminée !</h2>
            {(() => {
              const s1 = state.players[1].score;
              const s2 = state.players[2]?.score ?? 0;
              if (s1 > s2) return <p className="text-xl"><span className="text-accent font-bold">{p1Name}</span> gagne {s1} à {s2} !</p>;
              if (s2 > s1) return <p className="text-xl"><span className="text-accent font-bold">{p2Name}</span> gagne {s2} à {s1} !</p>;
              return <p className="text-xl text-accent font-bold">Egalité ! {s1} - {s2}</p>;
            })()}
          </div>
          <button
            onClick={() => { sessionStorage.removeItem("localMode"); router.push("/lobby"); }}
            className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]"
          >
            Nouvelle partie
          </button>
        </div>
      )}
    </main>
  );
}
