"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { validateApp, type AppSpec } from "@appforge/modules";
import { RevisionLog } from "@appforge/spec";
import { PhonePreview } from "./PhonePreview";

type Status = { kind: "idle" } | { kind: "busy"; step: string } | { kind: "error"; message: string };
interface ChatLine { from: "you" | "ai"; text: string; changes?: string[] }

const STEPS = ["understand", "modules", "theme", "content", "assemble"] as const;

const validate = (d: AppSpec) => { const v = validateApp(d); if (!v.ok) throw new Error(v.errors.join("; ")); return v.spec; };

export function Studio({ locale, initialPrompt }: { locale: Locale; initialPrompt: string }) {
  const log = useRef<RevisionLog<AppSpec> | null>(null);
  const [, bump] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [msg, setMsg] = useState("");
  const [dark, setDark] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<Locale | null>(null);
  const [rtl, setRtl] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const started = useRef(false);
  const spec = log.current?.current ?? null;
  const lastPrompt = useRef(initialPrompt);

  /** Progress labels are cosmetic timing over one request; the server returns the whole spec at once. */
  async function withSteps<T>(work: Promise<T>): Promise<T> {
    let i = 0;
    const tick = setInterval(() => setStatus({ kind: "busy", step: t(locale, `steps.${STEPS[Math.min(++i, STEPS.length - 1)]!}` as never) }), 400);
    setStatus({ kind: "busy", step: t(locale, "steps.understand") });
    try { return await work; } finally { clearInterval(tick); }
  }

  async function generate(prompt: string) {
    lastPrompt.current = prompt;
    try {
      const res = await withSteps(fetch("/api/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, locale }) }));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed");
      log.current = new RevisionLog<AppSpec>(body.spec, validate);
      setChat([{ from: "you", text: prompt }, { from: "ai", text: (body.spec as AppSpec).name }]);
      setStatus({ kind: "idle" });
    } catch (e) { setStatus({ kind: "error", message: (e as Error).message }); }
    bump((n) => n + 1);
  }

  async function iterate(message: string) {
    if (!log.current) return;
    setChat((c) => [...c, { from: "you", text: message }]);
    try {
      const res = await withSteps(fetch("/api/iterate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ spec: log.current.current, message }) }));
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Change failed");
      if (body.ops.length) log.current.commit(body.ops, { label: message.slice(0, 80), source: "ai" });
      setChat((c) => [...c, { from: "ai", text: body.ops.length ? "" : "No change was needed.", changes: body.changes }]);
      setStatus({ kind: "idle" });
    } catch (e) { setStatus({ kind: "error", message: (e as Error).message }); }
    bump((n) => n + 1);
  }

  useEffect(() => {
    if (started.current || !initialPrompt) return;
    started.current = true;
    void generate(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opts = useMemo(() => ({ locale: previewLocale ?? spec?.locale ?? locale, dark, rtl, platform }), [previewLocale, spec, locale, dark, rtl, platform]);
  const busy = status.kind === "busy";

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[360px_1fr]">
      <section aria-label="Chat" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <button disabled={!log.current?.canUndo} onClick={() => { log.current!.undo(); bump((n) => n + 1); }} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40">{t(locale, "studio.undo")}</button>
          <button disabled={!log.current?.canRedo} onClick={() => { log.current!.redo(); bump((n) => n + 1); }} className="rounded-full border px-3 py-1 text-sm disabled:opacity-40">{t(locale, "studio.redo")}</button>
        </div>
        <ol className="flex-1 space-y-2" aria-live="polite">
          {chat.map((c, i) => (
            <li key={i} className={`rounded-2xl p-3 text-sm ${c.from === "you" ? "bg-neutral-100" : "bg-blue-50"}`}>
              {c.text}
              {c.changes && <ul className="list-disc ps-5">{c.changes.map((x) => <li key={x}>{x}</li>)}</ul>}
            </li>
          ))}
        </ol>
        {busy && <p role="status" className="text-sm text-neutral-600">{status.step}…</p>}
        {status.kind === "error" && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {status.message} <button className="underline" onClick={() => (log.current ? iterate(chat.at(-1)?.text ?? "") : generate(lastPrompt.current))}>Retry</button>
          </p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); const m = msg.trim(); if (!m || busy) return; setMsg(""); void (log.current ? iterate(m) : generate(m)); }} className="flex gap-2">
          <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t(locale, "hero.placeholder")} aria-label={t(locale, "hero.placeholder")} className="w-full rounded-full border px-4 py-2" />
          <button disabled={busy || !msg.trim()} className="rounded-full bg-[var(--brand)] px-4 py-2 text-white disabled:opacity-40">→</button>
        </form>
      </section>

      <section aria-label="Preview" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select aria-label="Preview language" value={opts.locale} onChange={(e) => setPreviewLocale(e.target.value as Locale)} className="rounded border px-2 py-1">
            {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />Dark</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={rtl === true} onChange={(e) => setRtl(e.target.checked ? true : null)} />RTL</label>
          <select aria-label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as "ios" | "android")} className="rounded border px-2 py-1"><option value="ios">iOS</option><option value="android">Android</option></select>
        </div>
        {spec ? <PhonePreview key={spec.name + spec.screens.length + spec.navigation.join()} spec={spec} opts={opts} /> : <div className="mx-auto h-[580px] w-[300px] animate-pulse rounded-[44px] bg-neutral-200" aria-hidden />}
      </section>
    </main>
  );
}
