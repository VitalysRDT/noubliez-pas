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

// ── Game state (Redis) ──

export type PlayerSlot = {
  name: string;
  score: number;
  connected: boolean;
};

export type RoundResults = {
  player1Correct: number;
  player2Correct: number;
  correctAnswers: Record<number, string>; // globalWordIndex → correct word
  player1Answers: Record<number, string>;
  player2Answers: Record<number, string>;
};

export type CurrentSong = {
  id: string;
  title: string;
  artist: string;
  year: number | null;
  lyrics: LyricLine[];
  blanks: number[]; // global word indices that are blanked
  youtubeId: string | null;
  timingOffsetMs: number;
  hasKaraoke: boolean; // true if youtubeId + syncedLyrics timestamps present
};

// ── Karaoke state (inside GameState) ──

export type KaraokeState = {
  youtubeId: string;
  currentLineIndex: number;
  isPlaying: boolean;
  pausedAtLineIndex: number | null;
  resumeAtTimeMs: number | null;
  lineDeadline: number | null;
};

export type GameStatus = "waiting" | "countdown" | "playing" | "revealing" | "finished";

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
  roundDeadline: number | null; // epoch ms
  roundResults: RoundResults | null;
  usedSongIds: string[];
  karaoke: KaraokeState | null;
};

// ── API payloads ──

export type CreateRoomRequest = {
  playerName: string;
  totalRounds?: number;
};

export type JoinRoomRequest = {
  playerName: string;
};

export type SubmitAnswerRequest = {
  playerId: 1 | 2;
  answers: Record<number, string>; // globalWordIndex → typed answer
};

export type TtsRequest = {
  type: keyof typeof import("./tts-lines").PRESENTER_LINES;
  params: Record<string, string | number>;
};
