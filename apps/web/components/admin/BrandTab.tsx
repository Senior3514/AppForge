"use client";
import { useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../../lib/api";

interface Kit {
  names: string[]; monogram: string;
  palette: Record<"light" | "dark", Record<string, string>>;
  typography: { heading: string; body: string; note: string };
  assets: { id: string; width: number; height: number; note: string }[];
}

export function BrandTab({ appId, locale }: { appId: string; locale: Locale }) {
  const [kit, setKit] = useState<Kit | null>(null);
  useEffect(() => { void api<Kit>(`/apps/${appId}/branding`).then(setKit); }, [appId]);
  if (!kit) return <p aria-busy>{t(locale, "common.loading")}</p>;
  return (
    <div className="space-y-8">
      <section><h2 className="mb-2 font-semibold">{t(locale, "brand.names")}</h2>
        <ul className="flex flex-wrap gap-2">{kit.names.map((n) => <li key={n} className="rounded-full border border-neutral-300 px-3 py-1 text-sm">{n}</li>)}</ul></section>
      <section><h2 className="mb-2 font-semibold">{t(locale, "brand.palette")}</h2>
        {(["light", "dark"] as const).map((mode) => (
          <ul key={mode} className="mb-2 flex flex-wrap gap-2">
            {Object.entries(kit.palette[mode]).map(([k, v]) => (
              <li key={k} className="text-center text-xs"><span className="mb-1 block h-10 w-16 rounded-lg border border-neutral-200" style={{ background: v }} />{k}<br /><span dir="ltr" className="text-neutral-500">{v}</span></li>
            ))}
          </ul>
        ))}</section>
      <section><h2 className="mb-2 font-semibold">{t(locale, "brand.type")}</h2>
        <p className="text-sm">{kit.typography.heading} / {kit.typography.body}</p><p className="text-xs text-neutral-600">{kit.typography.note}</p></section>
      <section><h2 className="mb-2 font-semibold">{t(locale, "brand.assets")}</h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kit.assets.map((a) => (
            <li key={a.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/v1/apps/${appId}/branding/${a.id}.png`} alt={a.id} className="mx-auto h-36 w-auto rounded-lg bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px]" />
              <p className="mt-2 font-medium">{a.id} · {a.width}×{a.height}</p>
              <p className="text-xs text-neutral-600">{a.note}</p>
              <a href={`/api/v1/apps/${appId}/branding/${a.id}.png`} download={`${a.id}.png`} className="text-xs font-semibold underline">{t(locale, "brand.download")}</a>
            </li>
          ))}
        </ul></section>
    </div>
  );
}
