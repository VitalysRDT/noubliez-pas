import { NextResponse } from "next/server";
import { generateSpeech } from "@/lib/tts";
import { getPresenterLine } from "@/lib/tts-lines";
import type { PresenterLineType } from "@/lib/tts-lines";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      type: PresenterLineType;
      params: Record<string, string | number>;
    };

    const text = getPresenterLine(body.type, body.params);
    const audio = await generateSpeech(text);

    if (!audio) {
      return NextResponse.json(
        { text, audio: null },
        { status: 200 }
      );
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("POST /api/tts error:", err);
    return NextResponse.json(
      { error: "TTS generation failed" },
      { status: 500 }
    );
  }
}
