import type { LyricLine } from "./types";

const EXCLUDED_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles",
  "a", "au", "aux", "en", "y",
  "et", "ou", "mais", "donc", "car", "ni",
  "est", "ai", "as", "ne", "pas", "plus",
  "que", "qui", "se", "ce", "sa", "son", "ses",
  "mon", "ma", "mes", "ton", "ta", "tes",
  "me", "te", "lui", "leur", "leurs",
  "si", "ca", "dans", "sur", "par", "pour", "avec", "sans",
  "tout", "tous", "cette", "ces", "cet",
]);

/**
 * Returns global word indices to blank out.
 * difficulty: 1 = easy (~30%), 2 = medium (~45%), 3 = hard (~60%)
 */
export function generateBlanks(
  lyrics: LyricLine[],
  difficulty: 1 | 2 | 3
): number[] {
  const eligible: number[] = [];
  let globalIndex = 0;

  for (const line of lyrics) {
    for (const word of line.words) {
      if (word.canBeBlank && !EXCLUDED_WORDS.has(word.text.toLowerCase())) {
        eligible.push(globalIndex);
      }
      globalIndex++;
    }
  }

  const ratio = difficulty === 1 ? 0.3 : difficulty === 2 ? 0.45 : 0.6;
  const count = Math.max(1, Math.round(eligible.length * ratio));

  // Shuffle and pick
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).sort((a, b) => a - b);
}

/**
 * Build a global index → word text lookup for correct answers.
 */
export function buildAnswerKey(
  lyrics: LyricLine[],
  blanks: number[]
): Record<number, string> {
  const blanksSet = new Set(blanks);
  const answers: Record<number, string> = {};
  let globalIndex = 0;

  for (const line of lyrics) {
    for (const word of line.words) {
      if (blanksSet.has(globalIndex)) {
        answers[globalIndex] = word.text;
      }
      globalIndex++;
    }
  }
  return answers;
}

/**
 * Parse raw text into LyricLine[] structure.
 * Each line is split into words with canBeBlank flag.
 */
export function parseLyrics(rawLines: string[]): LyricLine[] {
  return rawLines.map((text, lineIndex) => {
    const rawWords = text.split(/\s+/).filter(Boolean);
    return {
      index: lineIndex,
      text,
      words: rawWords.map((w, wordIndex) => {
        const clean = w
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z]/g, "");
        return {
          index: wordIndex,
          text: w,
          canBeBlank: clean.length >= 3 && !EXCLUDED_WORDS.has(clean),
        };
      }),
    };
  });
}

// ── LRCLIB integration ──

const METADATA_PATTERN =
  /^\[.*\]$|^(intro|outro|refrain|chorus|couplet|verse|bridge|pont|instrumental|solo|hook|pre-chorus|post-chorus|interlude)\s*$/i;

function isMetadataLine(line: string): boolean {
  return METADATA_PATTERN.test(line.trim());
}

/**
 * Parse plain text lyrics (from LRCLIB plainLyrics) into LyricLine[].
 */
export function parseLyricsFromText(text: string): LyricLine[] {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !isMetadataLine(l));
  return parseLyrics(lines);
}

export type LRCTimestamp = {
  lineIndex: number;
  timeMs: number;
};

/**
 * Parse LRC synced lyrics into LyricLine[] with timestamp data returned separately.
 */
export function parseLyricsFromLRC(lrc: string): {
  lyrics: LyricLine[];
  timestamps: LRCTimestamp[];
} {
  const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;
  const parsed: { timeMs: number; text: string }[] = [];

  for (const raw of lrc.split("\n")) {
    const match = raw.trim().match(regex);
    if (!match) continue;
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const centiseconds =
      match[3].length === 2 ? parseInt(match[3]) * 10 : parseInt(match[3]);
    const timeMs = minutes * 60000 + seconds * 1000 + centiseconds;
    const text = match[4].trim();
    if (text.length > 0 && !isMetadataLine(text)) {
      parsed.push({ timeMs, text });
    }
  }

  const lyrics = parseLyrics(parsed.map((p) => p.text));
  const timestamps: LRCTimestamp[] = parsed.map((p, i) => ({
    lineIndex: i,
    timeMs: p.timeMs,
  }));

  // Attach timeMs to lyrics lines
  for (let i = 0; i < lyrics.length; i++) {
    if (i < timestamps.length) {
      (lyrics[i] as LyricLine & { timeMs?: number }).timeMs =
        timestamps[i].timeMs;
    }
  }

  return { lyrics, timestamps };
}
