import { matchAnswer } from "./fuzzy-match";
import {
  buildPausePoints,
  getAllBlanks,
  buildPausePointAnswerKey,
} from "./karaoke-engine";
import type {
  CurrentSong,
  GameState,
  LyricLine,
  PausePointScore,
  RoundResults,
  KaraokeState,
} from "./types";

export function createInitialState(
  roomCode: string,
  playerName: string,
  totalRounds: number
): GameState {
  return {
    roomCode,
    status: "waiting",
    players: {
      1: { name: playerName, score: 0, connected: true },
      2: null,
    },
    currentRound: 0,
    totalRounds,
    currentSong: null,
    roundDeadline: null,
    roundResults: null,
    usedSongIds: [],
    karaoke: null,
  };
}

export function prepareSong(song: {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  lyrics: LyricLine[];
  audioUrl?: string | null;
  youtubeId?: string | null;
  timingOffsetMs?: number | null;
}): CurrentSong {
  const pausePoints = buildPausePoints(song.lyrics);
  const blanks = getAllBlanks(pausePoints);
  const hasTimestamps = song.lyrics.some((l) => l.timeMs !== undefined);
  const hasAudioSource = !!(song.audioUrl || song.youtubeId);

  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    year: song.year,
    lyrics: song.lyrics,
    blanks,
    pausePoints,
    audioUrl: song.audioUrl ?? null,
    youtubeId: song.youtubeId ?? null,
    timingOffsetMs: song.timingOffsetMs ?? 0,
    hasKaraoke: hasAudioSource && hasTimestamps && pausePoints.length > 0,
  };
}

export function startRound(
  state: GameState,
  song: CurrentSong
): GameState {
  const karaokeState: KaraokeState | null = song.hasKaraoke
    ? {
        isPlaying: false,
        currentLineIndex: 0,
        activePausePointId: null,
        completedPausePoints: [],
        pausePointScores: {},
        initialsUsed: false,
        pauseDeadline: null,
      }
    : null;

  return {
    ...state,
    status: "playing",
    currentRound: state.currentRound + 1,
    currentSong: song,
    // No global deadline for karaoke mode — each pause point has its own timer
    roundDeadline: song.hasKaraoke ? null : Date.now() + 30_000,
    roundResults: null,
    usedSongIds: [...state.usedSongIds, song.id],
    karaoke: karaokeState,
  };
}

/**
 * Score a single PausePoint's answers for one player.
 * Returns number of correct words.
 */
function scorePlayerPausePoint(
  lyrics: LyricLine[],
  blankIndices: number[],
  playerAnswers: Record<number, string>
): { correct: number; allCorrect: boolean } {
  const answerKey = buildPausePointAnswerKey(lyrics, blankIndices);
  let correct = 0;
  for (const idx of blankIndices) {
    const expected = answerKey[idx];
    const given = playerAnswers[idx] ?? "";
    if (matchAnswer(given, expected).match) {
      correct++;
    }
  }
  return {
    correct,
    allCorrect: correct === blankIndices.length,
  };
}

/**
 * Score a PausePoint for both players.
 * TV show rules: all-or-nothing per pause point.
 * Points awarded only if ALL words are correct.
 */
export function scorePausePoint(
  lyrics: LyricLine[],
  blankIndices: number[],
  p1Answers: Record<number, string>,
  p2Answers: Record<number, string>
): PausePointScore {
  const p1 = scorePlayerPausePoint(lyrics, blankIndices, p1Answers);
  const p2 = scorePlayerPausePoint(lyrics, blankIndices, p2Answers);
  const answerKey = buildPausePointAnswerKey(lyrics, blankIndices);

  return {
    p1Correct: p1.correct,
    p2Correct: p2.correct,
    p1AllCorrect: p1.allCorrect,
    p2AllCorrect: p2.allCorrect,
    correctAnswers: answerKey,
    p1Answers,
    p2Answers,
  };
}

/**
 * Resolve the full round after all pause points are done.
 * Aggregates all pause point scores.
 */
export function resolveRound(
  state: GameState,
  ppScores: Record<string, PausePointScore>
): GameState {
  if (!state.currentSong) return state;

  const song = state.currentSong;
  let p1Total = 0;
  let p2Total = 0;
  let p1CorrectWords = 0;
  let p2CorrectWords = 0;
  const allCorrectAnswers: Record<number, string> = {};
  const allP1Answers: Record<number, string> = {};
  const allP2Answers: Record<number, string> = {};
  const pausePointScoresList: PausePointScore[] = [];

  for (const pp of song.pausePoints) {
    const score = ppScores[pp.id];
    if (!score) continue;

    pausePointScoresList.push(score);
    p1CorrectWords += score.p1Correct;
    p2CorrectWords += score.p2Correct;

    // All-or-nothing: points only if ALL words correct
    if (score.p1AllCorrect) p1Total += pp.points;
    if (score.p2AllCorrect) p2Total += pp.points;

    Object.assign(allCorrectAnswers, score.correctAnswers);
    Object.assign(allP1Answers, score.p1Answers);
    Object.assign(allP2Answers, score.p2Answers);
  }

  const roundResults: RoundResults = {
    player1Correct: p1CorrectWords,
    player2Correct: p2CorrectWords,
    correctAnswers: allCorrectAnswers,
    player1Answers: allP1Answers,
    player2Answers: allP2Answers,
    pausePointScores: pausePointScoresList,
  };

  const isLastRound = state.currentRound >= state.totalRounds;

  return {
    ...state,
    status: isLastRound ? "finished" : "revealing",
    players: {
      1: {
        ...state.players[1],
        score: state.players[1].score + p1Total,
      },
      2: state.players[2]
        ? {
            ...state.players[2],
            score: state.players[2].score + p2Total,
          }
        : null,
    },
    roundResults,
    roundDeadline: null,
    karaoke: null,
  };
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function getWinner(state: GameState): 1 | 2 | null {
  if (state.status !== "finished") return null;
  const s1 = state.players[1].score;
  const s2 = state.players[2]?.score ?? 0;
  if (s1 > s2) return 1;
  if (s2 > s1) return 2;
  return null;
}
