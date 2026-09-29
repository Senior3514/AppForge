export interface Transcriber { transcribe(audio: ArrayBuffer, mime: string, lang?: string): Promise<string> }

/** Mock: no provider configured, so say so instead of inventing text. */
export const mockTranscriber: Transcriber = {
  async transcribe() { throw new Error("no transcription provider configured (set APPFORGE_FLAG_REAL_TRANSCRIBE, TRANSCRIBE_API_URL, TRANSCRIBE_API_KEY)"); },
};

/** Real adapter for any Whisper-compatible `/audio/transcriptions` endpoint (multipart: file, model, language). */
export function whisperTranscriber(url: string, key: string, model = "whisper-1", fetchImpl: typeof fetch = fetch): Transcriber {
  return {
    async transcribe(audio, mime, lang) {
      const form = new FormData();
      form.set("file", new Blob([audio], { type: mime }), "audio." + (mime.includes("mp4") ? "mp4" : "webm"));
      form.set("model", model);
      if (lang) form.set("language", lang); // ISO-639-1: "he" for Hebrew
      const res = await fetchImpl(url, { method: "POST", headers: { authorization: `Bearer ${key}` }, body: form });
      if (!res.ok) throw new Error(`transcription API ${res.status}`);
      return ((await res.json()) as { text: string }).text;
    },
  };
}

export function createTranscriber(env: Record<string, string | undefined> = process.env): Transcriber {
  return env.APPFORGE_FLAG_REAL_TRANSCRIBE === "true" && env.TRANSCRIBE_API_URL && env.TRANSCRIBE_API_KEY
    ? whisperTranscriber(env.TRANSCRIBE_API_URL, env.TRANSCRIBE_API_KEY)
    : mockTranscriber;
}
