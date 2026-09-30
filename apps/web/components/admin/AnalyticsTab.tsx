"use client";
import { useEffect, useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { api } from "../../lib/api";
import { money } from "../../lib/format";

interface Analytics {
  days: number; mau: number;
  dau: { day: string; users: number }[];
  screens: { screen: string; views: number }[];
  retention: { devices: number; returning: number; rate: number };
  orders: { paid: number; revenueCents: number };
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 p-4"><p className="text-xs text-neutral-600">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>;
}

export function AnalyticsTab({ appId, locale, currency }: { appId: string; locale: Locale; currency: string }) {
  const [data, setData] = useState<Analytics | null>(null);
  useEffect(() => { void api<Analytics>(`/apps/${appId}/analytics?days=30`).then(setData); }, [appId]);
  if (!data) return <p aria-busy>{t(locale, "common.loading")}</p>;
  if (data.mau === 0 && data.orders.paid === 0) return <p className="text-neutral-600">{t(locale, "an.empty")}</p>;

  const max = Math.max(1, ...data.dau.map((d) => d.users));
  const today = data.dau.at(-1)?.users ?? 0;
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-600">{tf(locale, "an.days", { n: data.days })}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t(locale, "an.dau")} value={String(today)} />
        <Stat label={t(locale, "an.mau")} value={String(data.mau)} />
        <Stat label={t(locale, "an.retention")} value={`${Math.round(data.retention.rate * 100)}%`} />
        <Stat label={t(locale, "an.revenue")} value={money(data.orders.revenueCents, currency, locale)} />
      </div>
      <figure>
        <figcaption className="mb-2 text-sm font-semibold">{t(locale, "an.dau")}</figcaption>
        <div role="img" aria-label={data.dau.map((d) => `${d.day}: ${d.users}`).join(", ")} className="flex h-32 items-end gap-1" dir="ltr">
          {data.dau.map((d) => <div key={d.day} title={`${d.day}: ${d.users}`} className="flex-1 rounded-t bg-[var(--brand)]" style={{ height: `${(d.users / max) * 100}%`, minHeight: 2 }} />)}
        </div>
      </figure>
      <div>
        <h3 className="mb-2 text-sm font-semibold">{t(locale, "an.screens")}</h3>
        <table className="w-full max-w-md text-sm"><tbody>
          {data.screens.map((s) => <tr key={s.screen} className="border-t border-neutral-200"><td className="py-1.5">{s.screen}</td><td className="py-1.5 text-end">{s.views}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}
