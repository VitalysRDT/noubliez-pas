/**
 * Download MP3 audio for songs in the database, upload to Vercel Blob.
 *
 * Prerequisites:
 *   brew install yt-dlp ffmpeg
 *
 * Usage:
 *   npx tsx scripts/download-songs.ts
 *
 * Env vars required (from .env.local):
 *   DATABASE_URL, BLOB_READ_WRITE_TOKEN
 */

import { execFileSync, execSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
} from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";

// ── Load .env.local ──
import { config } from "dotenv";
config({ path: path.join(process.cwd(), ".env.local") });

const DOWNLOAD_DIR = path.join(process.cwd(), "tmp-audio");
const BITRATE = "128k";
const MAX_DURATION = "240"; // 4 minutes max
const DELAY_MS = 2000;

// ── DB ──
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

function checkDeps() {
  try {
    execFileSync("yt-dlp", ["--version"], { stdio: "pipe" });
  } catch {
    console.error("yt-dlp non trouvé. Installez : brew install yt-dlp");
    process.exit(1);
  }
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "pipe" });
  } catch {
    console.error("ffmpeg non trouvé. Installez : brew install ffmpeg");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL manquant dans .env.local");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN manquant dans .env.local");
    process.exit(1);
  }
}

function safeName(artist: string, title: string): string {
  return `${artist}-${title}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 -]/g, "")
    .replace(/\s+/g, "_")
    .substring(0, 80);
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function downloadSong(
  artist: string,
  title: string,
  outPath: string
): boolean {
  const query = `ytsearch1:${artist} ${title} audio`;
  const cmd = [
    "yt-dlp",
    "-x",
    "--audio-format mp3",
    `--audio-quality ${BITRATE}`,
    "--no-playlist",
    "--max-downloads 1",
    "--remote-components ejs:github",
    `--postprocessor-args ${shellEscape("ffmpeg:-t " + MAX_DURATION)}`,
    `--output ${shellEscape(outPath + ".%(ext)s")}`,
    shellEscape(query),
  ].join(" ");

  try {
    execSync(cmd, {
      stdio: "pipe",
      timeout: 180_000,
      shell: "/bin/zsh",
      env: {
        ...process.env,
        PATH: `/opt/homebrew/bin:/opt/miniconda3/bin:/usr/local/bin:${process.env.PATH}`,
      },
    });
  } catch {
    // yt-dlp exits non-zero with --max-downloads, check if file exists anyway
  }
  // Check if the mp3 file was created
  const found = findDownloadedFile(path.basename(outPath));
  return found !== null;
}

function findDownloadedFile(prefix: string): string | null {
  if (!existsSync(DOWNLOAD_DIR)) return null;
  const files = readdirSync(DOWNLOAD_DIR);
  return files.find((f) => f.startsWith(prefix)) ?? null;
}

async function uploadToBlob(
  filePath: string,
  blobName: string
): Promise<string> {
  const buffer = readFileSync(filePath);
  const blob = await put(`songs/${blobName}`, buffer, {
    access: "public",
    contentType: "audio/mpeg",
  });
  return blob.url;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  checkDeps();

  if (!existsSync(DOWNLOAD_DIR)) mkdirSync(DOWNLOAD_DIR, { recursive: true });

  // Fetch songs without audioUrl
  const allSongs = await db
    .select({
      id: schema.songs.id,
      title: schema.songs.title,
      artist: schema.songs.artist,
      audioUrl: schema.songs.audioUrl,
    })
    .from(schema.songs);

  const needAudio = allSongs.filter((s) => !s.audioUrl);

  console.log(
    `\n🎵 ${needAudio.length} chansons sans audio / ${allSongs.length} total\n`
  );

  if (needAudio.length === 0) {
    console.log("✅ Toutes les chansons ont déjà un audio !");
    return;
  }

  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < needAudio.length; i++) {
    const song = needAudio[i];
    const name = safeName(song.artist, song.title);
    const outBase = path.join(DOWNLOAD_DIR, name);

    console.log(
      `[${i + 1}/${needAudio.length}] ⬇  ${song.artist} — ${song.title}`
    );

    const ok = downloadSong(song.artist, song.title, outBase);
    if (!ok) {
      console.log(`  ❌ Échec téléchargement`);
      failed++;
      await delay(DELAY_MS);
      continue;
    }

    const file = findDownloadedFile(name);
    if (!file) {
      console.log(`  ❌ Fichier introuvable après téléchargement`);
      failed++;
      await delay(DELAY_MS);
      continue;
    }

    const filePath = path.join(DOWNLOAD_DIR, file);

    console.log(`  ☁️  Upload vers Vercel Blob...`);
    try {
      const blobUrl = await uploadToBlob(filePath, `${name}.mp3`);

      await db
        .update(schema.songs)
        .set({ audioUrl: blobUrl })
        .where(eq(schema.songs.id, song.id));

      console.log(`  ✅ ${blobUrl}`);
      downloaded++;
    } catch (e) {
      console.log(`  ❌ Échec upload: ${e}`);
      failed++;
    }

    // Cleanup local file
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }

    await delay(DELAY_MS);
  }

  // Cleanup tmp dir
  try {
    const remaining = readdirSync(DOWNLOAD_DIR);
    for (const f of remaining) {
      try {
        unlinkSync(path.join(DOWNLOAD_DIR, f));
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  console.log(`\n📊 Résultat :`);
  console.log(`   ✅ ${downloaded} téléchargées`);
  console.log(`   ❌ ${failed} échouées`);
  console.log(
    `   📦 ${allSongs.length - needAudio.length + downloaded}/${allSongs.length} total avec audio\n`
  );
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
