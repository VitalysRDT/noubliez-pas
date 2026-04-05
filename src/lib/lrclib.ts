const BASE_URL = "https://lrclib.net/api";
const USER_AGENT = "noubliez-pas/1.0";

export type LRCLibResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
};

async function fetchLRCLib(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
}

export async function searchSongs(query: string): Promise<LRCLibResult[]> {
  const res = await fetchLRCLib(
    `${BASE_URL}/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function searchByArtistTrack(
  artist: string,
  track: string
): Promise<LRCLibResult[]> {
  const res = await fetchLRCLib(
    `${BASE_URL}/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getSong(
  artist: string,
  track: string
): Promise<LRCLibResult | null> {
  const res = await fetchLRCLib(
    `${BASE_URL}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(track)}`
  );
  if (!res.ok) {
    // Fallback to search
    const results = await searchByArtistTrack(artist, track);
    if (results.length > 0) {
      // Pick the one with syncedLyrics if possible
      const withSynced = results.find((r) => r.syncedLyrics);
      return withSynced ?? results[0];
    }
    return null;
  }
  return res.json();
}

export type ParsedLRCLine = {
  timeMs: number;
  text: string;
};

export function parseSyncedLyrics(lrc: string): ParsedLRCLine[] {
  const lines: ParsedLRCLine[] = [];
  const regex = /^\[(\d{2}):(\d{2})\.(\d{2,3})\]\s*(.*)$/;

  for (const raw of lrc.split("\n")) {
    const match = raw.trim().match(regex);
    if (!match) continue;
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const centiseconds = match[3].length === 2
      ? parseInt(match[3]) * 10
      : parseInt(match[3]);
    const timeMs = minutes * 60000 + seconds * 1000 + centiseconds;
    const text = match[4].trim();
    if (text.length > 0) {
      lines.push({ timeMs, text });
    }
  }
  return lines;
}

export function parsePlainLyrics(plain: string): string[] {
  return plain
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((l) => !isMetadataLine(l));
}

function isMetadataLine(line: string): boolean {
  const lower = line.toLowerCase();
  return /^\[.*\]$/.test(lower) ||
    /^(intro|outro|refrain|chorus|couplet|verse|bridge|pont|instrumental|solo|hook|pre-chorus|post-chorus|interlude)$/i.test(lower);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
