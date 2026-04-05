import { matchAnswer } from "./fuzzy-match";
import { buildAnswerKey, generateBlanks } from "./lyrics-processor";
import type {
  CurrentSong,
  GameState,
  LyricLine,
  RoundResults,
} from "./types";

const ROUND_DURATION_MS = 30_000;

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
  };
}

export function prepareSong(
  song: { id: string; title: string; artist: string; year: number | null; lyrics: LyricLine[] },
  difficulty: 1 | 2 | 3 = 2
): CurrentSong {
  const blanks = generateBlanks(song.lyrics, difficulty);
  return {
    id: song.id,
    title: song.title,
    artist: song.artist,
    year: song.year,
    lyrics: song.lyrics,
    blanks,
  };
}

export function startRound(
  state: GameState,
  song: CurrentSong
): GameState {
  return {
    ...state,
    status: "playing",
    currentRound: state.currentRound + 1,
    currentSong: song,
    roundDeadline: Date.now() + ROUND_DURATION_MS,
    roundResults: null,
    usedSongIds: [...state.usedSongIds, song.id],
  };
}

export function scoreAnswers(
  song: CurrentSong,
  playerAnswers: Record<number, string>
): { correct: number; details: Record<number, boolean> } {
  const answerKey = buildAnswerKey(song.lyrics, song.blanks);
  let correct = 0;
  const details: Record<number, boolean> = {};

  for (const idx of song.blanks) {
    const expected = answerKey[idx];
    const given = playerAnswers[idx] ?? "";
    const result = matchAnswer(given, expected);
    details[idx] = result.match;
    if (result.match) correct++;
  }

  return { correct, details };
}

export function resolveRound(
  state: GameState,
  p1Answers: Record<number, string>,
  p2Answers: Record<number, string>
): GameState {
  if (!state.currentSong) return state;

  const answerKey = buildAnswerKey(state.currentSong.lyrics, state.currentSong.blanks);
  const p1 = scoreAnswers(state.currentSong, p1Answers);
  const p2 = scoreAnswers(state.currentSong, p2Answers);

  const roundResults: RoundResults = {
    player1Correct: p1.correct,
    player2Correct: p2.correct,
    correctAnswers: answerKey,
    player1Answers: p1Answers,
    player2Answers: p2Answers,
  };

  const isLastRound = state.currentRound >= state.totalRounds;

  return {
    ...state,
    status: isLastRound ? "finished" : "revealing",
    players: {
      1: {
        ...state.players[1],
        score: state.players[1].score + p1.correct,
      },
      2: state.players[2]
        ? {
            ...state.players[2],
            score: state.players[2].score + p2.correct,
          }
        : null,
    },
    roundResults,
    roundDeadline: null,
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
  return null; // tie
}
