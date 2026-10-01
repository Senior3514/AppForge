"use client";
import { useCallback, useEffect, useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../../lib/api";
import { dateTime } from "../../lib/format";

interface Push { provider: string; devices: number; campaigns: { id: string; title: string; body: string; sendAt: string; status: string; sentCount: number; error: string | null }[] }

export function PushTab({ appId, locale }: { appId: string; locale: Locale }) {
  const [data, setData] = useState<Push | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [when, setWhen] = useState<"now" | "later">("now");
  const [at, setAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => setData(await api<Push>(`/apps/${appId}/push`)), [appId]);
  useEffect(() => { void load(); }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try {
      await api(`/apps/${appId}/push`, { method: "POST", body: { title, body, ...(when === "later" && at ? { sendAt: new Date(at).toISOString() } : {}) } });
      setTitle(""); setBody(""); await load();
    } catch (err) { setError(err instanceof ApiError ? err.message : t(locale, "common.error")); }
  }
  const input = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <div className="space-y-6">
      {data && <p className="text-sm text-slate-700">{tf(locale, "push.devices", { n: data.devices })} · {tf(locale, "push.provider", { name: data.provider })}</p>}
      {data?.provider === "mock" && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t(locale, "push.mockNote")}</p>}
      <form onSubmit={send} className="max-w-lg space-y-3">
        <label className="block text-sm font-medium">{t(locale, "push.title")}<input required maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} className={input} /></label>
        <label className="block text-sm font-medium">{t(locale, "push.body")}<textarea required maxLength={180} rows={3} value={body} onChange={(e) => setBody(e.target.value)} className={input} /></label>
        <fieldset className="flex flex-wrap items-center gap-4 text-sm">
          <legend className="sr-only">{t(locale, "push.when")}</legend>
          <label className="flex items-center gap-1"><input type="radio" checked={when === "now"} onChange={() => setWhen("now")} />{t(locale, "push.now")}</label>
          <label className="flex items-center gap-1"><input type="radio" checked={when === "later"} onChange={() => setWhen("later")} />{t(locale, "push.later")}</label>
          {when === "later" && <input type="datetime-local" required value={at} onChange={(e) => setAt(e.target.value)} className="rounded border px-2 py-1" />}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="rounded-full bg-[var(--brand)] px-5 py-2 text-sm font-semibold text-white">{t(locale, "push.send")}</button>
      </form>
      <ul className="space-y-2">
        {data?.campaigns.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
            <div className="min-w-0 flex-1"><p className="font-medium">{c.title}</p><p className="truncate text-slate-600">{c.body}</p></div>
            <span className="text-xs text-slate-600">{dateTime(c.sendAt, locale)}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{t(locale, `push.${c.status}` as never)}{c.status === "sent" ? ` · ${c.sentCount}` : ""}</span>
            {c.status === "scheduled" && <button className="text-xs text-red-700 underline" onClick={async () => { await api(`/apps/${appId}/push/${c.id}`, { method: "DELETE" }); await load(); }}>{t(locale, "push.cancel")}</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
