import { json } from "../../../lib/server";
import { createTranscriber } from "../../../lib/transcribe";

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0 || audio.byteLength > MAX_BYTES) return json({ error: "Audio missing or too large" }, 400);
  const lang = new URL(req.url).searchParams.get("lang") ?? undefined;
  try {
    return json({ text: await createTranscriber().transcribe(audio, req.headers.get("content-type") ?? "audio/webm", lang) });
  } catch (e) {
    console.error(e);
    return json({ error: "Transcription failed" }, 502);
  }
}
