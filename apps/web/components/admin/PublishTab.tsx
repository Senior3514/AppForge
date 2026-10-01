"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../../lib/api";
import { dateTime } from "../../lib/format";
import type { AppView, ServerInfo } from "../../lib/types";

interface Item { id: string; owner: "us" | "you"; status: "done" | "todo" | "blocked" }
interface Listing {
  title: string; subtitle: string; shortDescription: string; fullDescription: string; keywords: string; category: { apple: string; play: string };
  privacyPolicyUrl: string; note: string | null; screenshotsNote: string;
  dataSafety: { collects: { dataType: string; purpose: string }[]; deletionRequest: string };
  screenshots: { platform: "ios" | "android"; screen: string; path: string }[];
  limits: Record<string, number>;
}
interface Build { id: string; platform: string; status: string; bundleId: string; log: string; provider: string; createdAt: string }

const card = "rounded-2xl border border-neutral-200 p-5";
const STATUS_STYLE = { done: "bg-green-100 text-green-900", todo: "bg-neutral-100 text-neutral-800", blocked: "bg-red-100 text-red-900" } as const;

export function PublishTab({ app, locale, server, refresh }: { app: AppView; locale: Locale; server: ServerInfo; refresh: () => Promise<void> }) {
  const [items, setItems] = useState<Item[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [submit, setSubmit] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = app.id;

  const loadChecklist = useCallback(async () => setItems((await api<{ items: Item[] }>(`/apps/${id}/publish/checklist`)).items), [id]);
  const loadBuilds = useCallback(async () => setBuilds((await api<{ builds: Build[] }>(`/apps/${id}/builds`)).builds), [id]);
  useEffect(() => { void loadChecklist(); void loadBuilds(); }, [loadChecklist, loadBuilds]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setMessage(null);
    try { await fn(); await refresh(); await loadChecklist(); }
    catch (e) { setMessage(e instanceof ApiError ? (e.status === 402 ? t(locale, "build.needPlan") : e.status === 409 ? t(locale, "build.needPublish") : e.message) : t(locale, "common.error")); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="font-semibold">{t(locale, "pub.web")}</h2>
        <p className="mt-1 text-sm text-neutral-700">{t(locale, "pub.webBody")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={busy} onClick={() => void act(() => api(`/apps/${id}/publish`, { method: "POST" }))} className="rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(locale, "pub.webBtn")}</button>
          {app.publishedAt && (
            <>
              <span className="text-sm text-green-800">{tf(locale, "pub.webDone", { date: dateTime(app.publishedAt, locale) })}</span>
              <button disabled={busy} onClick={() => void act(() => api(`/apps/${id}/unpublish`, { method: "POST" }))} className="text-sm underline">{t(locale, "pub.unpublish")}</button>
            </>
          )}
        </div>
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t(locale, "pub.checklist")}</h2>
        <ul className="mt-3 space-y-2">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[i.status]}`}>{t(locale, `ck.${i.status}` as never)}</span>
              <span className="flex-1">{t(locale, `ck.${i.id}` as never)}</span>
              <span className="text-xs text-neutral-600">{t(locale, i.owner === "you" ? "ck.you" : "ck.us")}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-neutral-600">{t(locale, "pub.ownNote")}</p>
        {items.some((i) => i.id === "plan" && i.status === "blocked") && <Link className="mt-2 inline-block text-sm font-semibold underline" href={`/${locale}/pricing`}>{t(locale, "dash.upgrade")}</Link>}
      </section>

      <section className={card}>
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{t(locale, "listing.title")}</h2>
          <button disabled={busy} onClick={() => void act(async () => setListing(await api<Listing>(`/apps/${id}/store-listing`, { method: "POST" })))} className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm">{t(locale, "listing.generate")}</button>
        </div>
        {listing && <ListingView listing={listing} appId={id} locale={locale} />}
      </section>

      <section className={card}>
        <h2 className="font-semibold">{t(locale, "build.title")}</h2>
        {server.builds === "mock" && <p className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t(locale, "build.mock")}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <select aria-label="platform" value={platform} onChange={(e) => setPlatform(e.target.value as "ios" | "android")} className="rounded border px-2 py-1.5">
            <option value="ios">{t(locale, "build.ios")}</option><option value="android">{t(locale, "build.android")}</option>
          </select>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={submit} onChange={(e) => setSubmit(e.target.checked)} />{t(locale, "build.submit")}</label>
          <button disabled={busy} onClick={() => void act(async () => { await api(`/apps/${id}/builds`, { method: "POST", body: { platform, submit } }); await loadBuilds(); })} className="rounded-full bg-neutral-900 px-5 py-2 font-semibold text-white disabled:opacity-50">{t(locale, "build.start")}</button>
        </div>
        {message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}
        {builds.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold">{t(locale, "build.history")}</h3>
            <ul className="mt-2 space-y-2">
              {builds.map((b) => (
                <li key={b.id} className="rounded-xl border border-neutral-200 p-3 text-xs">
                  <p className="font-medium">{b.platform} · {b.status} · {b.provider} · {dateTime(b.createdAt, locale)}</p>
                  <pre className="mt-1 whitespace-pre-wrap text-neutral-600" dir="ltr">{b.log}</pre>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function ListingView({ listing, appId, locale }: { listing: Listing; appId: string; locale: Locale }) {
  const row = (label: string, value: string, limit?: number) => (
    <label key={label} className="block space-y-1">
      <span className="flex items-center justify-between text-xs font-medium text-neutral-700"><span>{label}</span>
        <span className={limit && value.length > limit ? "text-red-700" : "text-neutral-500"}>{tf(locale, "listing.chars", { n: value.length })}{limit ? ` / ${limit}` : ""}</span></span>
      <textarea readOnly rows={value.length > 90 ? 6 : 1} value={value} dir="auto" className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm" onFocus={(e) => e.target.select()} />
    </label>
  );
  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-neutral-700">{listing.note ?? t(locale, "listing.note")}</p>
      {row(t(locale, "listing.fieldTitle"), listing.title, listing.limits.title)}
      {row(t(locale, "listing.subtitle"), listing.subtitle, listing.limits.subtitle)}
      {row(t(locale, "listing.short"), listing.shortDescription, listing.limits.shortDescription)}
      {row(t(locale, "listing.full"), listing.fullDescription, listing.limits.fullDescription)}
      {row(t(locale, "listing.keywords"), listing.keywords, listing.limits.keywords)}
      {row(t(locale, "listing.category"), `App Store: ${listing.category.apple} · Google Play: ${listing.category.play}`)}
      {row(t(locale, "listing.privacy"), listing.privacyPolicyUrl)}
      <div>
        <h3 className="text-sm font-semibold">{t(locale, "listing.dataSafety")}</h3>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
          {listing.dataSafety.collects.map((c) => <li key={c.dataType}>{c.dataType} ({c.purpose})</li>)}
          <li>{listing.dataSafety.deletionRequest}</li>
        </ul>
      </div>
      <div>
        <h3 className="text-sm font-semibold">{t(locale, "listing.screenshots")}</h3>
        <p className="text-xs text-neutral-600">{listing.screenshotsNote}</p>
        <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
          {listing.screenshots.filter((s) => s.platform === "ios").map((s) => (
            <a key={s.path} href={s.path} download className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.path.replace("/v1/", "/api/v1/")} alt={s.screen} width={120} className="rounded-lg border border-neutral-200" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
