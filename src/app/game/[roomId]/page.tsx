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
import { SplitScreenLayout } from "@/components/SplitScreenLayout";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const { state, error: roomError } = useRoom(roomId);
  const p1State = useGameState();
  const p2State = useGameState();
  const { play: playTts } = useAudio();

  const [playerId, setPlayerId] = useState<1 | 2>(1);
  const [playerName, setPlayerName] = useState("");
  const [isLocalMode, setIsLocalMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);

  // Audio / karaoke
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<AudioPlayerHandle>(null);

  const song = state?.currentSong ?? null;
  const hasAudio = !!song?.audioUrl && !audioError;
  const isKaraokeMode = !!(song?.hasKaraoke && hasAudio);

  const karaoke = useKaraoke({
    lyrics: song?.lyrics ?? [],
    blanks: song?.blanks ?? [],
    timingOffsetMs: song?.timingOffsetMs ?? 0,
  });

  // Aliases for online mode (uses p1State only)
  const answers = p1State.answers;
  const setAnswer = p1State.setAnswer;
  const submitted = isLocalMode ? localSubmitted : p1State.submitted;

  // Load player info
  useEffect(() => {
    const local = sessionStorage.getItem("localMode") === "true";
    setIsLocalMode(local);
    if (local) {
      setPlayerName(sessionStorage.getItem("player1Name") ?? "");
    } else {
      const id = sessionStorage.getItem("playerId");
      const name = sessionStorage.getItem("playerName");
      if (id) setPlayerId(Number(id) as 1 | 2);
      if (name) setPlayerName(name);
    }
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
      setLocalSubmitted(false);
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
      p1State.resetRound();
      p2State.resetRound();
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
  }, [state, prevStatus, roomId, p1State, p2State, playTts, karaoke]);

  // ── Submit (online mode) ──
  const handleSubmit = useCallback(async () => {
    if (p1State.submitted) return;
    p1State.setSubmitted(true);
    try {
      await fetch(`/api/rooms/${roomId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, answers: p1State.answers }),
      });
    } catch (err) {
      console.error("Submit error:", err);
      p1State.setSubmitted(false);
    }
  }, [p1State, roomId, playerId]);

  // ── Submit (local mode — both players at once) ──
  const handleSubmitLocal = useCallback(async () => {
    if (localSubmitted) return;
    setLocalSubmitted(true);
    try {
      await Promise.all([
        fetch(`/api/rooms/${roomId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: 1, answers: p1State.answers }),
        }),
        fetch(`/api/rooms/${roomId}/answer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: 2, answers: p2State.answers }),
        }),
      ]);
    } catch (err) {
      console.error("Submit local error:", err);
      setLocalSubmitted(false);
    }
  }, [localSubmitted, roomId, p1State.answers, p2State.answers]);

  const handleTimerExpired = useCallback(() => {
    if (isLocalMode) {
      if (!localSubmitted) handleSubmitLocal();
    } else {
      if (!p1State.submitted) handleSubmit();
    }
  }, [isLocalMode, localSubmitted, handleSubmitLocal, p1State.submitted, handleSubmit]);

  const handleNextRound = useCallback(async () => {
    try {
      await fetch(`/api/rooms/${roomId}/next`, { method: "POST" });
    } catch (err) {
      console.error("Next round error:", err);
    }
  }, [roomId]);

  // ── Error / loading ──
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

  // ── Render helpers ──
  const p1Name = state.players[1].name;
  const p2Name = state.players[2]?.name ?? "Joueur 2";
  const isPlaying = state.status === "playing";
  const isDisabled = submitted || !isPlaying;

  function renderLyricsPanel(pId: 1 | 2, pState: typeof p1State, cId: string, autoFocus: boolean) {
    if (!song || !state) return null;
    if (isKaraokeMode && karaoke.started) {
      return (
        <KaraokeLyrics
          lyrics={song.lyrics}
          blanks={song.blanks}
          activeLineIndex={karaoke.activeLineIndex}
          pausedForLineIndex={karaoke.pausedForLine}
          answers={pState.answers}
          onAnswerChange={pState.setAnswer}
          disabled={isDisabled}
          roundResults={state.roundResults}
          playerId={pId}
          containerId={cId}
        />
      );
    }
    return (
      <LyricsDisplay
        lyrics={song.lyrics}
        blanks={song.blanks}
        answers={pState.answers}
        onAnswerChange={pState.setAnswer}
        disabled={isDisabled}
        roundResults={state.roundResults}
        playerId={pId}
        containerId={cId}
        autoFocusEnabled={autoFocus}
      />
    );
  }

  return (
    <main className={`flex-1 flex flex-col items-center px-4 py-6 mx-auto w-full gap-4 ${isLocalMode ? "max-w-5xl" : "max-w-2xl"}`}>
      {/* Audio player */}
      {hasAudio && song?.audioUrl && isPlaying && (
        <AudioPlayer
          ref={audioRef}
          audioUrl={song.audioUrl}
          onReady={() => setAudioReady(true)}
          onTimeUpdate={karaoke.handleTimeUpdate}
          onEnded={() => {
            if (isLocalMode) {
              if (!localSubmitted) handleSubmitLocal();
            } else {
              if (!p1State.submitted) handleSubmit();
            }
          }}
          onError={() => setAudioError(true)}
        />
      )}

      {/* Waiting (online only) */}
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

      {/* ── Playing / Revealing / Finished ── */}
      {(isPlaying ||
        state.status === "revealing" ||
        state.status === "finished") && (
        <>
          {/* Scoreboard + timer */}
          <div className="w-full space-y-3">
            <ScoreBoard state={state} currentPlayerId={isLocalMode ? 0 as unknown as 1 : playerId} isLocalMode={isLocalMode} />
            {isPlaying && !isKaraokeMode && (
              <div className="flex justify-center">
                <Timer
                  deadline={state.roundDeadline}
                  onExpired={handleTimerExpired}
                />
              </div>
            )}
          </div>

          {/* Karaoke: Start button */}
          {isKaraokeMode && isPlaying && audioReady && !karaoke.started && (
            <button
              onClick={karaoke.startPlayback}
              className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02] animate-glow-pulse"
            >
              Lancer la musique
            </button>
          )}

          {/* Loading audio */}
          {isKaraokeMode && isPlaying && !audioReady && !audioError && (
            <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              Chargement de la musique...
            </div>
          )}

          {/* ══════ LOCAL MODE: Split Screen ══════ */}
          {isLocalMode && song && isPlaying && (!isKaraokeMode || karaoke.started) && (
            <>
              <SplitScreenLayout
                player1Name={p1Name}
                player2Name={p2Name}
                player1HasAnswers={Object.keys(p1State.answers).length > 0}
                player2HasAnswers={Object.keys(p2State.answers).length > 0}
                onSubmitBoth={handleSubmitLocal}
                submitted={localSubmitted}
                disabled={!isPlaying}
                player1Panel={renderLyricsPanel(1, p1State, "p1-lyrics", true)}
                player2Panel={renderLyricsPanel(2, p2State, "p2-lyrics", false)}
              />
              {isKaraokeMode && karaoke.pausedForLine !== null && (
                <button
                  onClick={karaoke.resumePlayback}
                  className="w-full py-3 rounded-xl bg-primary hover:bg-primary-light font-bold transition-all hover:scale-[1.02]"
                >
                  Continuer la musique
                </button>
              )}
            </>
          )}

          {/* Local mode: revealing lyrics (show both results) */}
          {isLocalMode && song && (state.status === "revealing" || state.status === "finished") && (
            <SplitScreenLayout
              player1Name={p1Name}
              player2Name={p2Name}
              player1HasAnswers={false}
              player2HasAnswers={false}
              onSubmitBoth={() => {}}
              submitted={false}
              disabled
              player1Panel={renderLyricsPanel(1, p1State, "p1-lyrics-r", false)}
              player2Panel={renderLyricsPanel(2, p2State, "p2-lyrics-r", false)}
            />
          )}

          {/* ══════ ONLINE MODE: Single Screen ══════ */}
          {!isLocalMode && song && isPlaying && (
            <>
              {/* Karaoke lyrics (online) */}
              {isKaraokeMode && karaoke.started && (
                <div className="flex-1 w-full">
                  <KaraokeLyrics
                    lyrics={song.lyrics}
                    blanks={song.blanks}
                    activeLineIndex={karaoke.activeLineIndex}
                    pausedForLineIndex={karaoke.pausedForLine}
                    answers={answers}
                    onAnswerChange={setAnswer}
                    disabled={isDisabled}
                    roundResults={state.roundResults}
                    playerId={playerId}
                  />
                  {karaoke.pausedForLine !== null && (
                    <button
                      onClick={karaoke.resumePlayback}
                      className="w-full mt-3 py-3 rounded-xl bg-accent hover:bg-accent-light text-black font-bold transition-all hover:scale-[1.02]"
                    >
                      Valider et continuer
                    </button>
                  )}
                </div>
              )}

              {/* Standard lyrics (online) */}
              {!isKaraokeMode && (
                <div className="flex-1 w-full overflow-y-auto py-4">
                  <LyricsDisplay
                    lyrics={song.lyrics}
                    blanks={song.blanks}
                    answers={answers}
                    onAnswerChange={setAnswer}
                    disabled={isDisabled}
                    roundResults={state.roundResults}
                    playerId={playerId}
                  />
                </div>
              )}

              {/* Submit (online, non-karaoke) */}
              {!isKaraokeMode && !p1State.submitted && (
                <button
                  onClick={handleSubmit}
                  className="w-full py-4 rounded-xl bg-accent hover:bg-accent-light text-black font-bold text-lg transition-all hover:scale-[1.02]"
                >
                  Valider mes réponses
                </button>
              )}
              {!isKaraokeMode && p1State.submitted && (
                <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  En attente de l&apos;adversaire...
                </div>
              )}

              {/* Submit all (online, karaoke end) */}
              {isKaraokeMode && karaoke.started && !p1State.submitted && karaoke.pausedForLine === null && (
                <button
                  onClick={handleSubmit}
                  className="w-full py-3 rounded-xl bg-primary/80 hover:bg-primary text-white font-bold transition-all text-sm"
                >
                  Valider toutes mes réponses
                </button>
              )}
            </>
          )}

          {/* Online: revealing lyrics */}
          {!isLocalMode && song && state.status === "revealing" && (
            <div className="flex-1 w-full overflow-y-auto py-4">
              <LyricsDisplay
                lyrics={song.lyrics}
                blanks={song.blanks}
                answers={answers}
                onAnswerChange={() => {}}
                disabled
                roundResults={state.roundResults}
                playerId={playerId}
              />
            </div>
          )}

          {/* Round results (shared) */}
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

          {/* Game finished (shared) */}
          {state.status === "finished" && (
            <div className="w-full space-y-6 text-center animate-fade-in-up">
              {song && (
                <SongReveal title={song.title} artist={song.artist} year={song.year} />
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
                        <span className="text-accent font-bold">{p1Name}</span> gagne {s1} à {s2} !
                      </p>
                    );
                  if (s2 > s1)
                    return (
                      <p className="text-xl">
                        <span className="text-accent font-bold">{p2Name}</span> gagne {s2} à {s1} !
                      </p>
                    );
                  return <p className="text-xl text-accent font-bold">Egalité parfaite ! {s1} - {s2}</p>;
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
        </>
      )}
    </main>
  );
}
