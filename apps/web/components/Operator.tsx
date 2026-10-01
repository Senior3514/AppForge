"use client";
import { useCallback, useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";
import { dateOnly } from "../lib/format";

interface Overview {
  totals: Record<"users" | "guests" | "apps" | "published" | "paying" | "own_keys", number>;
  ai: { source: string; calls: number; cost: number }[];
  users: { id: string; email: string; verified: boolean; blocked: boolean; created_at: string; plan: string; apps: number }[];
}

export function Operator({ locale }: { locale: Locale }) {
  const [data, setData] = useState<Overview | null>(null);
  const [denied, setDenied] = useState(false);
  const load = useCallback(() => api<Overview>("/operator/overview").then(setData).catch(() => setDenied(true)), []);
  useEffect(() => { void load(); }, [load]);

  if (denied) return <main className="px-4 py-14"><p>404</p></main>;
  if (!data) return <main className="px-4 py-14"><p aria-busy>{t(locale, "common.loading")}</p></main>;
  const stats: [string, number][] = [
    [t(locale, "op.users"), data.totals.users], [t(locale, "op.guests"), data.totals.guests], [t(locale, "op.apps"), data.totals.apps],
    [t(locale, "op.published"), data.totals.published], [t(locale, "op.paying"), data.totals.paying], [t(locale, "op.ownKeys"), data.totals.own_keys],
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t(locale, "op.title")}</h1>
      <ul className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([label, n]) => <li key={label} className="glass rounded-2xl p-4"><p className="text-2xl font-bold">{n}</p><p className="text-xs text-slate-600">{label}</p></li>)}
      </ul>
      <section className="glass mb-8 rounded-2xl p-4">
        <h2 className="mb-2 font-semibold">{t(locale, "op.ai30")}</h2>
        <ul className="text-sm">{data.ai.map((a) => <li key={a.source}>{a.source}: {a.calls} · ${a.cost.toFixed(2)}</li>)}</ul>
      </section>
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-start text-sm">
          <thead><tr className="text-xs text-slate-600"><th className="p-3 text-start">{t(locale, "auth.email")}</th><th className="p-3 text-start">Plan</th><th className="p-3 text-start">{t(locale, "op.apps")}</th><th className="p-3 text-start">{t(locale, "op.verified")}</th><th className="p-3" /></tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id} className="border-t border-slate-200/70">
                <td className="p-3" dir="ltr">{u.email}<span className="ms-2 text-xs text-slate-500">{dateOnly(u.created_at, locale)}</span></td>
                <td className="p-3">{u.plan}</td><td className="p-3">{u.apps}</td>
                <td className="p-3">{t(locale, u.verified ? "op.verified" : "op.unverified")}{u.blocked && <span className="ms-2 rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">{t(locale, "op.blocked")}</span>}</td>
                <td className="p-3 text-end"><button onClick={async () => { await api(`/operator/users/${u.id}/block`, { method: "POST", body: { blocked: !u.blocked } }); await load(); }} className="text-xs font-semibold underline">{t(locale, u.blocked ? "op.unblock" : "op.block")}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
