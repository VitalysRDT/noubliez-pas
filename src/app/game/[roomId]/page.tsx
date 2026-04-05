"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useGameState } from "@/hooks/useGameState";
import { useAudio } from "@/hooks/useAudio";
import { useKaraoke } from "@/hooks/useKaraoke";
import { WaitingRoom } from "@/components/WaitingRoom";
import { ScoreBoard } from "@/components/ScoreBoard";
import { Timer } from "@/components/Timer";
import { LyricsDisplay } from "@/components/LyricsDisplay";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { AudioPlayer } from "@/components/AudioPlayer";
import type { AudioPlayerHandle } from "@/components/AudioPlayer";
import { RoundResult } from "@/components/RoundResult";
import { SongReveal } from "@/components/SongReveal";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { state, error: roomError } = useRoom(roomId);
  const gameState = useGameState();
  const { answers, setAnswer, submitted, setSubmitted, resetRound } = gameState;
  const { play: playTts } = useAudio();

  const [playerId, setPlayerId] = useState<1 | 2>(1);
  const [playerName, setPlayerName] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  // Audio / karaoke
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<AudioPlayerHandle>(null);

  const song = state?.currentSong ?? null;
  const hasAudio = !!(song?.audioUrl) && !audioError;
  const isKaraokeMode = !!(song?.hasKaraoke && hasAudio);

  const karaoke = useKaraoke({
    lyrics: song?.lyrics ?? [],
    blanks: song?.blanks ?? [],
    timingOffsetMs: song?.timingOffsetMs ?? 0,
  });

  // Load player info
  useEffect(() => {
    const id = sessionStorage.getItem("playerId");
    const name = sessionStorage.getItem("playerName");
    if (id) setPlayerId(Number(id) as 1 | 2);
    if (name) setPlayerName(name);
  }, []);

  // Set audio ref for karaoke hook
  useEffect(() => {
    if (audioRef.current) {
      karaoke.setPlayerRef(audioRef.current);
    }
  }, [audioReady, karaoke.setPlayerRef]);

  // Reset on new round
  useEffect(() => {
    if (state?.status === "playing" && prevStatus !== "playing") {
      setAudioReady(false);
      setAudioError(false);
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
      resetRound();
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
  }, [state, prevStatus, roomId, resetRound, playTts, karaoke]);

  // ── Submit answers ──
  const handleSubmit = useCallback(async () => {
    if (submitted) return;
    setSubmitted(true);
    try {
      await fetch(`/api/rooms/${roomId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, answers }),
      });
    } catch (err) {
      console.error("Submit error:", err);
      setSubmitted(false);
    }
  }, [submitted, setSubmitted, roomId, playerId, answers]);

  const handleTimerExpired = useCallback(() => {
    if (!submitted) handleSubmit();
  }, [submitted, handleSubmit]);

  const handleNextRound = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
    } catch (err) {
      console.error("Next round error:", err);
    }
  }, [roomId]);

  // ── Error / loading states ──
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

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-6 max-w-2xl mx-auto w-full gap-4">
      {/* Audio player (invisible except progress bar) */}
      {hasAudio && song?.audioUrl && state.status === "playing" && (
        <AudioPlayer
          ref={audioRef}
          audioUrl={song.audioUrl}
          onReady={() => setAudioReady(true)}
          onTimeUpdate={karaoke.handleTimeUpdate}
          onEnded={() => {
            if (!submitted) handleSubmit();
          }}
          onError={() => setAudioError(true)}
        />
      )}

      {/* Waiting */}
      {state.status === "waiting" && (
        <WaitingRoom roomCode={roomId} playerName={playerName} />
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

      {/* ── Playing / Revealing / Finished ── */}
      {(state.status === "playing" ||
        state.status === "revealing" ||
        state.status === "finished") && (
        <>
          {/* Scoreboard + timer */}
          <div className="w-full space-y-3">
            <ScoreBoard state={state} currentPlayerId={playerId} />
            {state.status === "playing" && !isKaraokeMode && (
              <div className="flex justify-center">
                <Timer
                  deadline={state.roundDeadline}
                  onExpired={handleTimerExpired}
                />
              </div>
            )}
          </div>

          {/* Karaoke: Start button */}
          {isKaraokeMode &&
            state.status === "playing" &&
            audioReady &&
            !karaoke.started && (
              <button
                onClick={karaoke.startPlayback}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02] animate-glow-pulse"
              >
                Lancer la musique
              </button>
            )}

          {/* Loading audio indicator */}
          {isKaraokeMode &&
            state.status === "playing" &&
            !audioReady &&
            !audioError && (
              <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                Chargement de la musique...
              </div>
            )}

          {/* Karaoke lyrics */}
          {isKaraokeMode && song && karaoke.started && (
            <div className="flex-1 w-full">
              <KaraokeLyrics
                lyrics={song.lyrics}
                blanks={song.blanks}
                activeLineIndex={karaoke.activeLineIndex}
                pausedForLineIndex={karaoke.pausedForLine}
                answers={answers}
                onAnswerChange={setAnswer}
                disabled={submitted || state.status !== "playing"}
                roundResults={state.roundResults}
                playerId={playerId}
              />
              {karaoke.pausedForLine !== null &&
                state.status === "playing" && (
                  <button
                    onClick={karaoke.resumePlayback}
                    className="w-full mt-3 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition-all hover:scale-[1.02]"
                  >
                    Valider et continuer
                  </button>
                )}
            </div>
          )}

          {/* Standard lyrics (no audio) */}
          {!isKaraokeMode && song && (
            <div className="flex-1 w-full overflow-y-auto py-4">
              <LyricsDisplay
                lyrics={song.lyrics}
                blanks={song.blanks}
                answers={answers}
                onAnswerChange={setAnswer}
                disabled={submitted || state.status !== "playing"}
                roundResults={state.roundResults}
                playerId={playerId}
              />
            </div>
          )}

          {/* Submit button (non-karaoke) */}
          {!isKaraokeMode &&
            state.status === "playing" &&
            !submitted && (
              <button
                onClick={handleSubmit}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02]"
              >
                Valider mes réponses
              </button>
            )}
          {!isKaraokeMode &&
            state.status === "playing" &&
            submitted && (
              <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                En attente de l&apos;adversaire...
              </div>
            )}

          {/* Submit all (karaoke end) */}
          {isKaraokeMode &&
            karaoke.started &&
            state.status === "playing" &&
            !submitted &&
            karaoke.pausedForLine === null && (
              <button
                onClick={handleSubmit}
                className="w-full py-3 rounded-xl bg-primary/80 hover:bg-primary text-white font-bold transition-all text-sm"
              >
                Valider toutes mes réponses
              </button>
            )}

          {/* Round results */}
          {state.status === "revealing" && state.roundResults && (
            <div className="w-full space-y-4">
              {song && (
                <SongReveal
                  title={song.title}
                  artist={song.artist}
                  year={song.year}
                />
              )}
              <RoundResult
                results={state.roundResults}
                player1Name={state.players[1].name}
                player2Name={state.players[2]?.name ?? "Joueur 2"}
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

          {/* Game finished */}
          {state.status === "finished" && (
            <div className="w-full space-y-6 text-center animate-fade-in-up">
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
                  player1Name={state.players[1].name}
                  player2Name={state.players[2]?.name ?? "Joueur 2"}
                  blanksCount={song?.blanks.length ?? 0}
                />
              )}
              <div className="bg-bg-card rounded-2xl p-8 space-y-3">
                <h2 className="text-2xl font-extrabold">
                  Partie terminée !
                </h2>
                {(() => {
                  const s1 = state.players[1].score;
                  const s2 = state.players[2]?.score ?? 0;
                  if (s1 > s2)
                    return (
                      <p className="text-xl">
                        <span className="text-accent font-bold">
                          {state.players[1].name}
                        </span>{" "}
                        gagne {s1} à {s2} !
                      </p>
                    );
                  if (s2 > s1)
                    return (
                      <p className="text-xl">
                        <span className="text-accent font-bold">
                          {state.players[2]?.name}
                        </span>{" "}
                        gagne {s2} à {s1} !
                      </p>
                    );
                  return (
                    <p className="text-xl text-accent font-bold">
                      Egalité parfaite ! {s1} - {s2}
                    </p>
                  );
                })()}
              </div>
              <button
                onClick={() => router.push("/lobby")}
                className="w-full py-4 rounded-xl bg-primary hover:bg-primary-light font-bold text-lg transition-all hover:scale-[1.02]"
              >
                Nouvelle partie
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
