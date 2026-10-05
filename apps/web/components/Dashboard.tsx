"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";
import { dateOnly } from "../lib/format";
import type { AppSummary } from "../lib/types";
import { useMe } from "../lib/useMe";
import { Icon } from "./art";
import { PromptBox } from "./PromptBox";

export function Dashboard({ locale }: { locale: Locale }) {
  const { me } = useMe();
  const [apps, setApps] = useState<AppSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setApps((await api<{ apps: AppSummary[] }>("/apps")).apps); }
    catch { setError(t(locale, "common.error")); }
  }, [locale]);
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!window.confirm(t(locale, "dash.confirmDelete"))) return;
    await api(`/apps/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{t(locale, "dash.title")}</h1>
        <button onClick={() => setCreating((v) => !v)} className="btn-primary ms-auto inline-flex items-center gap-1.5 px-5 py-2 text-sm"><Icon name="bolt" size={16} />{t(locale, "dash.new")}</button>
      </div>
      {me?.aiSource === "mock" && (
        <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900" data-testid="ai-banner">{t(locale, "dash.aiBanner")} <Link href={`/${locale}/settings`} className="font-semibold underline">{t(locale, "dash.aiBannerLink")}</Link></p>
      )}
      {creating && <div className="mt-6"><PromptBox locale={locale} autofocus /></div>}
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {apps && apps.length === 0 && !creating && <p className="mt-10 text-slate-600">{t(locale, "dash.empty")}</p>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps?.map((a) => (
          <li key={a.id} className="card-lift overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <div className="relative h-24 px-5 pt-5" style={{ background: `linear-gradient(135deg, ${a.primary}, color-mix(in srgb, ${a.primary} 55%, #ec4899))` }}>
              <span aria-hidden className="absolute -bottom-6 end-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl font-extrabold shadow-lg" style={{ color: a.primary }}>{Array.from(a.name)[0]?.toLocaleUpperCase()}</span>
              <span className="rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-medium text-white">{t(locale, a.published ? "dash.published" : "dash.draft")}</span>
            </div>
            <div className="p-5 pt-4">
              <p className="truncate text-lg font-semibold">{a.name}</p>
              <p className="text-xs text-slate-500">{dateOnly(a.updatedAt, locale)}</p>
              <div className="mt-4 flex items-center gap-4 text-sm">
                <Link className="btn-primary px-4 py-1.5" href={`/${locale}/studio/${a.id}`}>{t(locale, "dash.open")}</Link>
                <Link className="font-medium text-slate-700 underline-offset-2 hover:underline" href={`/${locale}/apps/${a.id}`}>{t(locale, "dash.manage")}</Link>
                <button className="ms-auto text-red-700 hover:underline" onClick={() => void remove(a.id)}>{t(locale, "dash.delete")}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
