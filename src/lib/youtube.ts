const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

type YouTubeSearchItem = {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string };
};

type YouTubeSearchResponse = {
  items: YouTubeSearchItem[];
};

/**
 * Search for a YouTube video by artist + title.
 * Requires YOUTUBE_API_KEY env var. Returns null if not configured.
 */
export async function searchYouTubeVideo(
  artist: string,
  title: string
): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const queries = [
    `${artist} ${title} official`,
    `${artist} ${title} lyrics`,
    `${artist} ${title}`,
  ];

  for (const q of queries) {
    try {
      const url = `${YOUTUBE_API_BASE}/search?part=snippet&q=${encodeURIComponent(q)}&type=video&maxResults=3&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as YouTubeSearchResponse;
      if (data.items && data.items.length > 0) {
        return data.items[0].id.videoId;
      }
    } catch {
      continue;
    }
  }

  return null;
}
