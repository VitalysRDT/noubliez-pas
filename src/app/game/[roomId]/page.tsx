"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useRoom } from "@/hooks/useRoom";
import { useGameState } from "@/hooks/useGameState";
import { useAudio } from "@/hooks/useAudio";
import { WaitingRoom } from "@/components/WaitingRoom";
import { ScoreBoard } from "@/components/ScoreBoard";
import { Timer } from "@/components/Timer";
import { LyricsDisplay } from "@/components/LyricsDisplay";
import { RoundResult } from "@/components/RoundResult";
import { SongReveal } from "@/components/SongReveal";
import type { GameState } from "@/lib/types";

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

  // Load player info from sessionStorage
  useEffect(() => {
    const id = sessionStorage.getItem("playerId");
    const name = sessionStorage.getItem("playerName");
    if (id) setPlayerId(Number(id) as 1 | 2);
    if (name) setPlayerName(name);
  }, []);

  // Handle status transitions
  useEffect(() => {
    if (!state) return;
    if (state.status === prevStatus) return;

    // Countdown → playing transition
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
          // Trigger first round
          fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
        }
      }, 1000);
    }

    // New round started
    if (state.status === "playing" && prevStatus !== "playing") {
      resetRound();
      play("roundStart", {
        round: state.currentRound,
        total: state.totalRounds,
      });
    }

    // Round revealed
    if (state.status === "revealing" && prevStatus !== "revealing") {
      if (state.currentSong && state.roundResults) {
        const p1 = state.roundResults.player1Correct;
        const p2 = state.roundResults.player2Correct;
        if (p1 === p2) {
          play("tie", {});
        } else {
          const winnerId = p1 > p2 ? 1 : 2;
          const winnerName =
            winnerId === 1
              ? state.players[1].name
              : state.players[2]?.name ?? "";
          play("roundEnd", {
            winner: winnerName,
            score: Math.max(p1, p2),
            title: state.currentSong.title,
            artist: state.currentSong.artist,
          });
        }
      }
    }

    // Game finished
    if (state.status === "finished" && prevStatus !== "finished") {
      const s1 = state.players[1].score;
      const s2 = state.players[2]?.score ?? 0;
      if (s1 !== s2) {
        const winnerId = s1 > s2 ? 1 : 2;
        const winnerName =
          winnerId === 1
            ? state.players[1].name
            : state.players[2]?.name ?? "";
        play("gameEnd", {
          winner: winnerName,
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
    if (!submitted) {
      handleSubmit();
    }
  }, [submitted, handleSubmit]);

  const handleNextRound = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
    } catch (err) {
      console.error("Next round error:", err);
    }
  }, [roomId]);

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
      {/* Waiting state */}
      {state.status === "waiting" && (
        <WaitingRoom roomCode={roomId} playerName={playerName} />
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-8xl font-extrabold text-accent animate-countdown-tick" key={countdown}>
            {countdown > 0 ? countdown : "GO !"}
          </div>
        </div>
      )}

      {/* Playing / Revealing / Finished */}
      {(state.status === "playing" ||
        state.status === "revealing" ||
        state.status === "finished") && (
        <>
          {/* Score + Timer bar */}
          <div className="w-full space-y-3">
            <ScoreBoard state={state} currentPlayerId={playerId} />
            {state.status === "playing" && (
              <div className="flex justify-center">
                <Timer
                  deadline={state.roundDeadline}
                  onExpired={handleTimerExpired}
                />
              </div>
            )}
          </div>

          {/* Lyrics */}
          {state.currentSong && (
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

          {/* Submit button */}
          {state.status === "playing" && !submitted && (
            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02]"
            >
              Valider mes réponses
            </button>
          )}
          {state.status === "playing" && submitted && (
            <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              En attente de l&apos;adversaire...
            </div>
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
                <h2 className="text-2xl font-extrabold">Partie terminée !</h2>
                {(() => {
                  const s1 = state.players[1].score;
                  const s2 = state.players[2]?.score ?? 0;
                  if (s1 > s2) {
                    return (
                      <p className="text-xl">
                        <span className="text-accent font-bold">
                          {state.players[1].name}
                        </span>{" "}
                        gagne {s1} à {s2} !
                      </p>
                    );
                  }
                  if (s2 > s1) {
                    return (
                      <p className="text-xl">
                        <span className="text-accent font-bold">
                          {state.players[2]?.name}
                        </span>{" "}
                        gagne {s2} à {s1} !
                      </p>
                    );
                  }
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
