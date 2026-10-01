"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../../lib/api";
import { dateTime, money } from "../../lib/format";
import type { ServerInfo } from "../../lib/types";

interface Order { id: string; items: { name: string; qty: number }[]; totalCents: number; currency: string; status: "pending" | "paid" | "failed" | "refunded"; provider: string; createdAt: string }

export function OrdersTab({ appId, locale, server }: { appId: string; locale: Locale; server: ServerInfo }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void api<{ orders: Order[] }>(`/apps/${appId}/orders`).then((r) => setOrders(r.orders)); }, [appId]);

  async function connect() {
    setBusy(true);
    try { const r = await api<{ url: string }>("/payments/connect", { method: "POST" }); window.location.href = r.url; }
    finally { setBusy(false); }
  }
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm text-slate-700">{t(locale, "orders.connectHint")}</p>
        <button disabled={busy} onClick={connect} className="mt-3 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(locale, "orders.connect")}</button>
        {server.payments === "mock" && <p className="mt-2 text-xs text-slate-600">{t(locale, "push.mockNote")}</p>}
      </div>
      {orders?.length === 0 && <p className="text-slate-600">{t(locale, "orders.empty")}</p>}
      {orders && orders.length > 0 && (
        <table className="w-full text-sm">
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-slate-200">
                <td className="py-2">{dateTime(o.createdAt, locale)}</td>
                <td className="py-2">{o.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}</td>
                <td className="py-2 text-end font-medium">{money(o.totalCents, o.currency, locale)}</td>
                <td className="py-2 text-end">{t(locale, `orders.${o.status}` as never)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
