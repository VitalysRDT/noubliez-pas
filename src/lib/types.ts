// ── Lyrics structures ──

export type Word = {
  index: number;
  text: string;
  canBeBlank: boolean;
};

export type LyricLine = {
  index: number;
  text: string;
  words: Word[];
  timeMs?: number; // LRC timestamp in milliseconds
};

// ── PausePoint: moment where music stops and player guesses ──

export type PausePoint = {
  id: string;
  index: number; // 0-4 (pyramid level)
  timeMs: number; // when music stops
  resumeTimeMs: number; // where to resume after answers
  blankIndices: number[]; // global word indices to guess
  points: number; // points if all correct
  wordCount: number; // number of words to find
};

// Points pyramid (like the TV show)
export const POINTS_PYRAMID = [
  { level: 0, points: 100, minWords: 2, maxWords: 3 },
  { level: 1, points: 200, minWords: 3, maxWords: 5 },
  { level: 2, points: 500, minWords: 5, maxWords: 8 },
  { level: 3, points: 1000, minWords: 8, maxWords: 11 },
  { level: 4, points: 2000, minWords: 11, maxWords: 15 },
] as const;

export const PAUSE_DURATION_MS = 15_000; // 15s to answer each pause point

// ── Game state (Redis) ──

export type PlayerSlot = {
  name: string;
  score: number;
  connected: boolean;
};

export type PausePointScore = {
  p1Correct: number;
  p2Correct: number;
  p1AllCorrect: boolean;
  p2AllCorrect: boolean;
  correctAnswers: Record<number, string>;
  p1Answers: Record<number, string>;
  p2Answers: Record<number, string>;
};

export type RoundResults = {
  player1Correct: number;
  player2Correct: number;
  correctAnswers: Record<number, string>;
  player1Answers: Record<number, string>;
  player2Answers: Record<number, string>;
  pausePointScores: PausePointScore[];
};

export type CurrentSong = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  lyrics: LyricLine[];
  blanks: number[]; // all blanked indices (union of all pause points)
  pausePoints: PausePoint[];
  audioUrl: string | null;
  youtubeId: string | null;
  timingOffsetMs: number;
  hasKaraoke: boolean;
};

export type KaraokeState = {
  isPlaying: boolean;
  currentLineIndex: number;
  activePausePointId: string | null;
  completedPausePoints: string[];
  pausePointScores: Record<string, PausePointScore>;
  initialsUsed: boolean;
  pauseDeadline: number | null; // epoch ms for current pause timer
};

export type GameStatus =
  | "waiting"
  | "countdown"
  | "playing"
  | "revealing"
  | "finished";

export type GameState = {
  roomCode: string;
  status: GameStatus;
  players: {
    1: PlayerSlot;
    2: PlayerSlot | null;
  };
  currentRound: number;
  totalRounds: number;
  currentSong: CurrentSong | null;
  roundDeadline: number | null;
  roundResults: RoundResults | null;
  usedSongIds: string[];
  karaoke: KaraokeState | null;
};

// ��─ API payloads ─��

export type CreateRoomRequest = {
  playerName: string;
  totalRounds?: number;
};

export type JoinRoomRequest = {
  playerName: string;
};

export type SubmitAnswerRequest = {
  playerId: 1 | 2;
  answers: Record<number, string>;
};

export type SubmitPauseAnswerRequest = {
  playerId: 1 | 2;
  pausePointId: string;
  answers: Record<number, string>;
};

export type TtsRequest = {
  type: keyof typeof import("./tts-lines").PRESENTER_LINES;
  params: Record<string, string | number>;
};
