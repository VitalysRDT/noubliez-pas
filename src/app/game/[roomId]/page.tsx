"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useAudio } from "@/hooks/useAudio";
import { useKaraoke } from "@/hooks/useKaraoke";
import { WaitingRoom } from "@/components/WaitingRoom";
import { ScoreBoard } from "@/components/ScoreBoard";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { AudioPlayerHandle } from "@/components/AudioPlayer";
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

  // Audio
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<AudioPlayerHandle>(null);

  // Initials joker
  const [initialsUsed, setInitialsUsed] = useState(false);
  const [initials, setInitials] = useState<Record<number, string> | null>(null);

  // Pause point result display
  const [ppResultDisplay, setPpResultDisplay] = useState<{
    ppId: string;
    p1Points: number;
    p2Points: number;
  } | null>(null);

  const song = state?.currentSong ?? null;
  const hasAudio = !!song?.audioUrl && !audioError;
  const isKaraokeMode = !!(song?.hasKaraoke && hasAudio);

  const karaoke = useKaraoke({
    lyrics: song?.lyrics ?? [],
    pausePoints: song?.pausePoints ?? [],
    timingOffsetMs: song?.timingOffsetMs ?? 0,
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

  // Set audio ref for karaoke
  useEffect(() => {
    if (audioRef.current) karaoke.setPlayerRef(audioRef.current);
  }, [audioReady, karaoke.setPlayerRef]);

  // Reset on new round
  useEffect(() => {
    if (state?.status === "playing" && prevStatus !== "playing") {
      setAudioReady(false);
      setAudioError(false);
      setInitialsUsed(false);
      setInitials(null);
      setPpResultDisplay(null);
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
            winner:
              p1 > p2
                ? state.players[1].name
                : state.players[2]?.name ?? "",
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
          winner:
            s1 > s2
              ? state.players[1].name
              : state.players[2]?.name ?? "",
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
        // In local mode, submit for both players (same answers for now — they share screen)
        if (isLocalMode) {
          await Promise.all([
            fetch(`/api/rooms/${roomId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: 1,
                pausePointId: ppId,
                answers,
              }),
            }),
            fetch(`/api/rooms/${roomId}/answer`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                playerId: 2,
                pausePointId: ppId,
                answers,
              }),
            }),
          ]);
        } else {
          await fetch(`/api/rooms/${roomId}/answer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              playerId,
              pausePointId: ppId,
              answers,
            }),
          });
        }

        // Refetch state to get updated scores
        await refetch();

        // Show brief result then resume
        setPpResultDisplay({ ppId, p1Points: 0, p2Points: 0 });
        setTimeout(() => {
          setPpResultDisplay(null);
          karaoke.resumeAfterPausePoint(ppId);
        }, 2500);
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
        <button
          onClick={() => router.push("/lobby")}
          className="px-6 py-3 rounded-xl bg-primary text-white font-bold"
        >
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
    <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full gap-4">
      {/* Audio player (invisible, progress bar at bottom) */}
      {hasAudio && song?.audioUrl && state.status === "playing" && (
        <AudioPlayer
          ref={audioRef}
          audioUrl={song.audioUrl}
          onReady={() => setAudioReady(true)}
          onTimeUpdate={karaoke.handleTimeUpdate}
          onEnded={() => {
            // Song finished — finalize round if not already
          }}
          onError={() => setAudioError(true)}
        />
      )}

      {/* Pause Point Overlay */}
      {karaoke.activePausePoint && song && state.status === "playing" && (
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
          <div
            className="text-8xl font-extrabold text-accent animate-countdown-tick"
            key={countdown}
          >
            {countdown > 0 ? countdown : "GO !"}
          </div>
        </div>
      )}

      {/* ── Playing ── */}
      {state.status === "playing" && (
        <>
          {/* Scores */}
          <div className="w-full">
            <ScoreBoard
              state={state}
              currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
              isLocalMode={isLocalMode}
            />
          </div>

          {/* Points Pyramid + Karaoke side by side */}
          {isKaraokeMode && song && (
            <div className="w-full flex gap-4">
              {/* Pyramid */}
              <div className="shrink-0 w-36 hidden sm:block">
                <PointsPyramid
                  pausePoints={song.pausePoints}
                  completedIds={
                    state.karaoke?.completedPausePoints ?? []
                  }
                  scores={state.karaoke?.pausePointScores ?? {}}
                  activePausePointId={karaoke.activePausePoint?.id ?? null}
                  playerId={playerId}
                />
              </div>

              {/* Karaoke lyrics */}
              <div className="flex-1 min-w-0">
                {!karaoke.started && audioReady && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold text-accent">
                        {song.title}
                      </h3>
                      <p className="text-white/50">{song.artist}</p>
                    </div>
                    <button
                      onClick={karaoke.startPlayback}
                      className="px-8 py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-105 animate-glow-pulse"
                    >
                      Lancer la musique
                    </button>
                  </div>
                )}

                {!audioReady && !audioError && (
                  <div className="text-center text-white/50 py-8 flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    Chargement...
                  </div>
                )}

                {karaoke.started && (
                  <KaraokeLyrics
                    lyrics={song.lyrics}
                    activeLineIndex={karaoke.activeLineIndex}
                    pausePoints={song.pausePoints}
                    completedPausePointIds={
                      state.karaoke?.completedPausePoints ?? []
                    }
                    pausePointScores={
                      state.karaoke?.pausePointScores ?? {}
                    }
                    activePausePointId={
                      karaoke.activePausePoint?.id ?? null
                    }
                    playerId={playerId}
                  />
                )}
              </div>
            </div>
          )}

          {/* Non-karaoke fallback: song has no audio */}
          {!isKaraokeMode && song && (
            <div className="text-center py-8 text-white/50">
              Cette chanson n&apos;a pas d&apos;audio. Passez à la suivante.
              <button
                onClick={handleNextRound}
                className="block mx-auto mt-4 px-6 py-3 rounded-xl bg-primary text-white font-bold"
              >
                Chanson suivante
              </button>
            </div>
          )}

          {/* PP result flash */}
          {ppResultDisplay && (
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-bg-dark/90 border border-white/20 rounded-2xl px-8 py-6 text-center animate-fade-in-up">
              <p className="text-lg font-bold text-white">
                Résultat du palier
              </p>
              {/* This will be filled by the refetched state */}
            </div>
          )}
        </>
      )}

      {/* ── Revealing ── */}
      {state.status === "revealing" && state.roundResults && (
        <div className="w-full space-y-4">
          <ScoreBoard
            state={state}
            currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
            isLocalMode={isLocalMode}
          />
          {song && (
            <SongReveal
              title={song.title}
              artist={song.artist}
              year={song.year}
            />
          )}
          {song && (
            <KaraokeLyrics
              lyrics={song.lyrics}
              activeLineIndex={999}
              pausePoints={song.pausePoints}
              completedPausePointIds={song.pausePoints.map((p) => p.id)}
              pausePointScores={
                state.karaoke?.pausePointScores ?? {}
              }
              activePausePointId={null}
              playerId={playerId}
            />
          )}
          <RoundResult
            results={state.roundResults}
            player1Name={p1Name}
            player2Name={p2Name}
            blanksCount={song?.blanks.length ?? 0}
          />
          {state.currentRound < state.totalRounds && (
            <button
              onClick={handleNextRound}
              className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]"
            >
              Manche suivante
            </button>
          )}
        </div>
      )}

      {/* ── Finished ── */}
      {state.status === "finished" && (
        <div className="w-full space-y-6 text-center animate-fade-in-up">
          <ScoreBoard
            state={state}
            currentPlayerId={isLocalMode ? (0 as unknown as 1) : playerId}
            isLocalMode={isLocalMode}
          />
          {song && (
            <SongReveal
              title={song.title}
              artist={song.artist}
              year={song.year}
            />
          )}
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
              if (s1 > s2)
                return (
                  <p className="text-xl">
                    <span className="text-accent font-bold">{p1Name}</span>{" "}
                    gagne {s1} à {s2} !
                  </p>
                );
              if (s2 > s1)
                return (
                  <p className="text-xl">
                    <span className="text-accent font-bold">{p2Name}</span>{" "}
                    gagne {s2} à {s1} !
                  </p>
                );
              return (
                <p className="text-xl text-accent font-bold">
                  Egalité ! {s1} - {s2}
                </p>
              );
            })()}
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("localMode");
              router.push("/lobby");
            }}
            className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]"
          >
            Nouvelle partie
          </button>
        </div>
      )}
    </main>
  );
}
