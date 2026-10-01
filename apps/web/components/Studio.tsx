"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";
import type { Op } from "../lib/ops";
import type { AppView } from "../lib/types";
import { describeChanges } from "../lib/changes";
import { useMe } from "../lib/useMe";
import { HistoryPanel } from "./HistoryPanel";
import { Inspector } from "./Inspector";
import { PhonePreview } from "./PhonePreview";
import { SharePanel } from "./SharePanel";

interface ChatLine { from: "you" | "ai"; text: string; changes?: string[] }
const btn = "rounded-full border border-neutral-300 px-3 py-1 text-sm disabled:opacity-40";

export function Studio({ locale, appId }: { locale: Locale; appId: string }) {
  const { me } = useMe();
  const [app, setApp] = useState<AppView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [msg, setMsg] = useState("");
  const [side, setSide] = useState<"edit" | "history">("edit");
  const [showShare, setShowShare] = useState(false);
  const [dark, setDark] = useState(false);
  const [previewLocale, setPreviewLocale] = useState<Locale | null>(null);
  const [rtl, setRtl] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const lastMessage = useRef("");

  useEffect(() => {
    api<AppView>(`/apps/${appId}`).then(setApp).catch((e) => {
      if (e instanceof ApiError && e.status === 401) window.location.href = `/${locale}/login?next=/${locale}/studio/${appId}`;
      else setError(e instanceof ApiError && e.status === 404 ? "404" : t(locale, "common.error"));
    });
  }, [appId, locale]);

  /** Runs one server call that returns the new AppView, with shared busy/error handling. */
  const run = useCallback(async (fn: () => Promise<AppView & { changes?: string[]; ops?: Op[]; note?: string }>, onOk?: (r: AppView & { changes?: string[]; ops?: Op[]; note?: string }) => void) => {
    setBusy(true); setError(null);
    try { const r = await fn(); setApp(r); onOk?.(r); }
    catch (e) { setError(e instanceof ApiError ? e.message : t(locale, "common.error")); }
    finally { setBusy(false); }
  }, [locale]);

  const sendChat = useCallback((message: string) => {
    lastMessage.current = message;
    setChat((c) => [...c, { from: "you", text: message }]);
    return run(() => api(`/apps/${appId}/chat`, { method: "POST", body: { message } }),
      (r) => setChat((c) => [...c, { from: "ai", text: r.ops?.length ? "" : t(locale, "studio.noChange"), changes: r.ops ? describeChanges(locale, r.ops) : undefined }]));
  }, [appId, locale, run]);

  const edit = useCallback((ops: Op[], label: string) => run(() => api(`/apps/${appId}/edit`, { method: "POST", body: { label, ops } })), [appId, run]);
  const undo = () => run(() => api(`/apps/${appId}/undo`, { method: "POST" }));
  const redo = () => run(() => api(`/apps/${appId}/redo`, { method: "POST" }));
  const jump = (seq: number) => run(async () => {
    const applied = app!.history.filter((h) => h.applied).length;
    let v: AppView = app!;
    for (let i = 0; i < Math.abs(seq - applied); i++) v = await api<AppView>(`/apps/${appId}/${seq < applied ? "undo" : "redo"}`, { method: "POST" });
    return v;
  });
  const translateWithAi = (target: Locale) => void sendChat(`Translate every customer-visible text into ${LOCALE_NAMES[target]} by filling translations.${target} (keys are the source strings).`);

  if (error === "404") return <main className="p-10">404</main>;
  if (!app) return <main className="p-10 text-neutral-600" aria-busy>{error ?? t(locale, "studio.loading")}</main>;

  const opts = { locale: previewLocale ?? app.spec.locale, dark, rtl, platform };
  return (
    <main className="mx-auto max-w-[1400px] px-4 py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="me-2 truncate text-lg font-bold">{app.name}</h1>
        <button className={btn} disabled={!app.canUndo || busy} onClick={undo}>↶ {t(locale, "studio.undo")}</button>
        <button className={btn} disabled={!app.canRedo || busy} onClick={redo}>↷ {t(locale, "studio.redo")}</button>
        <div className="relative ms-auto">
          <button className={btn} aria-expanded={showShare} onClick={() => setShowShare((v) => !v)}>📱 {t(locale, "studio.share")}</button>
          {showShare && <div className="absolute end-0 z-20 mt-2 w-72"><SharePanel appId={appId} locale={locale} onShared={() => void api<AppView>(`/apps/${appId}`).then(setApp)} /></div>}
        </div>
        <Link href={`/${locale}/apps/${appId}?tab=publish`} className="rounded-full bg-[var(--brand)] px-4 py-1.5 text-sm font-semibold text-white">{t(locale, "studio.manage")}</Link>
      </div>

      {me?.user?.anonymous && (
        <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{t(locale, "auth.claim")}{" "}
          <Link className="font-semibold underline" href={`/${locale}/signup?next=/${locale}/studio/${appId}`}>{t(locale, "nav.signup")}</Link></p>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr_340px]">
        <section aria-label={t(locale, "studio.chat")} className="flex min-h-[320px] flex-col gap-3 lg:max-h-[calc(100vh-140px)]">
          <ol className="flex-1 space-y-2 overflow-y-auto" aria-live="polite">
            {chat.map((c, i) => (
              <li key={i} className={`rounded-2xl p-3 text-sm ${c.from === "you" ? "bg-neutral-100" : "bg-blue-50"}`}>
                {c.text}
                {c.changes && <ul className="list-disc ps-5">{c.changes.map((x) => <li key={x}>{x}</li>)}</ul>}
              </li>
            ))}
          </ol>
          {busy && <p role="status" className="text-sm text-neutral-600">{t(locale, "common.loading")}</p>}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
              {error} {lastMessage.current && <button className="underline" onClick={() => void sendChat(lastMessage.current)}>{t(locale, "studio.retry")}</button>}
            </p>
          )}
          <form onSubmit={(e) => { e.preventDefault(); const m = msg.trim(); if (!m || busy) return; setMsg(""); void sendChat(m); }} className="flex gap-2">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t(locale, "hero.placeholder")} aria-label={t(locale, "studio.chat")} className="min-w-0 flex-1 rounded-full border border-neutral-300 px-4 py-2" />
            <button disabled={busy || !msg.trim()} className="rounded-full bg-[var(--brand)] px-4 py-2 text-white disabled:opacity-40" aria-label={t(locale, "studio.send")}>→</button>
          </form>
        </section>

        <section aria-label="Preview" className="space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <select aria-label={t(locale, "studio.lang")} value={opts.locale} onChange={(e) => setPreviewLocale(e.target.value as Locale)} className="rounded border px-2 py-1">
              {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
            </select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{t(locale, "studio.dark")}</label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={rtl === true} onChange={(e) => setRtl(e.target.checked ? true : null)} />{t(locale, "studio.rtl")}</label>
            <select aria-label={t(locale, "studio.device")} value={platform} onChange={(e) => setPlatform(e.target.value as "ios" | "android")} className="rounded border px-2 py-1"><option value="ios">iOS</option><option value="android">Android</option></select>
          </div>
          <PhonePreview key={app.spec.screens.map((s) => s.id).join() + app.spec.navigation.join()} spec={app.spec} opts={opts} />
        </section>

        <section aria-label={t(locale, "studio.inspector")} className="lg:max-h-[calc(100vh-140px)] lg:overflow-y-auto">
          <div role="tablist" className="mb-3 flex gap-2">
            {(["edit", "history"] as const).map((k) => (
              <button key={k} role="tab" aria-selected={side === k} onClick={() => setSide(k)} className={`rounded-full px-3 py-1 text-sm ${side === k ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>
                {t(locale, k === "edit" ? "studio.inspector" : "studio.history")}
              </button>
            ))}
          </div>
          {side === "edit"
            ? <Inspector spec={app.spec} locale={locale} edit={edit} translateWithAi={translateWithAi} llm={me?.server.llm ?? "mock"} busy={busy} />
            : <HistoryPanel app={app} locale={locale} jump={jump} busy={busy} />}
        </section>
      </div>
    </main>
  );
}
