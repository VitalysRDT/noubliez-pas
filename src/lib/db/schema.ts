import {
  pgTable,
  uuid,
  text,
  integer,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

export const songs = pgTable("songs", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  year: integer("year"),
  genre: text("genre"),
  difficulty: integer("difficulty").notNull().default(2),
  lyrics: jsonb("lyrics").notNull(), // LyricLine[]
  audioUrl: text("audio_url"),
  youtubeId: text("youtube_id"),
  lrcTimestamps: jsonb("lrc_timestamps"), // LRCTimestamp[]
  timingOffsetMs: integer("timing_offset_ms").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const games = pgTable("games", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomCode: text("room_code").notNull().unique(),
  player1Name: text("player1_name").notNull(),
  player2Name: text("player2_name"),
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  totalRounds: integer("total_rounds").default(5),
  status: text("status").notNull().default("waiting"),
  winnerId: integer("winner_id"),
  createdAt: timestamp("created_at").defaultNow(),
  finishedAt: timestamp("finished_at"),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameId: uuid("game_id")
    .references(() => games.id)
    .notNull(),
  songId: uuid("song_id")
    .references(() => songs.id)
    .notNull(),
  roundNumber: integer("round_number").notNull(),
  blanksCount: integer("blanks_count").notNull(),
  player1Answers: jsonb("player1_answers"),
  player2Answers: jsonb("player2_answers"),
  player1Correct: integer("player1_correct").default(0),
  player2Correct: integer("player2_correct").default(0),
  completedAt: timestamp("completed_at"),
});
