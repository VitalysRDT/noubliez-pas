import { ElevenLabsClient } from "elevenlabs";

let client: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient | null {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  if (!client) {
    client = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
  }
  return client;
}

export async function generateSpeech(text: string): Promise<Buffer | null> {
  const c = getClient();
  if (!c || !process.env.ELEVENLABS_VOICE_ID) return null;

  try {
    const audio = await c.textToSpeech.convert(
      process.env.ELEVENLABS_VOICE_ID,
      {
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.6,
          similarity_boost: 0.8,
          style: 0.4,
        },
      }
    );

    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.error("ElevenLabs TTS error:", err);
    return null;
  }
}
