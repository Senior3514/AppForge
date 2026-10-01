"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";
import type { AppView } from "../lib/types";
import { useMe } from "../lib/useMe";
import { AnalyticsTab } from "./admin/AnalyticsTab";
import { BrandTab } from "./admin/BrandTab";
import { DataTab } from "./admin/DataTab";
import { OrdersTab } from "./admin/OrdersTab";
import { PublishTab } from "./admin/PublishTab";
import { PushTab } from "./admin/PushTab";

const TABS = ["publish", "data", "analytics", "orders", "push", "brand"] as const;
type Tab = (typeof TABS)[number];

export function AppAdmin({ locale, appId }: { locale: Locale; appId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useMe();
  const [app, setApp] = useState<AppView | null>(null);
  const [error, setError] = useState(false);
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "publish";

  const load = useCallback(async () => {
    try { setApp(await api<AppView>(`/apps/${appId}`)); }
    catch (e) { if (e instanceof ApiError && e.status === 401) window.location.href = `/${locale}/login?next=/${locale}/apps/${appId}`; else setError(true); }
  }, [appId, locale]);
  useEffect(() => { void load(); }, [load]);

  if (error) return <main className="p-10">404</main>;
  if (!app) return <main className="p-10 text-slate-600" aria-busy>{t(locale, "common.loading")}</main>;
  const currency = app.spec.screens.flatMap((s) => s.blocks).find((b) => b.module === "catalog")?.props.currency ?? "USD";
  const label = { publish: "admin.publish", data: "admin.data", analytics: "admin.analytics", orders: "admin.orders", push: "admin.push", brand: "admin.brand" } as const;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{app.name}</h1>
        <Link href={`/${locale}/studio/${appId}`} className="ms-auto text-sm font-semibold underline">{t(locale, "admin.back")}</Link>
      </div>
      <div role="tablist" className="mb-6 flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => router.replace(`/${locale}/apps/${appId}?tab=${k}`)}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === k ? "bg-slate-900 text-white" : "border border-slate-300"}`}>{t(locale, label[k])}</button>
        ))}
      </div>
      {tab === "publish" && <PublishTab app={app} locale={locale} server={me?.server ?? { llm: "mock" }} refresh={load} />}
      {tab === "data" && <DataTab appId={appId} spec={app.spec} locale={locale} />}
      {tab === "analytics" && <AnalyticsTab appId={appId} locale={locale} currency={currency} screenTitles={Object.fromEntries(app.spec.screens.map((s) => [s.id, s.title]))} />}
      {tab === "orders" && <OrdersTab appId={appId} locale={locale} server={me?.server ?? { llm: "mock" }} />}
      {tab === "push" && <PushTab appId={appId} locale={locale} />}
      {tab === "brand" && <BrandTab appId={appId} locale={locale} />}
    </main>
  );
}
