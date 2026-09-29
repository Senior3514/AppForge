import { describe, expect, it, vi } from "vitest";
import { createTranscriber, mockTranscriber, whisperTranscriber } from "./transcribe";

describe("transcriber", () => {
  it("mock refuses rather than inventing text", async () => {
    await expect(mockTranscriber.transcribe(new ArrayBuffer(1), "audio/webm")).rejects.toThrow(/no transcription provider/);
  });
  it("factory needs flag + url + key", () => {
    expect(createTranscriber({})).toBe(mockTranscriber);
    expect(createTranscriber({ APPFORGE_FLAG_REAL_TRANSCRIBE: "true" })).toBe(mockTranscriber);
    expect(createTranscriber({ APPFORGE_FLAG_REAL_TRANSCRIBE: "true", TRANSCRIBE_API_URL: "https://x", TRANSCRIBE_API_KEY: "k" })).not.toBe(mockTranscriber);
  });
  it("whisper adapter posts multipart with the language (Hebrew = he) and bearer key", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ text: "שלום" })) as unknown as typeof fetch;
    const out = await whisperTranscriber("https://api.test/transcribe", "secret", "whisper-1", fetchImpl).transcribe(new ArrayBuffer(4), "audio/webm", "he");
    expect(out).toBe("שלום");
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]!;
    expect(url).toBe("https://api.test/transcribe");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    const form = init.body as FormData;
    expect(form.get("language")).toBe("he");
    expect(form.get("model")).toBe("whisper-1");
  });
  it("whisper adapter surfaces provider errors", async () => {
    const fetchImpl = (async () => new Response("no", { status: 429 })) as typeof fetch;
    await expect(whisperTranscriber("https://x", "k", "m", fetchImpl).transcribe(new ArrayBuffer(1), "audio/webm")).rejects.toThrow(/429/);
  });
});
