"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { EXAMPLES, EXAMPLE_KEYS, t, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";
import type { AppView } from "../lib/types";

const STEPS = ["understand", "modules", "theme", "content", "assemble"] as const;

/** Prompt → persisted app → studio. Works before signup (anonymous draft), which signup later claims. */
export function PromptBox({ locale, autofocus = false }: { locale: Locale; autofocus?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const busy = step !== null;

  async function go(prompt: string) {
    const p = prompt.trim();
    if (!p || busy) return;
    setError(null);
    let i = 0;
    setStep(t(locale, "steps.understand"));
    // Labels only pace the wait; the server returns the finished app in one response.
    const tick = setInterval(() => setStep(t(locale, `steps.${STEPS[Math.min(++i, STEPS.length - 1)]!}` as never)), 500);
    try {
      const app = await api<AppView>("/apps", { method: "POST", body: { prompt: p, locale } });
      router.push(`/${locale}/studio/${app.id}`);
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      setError({ message: status === 402 ? t(locale, "dash.limit") : e instanceof ApiError ? e.message : t(locale, "common.error"), upgrade: status === 402 });
      setStep(null);
    } finally { clearInterval(tick); }
  }

  /** Records audio and posts it to /api/transcribe (Whisper-compatible provider behind an interface). */
  async function toggleMic() {
    if (listening) { recorder.current?.stop(); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) { setMicError(true); return; }
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
    <form onSubmit={(e) => { e.preventDefault(); void go(text); }} className="space-y-4">
      <div className="flex items-start gap-2 rounded-3xl border border-slate-300 bg-white p-3 shadow-sm focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-100">
        <textarea
          autoFocus={autofocus} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000}
          placeholder={t(locale, "hero.placeholder")} aria-label={t(locale, "hero.placeholder")}
          className="w-full resize-none bg-transparent p-2 text-lg outline-none"
        />
        <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={t(locale, "hero.mic")}
          className={`rounded-full p-3 ${listening ? "bg-red-600 text-white" : "bg-slate-100"}`}>🎙</button>
      </div>
      {micError && <p role="alert" className="text-sm text-red-700">{t(locale, "hero.micUnavailable")}</p>}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_KEYS.map((k) => (
          <button key={k} type="button" disabled={busy} onClick={() => void go(EXAMPLES[locale][k])} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 shadow-sm transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">
            {EXAMPLES[locale][k]}
          </button>
        ))}
      </div>
      <button type="submit" disabled={!text.trim() || busy} className="btn-primary px-7 py-3">
        {busy ? `${step}…` : t(locale, "hero.cta")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error.message}{" "}
          {error.upgrade && <Link className="font-semibold underline" href={`/${locale}/pricing`}>{t(locale, "dash.upgrade")}</Link>}
        </p>
      )}
    </form>
  );
}
