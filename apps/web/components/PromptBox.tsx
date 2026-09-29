"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { EXAMPLES, EXAMPLE_KEYS, t, type Locale } from "@appforge/i18n";

export function PromptBox({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const go = (prompt: string) => prompt.trim() && router.push(`/${locale}/studio?prompt=${encodeURIComponent(prompt.trim())}`);

  /** Records audio and posts it to /api/transcribe (Whisper-compatible provider behind an interface). */
  async function toggleMic() {
    if (listening) { recorder.current?.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) return;
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    recorder.current = r;
    r.ondataavailable = (e) => chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((tr) => tr.stop());
      setListening(false);
      const res = await fetch(`/api/transcribe?lang=${locale}`, { method: "POST", body: new Blob(chunks, { type: r.mimeType }) });
      setMicError(!res.ok);
      if (res.ok) setText(((await res.json()) as { text: string }).text);
    };
    r.start();
    setListening(true);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="space-y-4">
      <div className="flex items-start gap-2 rounded-3xl border border-neutral-300 p-3 shadow-sm focus-within:ring-2 focus-within:ring-[var(--brand)]">
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000}
          placeholder={t(locale, "hero.placeholder")} aria-label={t(locale, "hero.placeholder")}
          className="w-full resize-none bg-transparent p-2 text-lg outline-none"
        />
        <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={t(locale, "hero.mic")}
          className={`rounded-full p-3 ${listening ? "bg-red-600 text-white" : "bg-neutral-100"}`}>🎙</button>
      </div>
      {micError && <p role="alert" className="text-sm text-red-700">Voice input is not available right now. Please type your idea.</p>}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => go(EXAMPLES[locale][k])} className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-50">
            {EXAMPLES[locale][k]}
          </button>
        ))}
      </div>
      <button type="submit" disabled={!text.trim()} className="rounded-full bg-[var(--brand)] px-6 py-3 font-semibold text-white disabled:opacity-40">
        {t(locale, "hero.cta")}
      </button>
    </form>
  );
}
