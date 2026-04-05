"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useGameState } from "@/hooks/useGameState";
import { useAudio } from "@/hooks/useAudio";
import { WaitingRoom } from "@/components/WaitingRoom";
import { ScoreBoard } from "@/components/ScoreBoard";
import { Timer } from "@/components/Timer";
import { LyricsDisplay } from "@/components/LyricsDisplay";
import { KaraokeLyrics } from "@/components/KaraokeLyrics";
import { RoundResult } from "@/components/RoundResult";
import { SongReveal } from "@/components/SongReveal";
import { buildKaraokeLines, onTimeUpdate } from "@/lib/karaoke-engine";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { state, error: roomError } = useRoom(roomId);
  const { answers, setAnswer, submitted, setSubmitted, resetRound } =
    useGameState();
  const { play } = useAudio();

  const [playerId, setPlayerId] = useState<1 | 2>(1);
  const [playerName, setPlayerName] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);

  // Karaoke state
  const [karaokeReady, setKaraokeReady] = useState(false);
  const [karaokeStarted, setKaraokeStarted] = useState(false);
  const [activeLineIndex, setActiveLineIndex] = useState(0);
  const [pausedForLine, setPausedForLine] = useState<number | null>(null);
  const [karaokeError, setKaraokeError] = useState(false);
  const pausedLinesRef = useRef<Set<number>>(new Set());
  const ytPlayerRef = useRef<YT.Player | null>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isKaraokeMode =
    state?.currentSong?.hasKaraoke && !karaokeError;

  // Load player info
  useEffect(() => {
    const id = sessionStorage.getItem("playerId");
    const name = sessionStorage.getItem("playerName");
    if (id) setPlayerId(Number(id) as 1 | 2);
    if (name) setPlayerName(name);
  }, []);

  // Reset karaoke state on new round
  useEffect(() => {
    if (state?.status === "playing" && prevStatus !== "playing") {
      setKaraokeReady(false);
      setKaraokeStarted(false);
      setActiveLineIndex(0);
      setPausedForLine(null);
      setKaraokeError(false);
      pausedLinesRef.current = new Set();
      if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    }
  }, [state?.status, prevStatus]);

  // Initialize YouTube player when karaoke song loaded
  useEffect(() => {
    if (
      !state?.currentSong?.hasKaraoke ||
      !state.currentSong.youtubeId ||
      state.status !== "playing" ||
      karaokeError
    )
      return;

    const videoId = state.currentSong.youtubeId;

    let mounted = true;

    async function loadYT() {
      // Load YouTube IFrame API if not already loaded
      if (!window.YT?.Player) {
        await new Promise<void>((resolve) => {
          if (window.YT?.Player) {
            resolve();
            return;
          }
          const prev = window.onYouTubeIframeAPIReady;
          window.onYouTubeIframeAPIReady = () => {
            prev?.();
            resolve();
          };
          if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const tag = document.createElement("script");
            tag.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(tag);
          }
        });
      }

      if (!mounted || !ytContainerRef.current) return;

      // Destroy previous player
      ytPlayerRef.current?.destroy();

      ytPlayerRef.current = new window.YT.Player(ytContainerRef.current, {
        width: 200,
        height: 112,
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            if (mounted) setKaraokeReady(true);
          },
          onError: () => {
            if (mounted) setKaraokeError(true);
          },
        },
      });
    }

    loadYT();

    return () => {
      mounted = false;
    };
  }, [state?.currentSong?.hasKaraoke, state?.currentSong?.youtubeId, state?.status, karaokeError]);

  // Karaoke time polling
  useEffect(() => {
    if (!karaokeStarted || !state?.currentSong?.hasKaraoke || karaokeError) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const song = state.currentSong;
    const karaokeLines = buildKaraokeLines(song.lyrics, song.blanks);
    const offsetMs = song.timingOffsetMs ?? 0;

    pollingRef.current = setInterval(() => {
      if (!ytPlayerRef.current?.getCurrentTime) return;
      const currentMs = ytPlayerRef.current.getCurrentTime() * 1000 + offsetMs;
      const action = onTimeUpdate(currentMs, karaokeLines, pausedLinesRef.current);

      if (action.type === "UPDATE_ACTIVE_LINE") {
        setActiveLineIndex(action.lineIndex);
      } else if (action.type === "PAUSE_FOR_BLANKS") {
        // Pause music
        ytPlayerRef.current?.pauseVideo();
        pausedLinesRef.current.add(action.lineIndex);
        setPausedForLine(action.lineIndex);
        setActiveLineIndex(action.lineIndex);

        // Start 15s timer for this line
        if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
        lineTimerRef.current = setTimeout(() => {
          // Auto-resume after 15s
          resumeAfterBlanks();
        }, 15000);
      }
    }, 100);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [karaokeStarted, state?.currentSong, karaokeError]);

  function startKaraokePlayback() {
    if (ytPlayerRef.current) {
      ytPlayerRef.current.playVideo();
      setKaraokeStarted(true);
    }
  }

  function resumeAfterBlanks() {
    setPausedForLine(null);
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    ytPlayerRef.current?.playVideo();
  }

  // Handle status transitions
  useEffect(() => {
    if (!state) return;
    if (state.status === prevStatus) return;

    if (state.status === "countdown" && prevStatus !== "countdown") {
      setCountdown(3);
      play("welcome", {
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
      play("roundStart", {
        round: state.currentRound,
        total: state.totalRounds,
      });
    }

    if (state.status === "revealing" && prevStatus !== "revealing") {
      // Stop YouTube if playing
      ytPlayerRef.current?.pauseVideo();

      if (state.currentSong && state.roundResults) {
        const p1 = state.roundResults.player1Correct;
        const p2 = state.roundResults.player2Correct;
        if (p1 === p2) {
          play("tie", {});
        } else {
          const winnerId = p1 > p2 ? 1 : 2;
          play("roundEnd", {
            winner:
              winnerId === 1
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
      ytPlayerRef.current?.pauseVideo();
      const s1 = state.players[1].score;
      const s2 = state.players[2]?.score ?? 0;
      if (s1 !== s2) {
        play("gameEnd", {
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
  }, [state, prevStatus, roomId, resetRound, play]);

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

  // Submit current line answers in karaoke mode and resume
  const handleKaraokeLineSubmit = useCallback(() => {
    resumeAfterBlanks();
  }, []);

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
      {/* YouTube player (hidden mini player) */}
      {isKaraokeMode && state.status === "playing" && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl border border-white/10 opacity-40 hover:opacity-90 transition-opacity">
          <div ref={ytContainerRef} />
        </div>
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

      {/* Playing / Revealing / Finished */}
      {(state.status === "playing" ||
        state.status === "revealing" ||
        state.status === "finished") && (
        <>
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

          {/* Karaoke: "Start music" button */}
          {isKaraokeMode &&
            state.status === "playing" &&
            karaokeReady &&
            !karaokeStarted && (
              <button
                onClick={startKaraokePlayback}
                className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02] animate-glow-pulse"
              >
                Lancer la musique
              </button>
            )}

          {/* Karaoke lyrics */}
          {isKaraokeMode && state.currentSong && karaokeStarted && (
            <div className="flex-1 w-full">
              <KaraokeLyrics
                lyrics={state.currentSong.lyrics}
                blanks={state.currentSong.blanks}
                activeLineIndex={activeLineIndex}
                pausedForLineIndex={pausedForLine}
                answers={answers}
                onAnswerChange={setAnswer}
                disabled={submitted || state.status !== "playing"}
                roundResults={state.roundResults}
                playerId={playerId}
              />
              {pausedForLine !== null && state.status === "playing" && (
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={handleKaraokeLineSubmit}
                    className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition-all hover:scale-[1.02]"
                  >
                    Valider et continuer
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Standard (non-karaoke) lyrics */}
          {!isKaraokeMode && state.currentSong && (
            <div className="flex-1 w-full overflow-y-auto py-4">
              <LyricsDisplay
                lyrics={state.currentSong.lyrics}
                blanks={state.currentSong.blanks}
                answers={answers}
                onAnswerChange={setAnswer}
                disabled={submitted || state.status !== "playing"}
                roundResults={state.roundResults}
                playerId={playerId}
              />
            </div>
          )}

          {/* Submit (non-karaoke) */}
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

          {/* Submit all (karaoke — at song end) */}
          {isKaraokeMode &&
            karaokeStarted &&
            state.status === "playing" &&
            !submitted &&
            pausedForLine === null && (
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
              {state.currentSong && (
                <SongReveal
                  title={state.currentSong.title}
                  artist={state.currentSong.artist}
                  year={state.currentSong.year}
                />
              )}
              <RoundResult
                results={state.roundResults}
                player1Name={state.players[1].name}
                player2Name={state.players[2]?.name ?? "Joueur 2"}
                blanksCount={state.currentSong?.blanks.length ?? 0}
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
              {state.currentSong && (
                <SongReveal
                  title={state.currentSong.title}
                  artist={state.currentSong.artist}
                  year={state.currentSong.year}
                />
              )}
              {state.roundResults && (
                <RoundResult
                  results={state.roundResults}
                  player1Name={state.players[1].name}
                  player2Name={state.players[2]?.name ?? "Joueur 2"}
                  blanksCount={state.currentSong?.blanks.length ?? 0}
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
