import type { LyricLine, PausePoint } from "./types";
import { POINTS_PYRAMID } from "./types";

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
 * Build 5 PausePoints spread throughout the song.
 * Each PausePoint has increasing word count matching the pyramid.
 */
export function buildPausePoints(lyrics: LyricLine[]): PausePoint[] {
  // Collect all eligible words with their global indices and timestamps
  const eligible: { gi: number; lineIndex: number; timeMs: number; text: string }[] = [];
  let gi = 0;
  for (const line of lyrics) {
    for (const word of line.words) {
      const clean = word.text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z]/g, "");
      if (
        clean.length >= 3 &&
        !EXCLUDED_WORDS.has(clean) &&
        word.canBeBlank &&
        line.timeMs !== undefined
      ) {
        eligible.push({
          gi,
          lineIndex: line.index,
          timeMs: line.timeMs,
          text: word.text,
        });
      }
      gi++;
    }
  }

  if (eligible.length < 5) return []; // Not enough words for pause points

  // Find song time range
  const timedLines = lyrics.filter((l) => l.timeMs !== undefined);
  if (timedLines.length < 10) return [];

  const songStartMs = timedLines[0].timeMs!;
  const songEndMs = timedLines[timedLines.length - 1].timeMs!;
  const songDuration = songEndMs - songStartMs;

  if (songDuration < 30_000) return []; // Song too short

  // Divide song into 5 zones, pick words from each zone
  const numPauses = Math.min(5, POINTS_PYRAMID.length);
  const zoneSize = songDuration / numPauses;
  const pausePoints: PausePoint[] = [];

  for (let i = 0; i < numPauses; i++) {
    const pyramid = POINTS_PYRAMID[i];
    const zoneStart = songStartMs + i * zoneSize;
    const zoneEnd = zoneStart + zoneSize;

    // Get eligible words in this zone
    const zoneWords = eligible.filter(
      (w) => w.timeMs >= zoneStart && w.timeMs < zoneEnd
    );

    if (zoneWords.length === 0) continue;

    // Pick words for this pause point (random selection within the zone)
    const targetCount = Math.min(
      pyramid.maxWords,
      Math.max(pyramid.minWords, zoneWords.length)
    );
    const shuffled = [...zoneWords].sort(() => Math.random() - 0.5);
    const picked = shuffled
      .slice(0, targetCount)
      .sort((a, b) => a.gi - b.gi);

    if (picked.length < pyramid.minWords) continue;

    // Pause time = just after the last picked word's line
    const lastWordTimeMs = Math.max(...picked.map((w) => w.timeMs));
    const pauseTimeMs = lastWordTimeMs + 2000; // 2s after last word

    // Resume time = pause time (resume exactly where we stopped)
    const resumeTimeMs = pauseTimeMs;

    pausePoints.push({
      id: `pp-${i}`,
      index: i,
      timeMs: pauseTimeMs,
      resumeTimeMs,
      blankIndices: picked.map((w) => w.gi),
      points: pyramid.points,
      wordCount: picked.length,
    });

    // Remove picked words from eligible pool so they aren't reused
    const pickedSet = new Set(picked.map((w) => w.gi));
    for (let j = eligible.length - 1; j >= 0; j--) {
      if (pickedSet.has(eligible[j].gi)) {
        eligible.splice(j, 1);
      }
    }
  }

  return pausePoints;
}

// ── Time update action ──

export type KaraokeAction =
  | { type: "UPDATE_ACTIVE_LINE"; lineIndex: number }
  | { type: "PAUSE_FOR_POINT"; pausePoint: PausePoint }
  | { type: "SONG_ENDED" }
  | { type: "NOOP" };

/**
 * Called on every audio time tick (~100ms).
 * Determines if we should pause for a PausePoint or update the active line.
 */
export function onTimeUpdate(
  currentTimeMs: number,
  lyrics: LyricLine[],
  pausePoints: PausePoint[],
  completedIds: Set<string>
): KaraokeAction {
  // Check for upcoming pause points (within 500ms window)
  for (const pp of pausePoints) {
    if (completedIds.has(pp.id)) continue;
    if (
      currentTimeMs >= pp.timeMs - 300 &&
      currentTimeMs <= pp.timeMs + 1000
    ) {
      return { type: "PAUSE_FOR_POINT", pausePoint: pp };
    }
  }

  // Find active line
  let activeLine: LyricLine | undefined;
  for (const line of lyrics) {
    if (line.timeMs !== undefined && line.timeMs <= currentTimeMs) {
      activeLine = line;
    } else if (line.timeMs !== undefined && line.timeMs > currentTimeMs) {
      break;
    }
  }

  if (activeLine) {
    return { type: "UPDATE_ACTIVE_LINE", lineIndex: activeLine.index };
  }

  return { type: "NOOP" };
}

/**
 * Get all blank indices across all pause points.
 */
export function getAllBlanks(pausePoints: PausePoint[]): number[] {
  const all: number[] = [];
  for (const pp of pausePoints) {
    all.push(...pp.blankIndices);
  }
  return all.sort((a, b) => a - b);
}

/**
 * Build answer key for a specific pause point.
 */
export function buildPausePointAnswerKey(
  lyrics: LyricLine[],
  blankIndices: number[]
): Record<number, string> {
  const blanksSet = new Set(blankIndices);
  const answers: Record<number, string> = {};
  let gi = 0;
  for (const line of lyrics) {
    for (const word of line.words) {
      if (blanksSet.has(gi)) {
        answers[gi] = word.text;
      }
      gi++;
    }
  }
  return answers;
}
