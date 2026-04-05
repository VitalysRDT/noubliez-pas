import type { LyricLine, Word } from "./types";

export type KaraokeLine = {
  lineIndex: number;
  timeMs: number;
  text: string;
  words: Word[];
  blanks: number[]; // global word indices that are blanks on this line
  hasBlanks: boolean;
};

export type KaraokeAction =
  | { type: "UPDATE_ACTIVE_LINE"; lineIndex: number }
  | { type: "PAUSE_FOR_BLANKS"; lineIndex: number; blankIndices: number[] }
  | { type: "NOOP" };

/**
 * Build karaoke line data from lyrics + blanks.
 */
export function buildKaraokeLines(
  lyrics: LyricLine[],
  blanks: number[]
): KaraokeLine[] {
  const blanksSet = new Set(blanks);
  let globalIndex = 0;

  return lyrics
    .filter((line) => line.timeMs !== undefined)
    .map((line) => {
      const startGlobal = globalIndex;
      const lineBlanks: number[] = [];

      for (const word of line.words) {
        if (blanksSet.has(globalIndex)) {
          lineBlanks.push(globalIndex);
        }
        globalIndex++;
      }

      // For lines without timeMs, we already filtered them out
      return {
        lineIndex: line.index,
        timeMs: line.timeMs!,
        text: line.text,
        words: line.words,
        blanks: lineBlanks,
        hasBlanks: lineBlanks.length > 0,
      };
    });
}

/**
 * Determine what action to take based on current playback time.
 * Called from the client on every time update (~100ms).
 */
export function onTimeUpdate(
  currentTimeMs: number,
  lines: KaraokeLine[],
  alreadyPausedLines: Set<number>
): KaraokeAction {
  // Find lines with blanks that we haven't paused for yet
  for (const line of lines) {
    if (
      line.hasBlanks &&
      !alreadyPausedLines.has(line.lineIndex) &&
      currentTimeMs >= line.timeMs - 300 &&
      currentTimeMs <= line.timeMs + 500
    ) {
      return {
        type: "PAUSE_FOR_BLANKS",
        lineIndex: line.lineIndex,
        blankIndices: line.blanks,
      };
    }
  }

  // Find active line (last line whose timeMs <= currentTimeMs)
  let activeLine: KaraokeLine | undefined;
  for (const line of lines) {
    if (line.timeMs <= currentTimeMs) {
      activeLine = line;
    } else {
      break;
    }
  }

  if (activeLine) {
    return { type: "UPDATE_ACTIVE_LINE", lineIndex: activeLine.lineIndex };
  }

  return { type: "NOOP" };
}

/**
 * Calculate the time to resume playback after answering blanks.
 * We resume slightly before the line so the text syncs visually.
 */
export function getResumeTimeMs(
  pausedLine: KaraokeLine,
  lines: KaraokeLine[]
): number {
  // Find the next line after the paused one
  const idx = lines.findIndex((l) => l.lineIndex === pausedLine.lineIndex);
  if (idx >= 0 && idx < lines.length - 1) {
    // Resume at the paused line's time (the lyrics will catch up)
    return pausedLine.timeMs;
  }
  return pausedLine.timeMs;
}
