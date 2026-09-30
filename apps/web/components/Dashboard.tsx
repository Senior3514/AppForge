"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";
import { dateOnly } from "../lib/format";
import type { AppSummary } from "../lib/types";
import { useMe } from "../lib/useMe";
import { PromptBox } from "./PromptBox";

export function Dashboard({ locale }: { locale: Locale }) {
  const { me } = useMe();
  const [apps, setApps] = useState<AppSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setApps((await api<{ apps: AppSummary[] }>("/apps")).apps); }
    catch (e) { if (e instanceof ApiError && e.status === 401) window.location.href = `/${locale}/login?next=/${locale}/dashboard`; else setError(t(locale, "common.error")); }
  }, [locale]);
  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    if (!window.confirm(t(locale, "dash.confirmDelete"))) return;
    await api(`/apps/${id}`, { method: "DELETE" });
    await load();
  }

  const plan = me?.tenant;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{t(locale, "dash.title")}</h1>
        {plan && <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs">{tf(locale, "dash.plan", { plan: t(locale, `plan.${plan.effectivePlan}`) })}</span>}
        {plan?.status === "trialing" && plan.trialEndsAt && <span className="text-xs text-neutral-600">{tf(locale, "dash.trial", { date: dateOnly(plan.trialEndsAt, locale) })}</span>}
        <Link href={`/${locale}/pricing`} className="text-sm font-semibold underline">{t(locale, "dash.upgrade")}</Link>
        <button onClick={() => setCreating((v) => !v)} className="ms-auto rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white">{t(locale, "dash.new")}</button>
      </div>
      {me?.user?.anonymous && (
        <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{t(locale, "auth.claim")}{" "}
          <Link className="font-semibold underline" href={`/${locale}/signup`}>{t(locale, "nav.signup")}</Link></p>
      )}
      {creating && <div className="mt-6"><PromptBox locale={locale} autofocus /></div>}
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
      {apps && apps.length === 0 && !creating && <p className="mt-10 text-neutral-600">{t(locale, "dash.empty")}</p>}
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps?.map((a) => (
          <li key={a.id} className="rounded-2xl border border-neutral-200 p-4">
            <div className="flex items-center gap-3">
              <span aria-hidden className="h-10 w-10 rounded-xl" style={{ background: a.primary }} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-neutral-600">{t(locale, a.published ? "dash.published" : "dash.draft")} · {dateOnly(a.updatedAt, locale)}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 text-sm">
              <Link className="font-semibold underline" href={`/${locale}/studio/${a.id}`}>{t(locale, "dash.open")}</Link>
              <Link className="underline" href={`/${locale}/apps/${a.id}`}>{t(locale, "dash.manage")}</Link>
              <button className="ms-auto text-red-700 underline" onClick={() => void remove(a.id)}>{t(locale, "dash.delete")}</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
