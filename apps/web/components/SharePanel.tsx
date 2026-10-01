"use client";
import { useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";

export function SharePanel({ appId, locale, onShared }: { appId: string; locale: Locale; onShared: () => void }) {
  const [link, setLink] = useState<{ token: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    try { setLink(await api<{ token: string; url: string }>(`/apps/${appId}/share`, { method: "POST" })); onShared(); }
    finally { setBusy(false); }
  }
  async function revoke() { await api(`/apps/${appId}/share`, { method: "DELETE" }); setLink(null); onShared(); }
  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link.url).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg">
      {!link ? (
        <button onClick={create} disabled={busy} className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(locale, "studio.share")}</button>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/v1/apps/${appId}/share/qr.svg`} alt="QR" width={180} height={180} className="mx-auto" />
          <p className="text-xs text-slate-600">{t(locale, "studio.shareHint")}</p>
          <div className="flex items-center gap-2">
            <input readOnly value={link.url} aria-label="link" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" dir="ltr" onFocus={(e) => e.target.select()} />
            <button onClick={copy} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">{copied ? t(locale, "studio.copied") : t(locale, "studio.copy")}</button>
          </div>
          <button onClick={revoke} className="text-xs text-red-700 underline">{t(locale, "studio.revoke")}</button>
        </>
      )}
    </div>
  );
}
