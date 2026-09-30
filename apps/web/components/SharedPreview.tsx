"use client";
import { useEffect, useState } from "react";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import type { AppSpec } from "@appforge/modules";
import { api } from "../lib/api";
import { PhonePreview } from "./PhonePreview";

/** Public, read-only preview reached from a share link or QR code. No account needed. */
export function SharedPreview({ locale, token }: { locale: Locale; token: string }) {
  const [spec, setSpec] = useState<AppSpec | null>(null);
  const [gone, setGone] = useState(false);
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState<Locale | null>(null);
  useEffect(() => { api<{ spec: AppSpec }>(`/public/preview/${token}`).then((r) => setSpec(r.spec)).catch(() => setGone(true)); }, [token]);

  if (gone) return <main className="p-10 text-center">{t(locale, "preview.expired")}</main>;
  if (!spec) return <main className="p-10 text-center text-neutral-600" aria-busy>{t(locale, "common.loading")}</main>;
  return (
    <main className="mx-auto max-w-md px-4 py-8 text-center">
      <h1 className="mb-1 text-xl font-bold">{spec.name}</h1>
      <p className="mb-4 text-sm text-neutral-600">{t(locale, "preview.title")}</p>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-sm">
        <select aria-label={t(locale, "studio.lang")} value={lang ?? spec.locale} onChange={(e) => setLang(e.target.value as Locale)} className="rounded border px-2 py-1">
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </select>
        <label className="flex items-center gap-1"><input type="checkbox" checked={dark} onChange={(e) => setDark(e.target.checked)} />{t(locale, "studio.dark")}</label>
      </div>
      <PhonePreview spec={spec} opts={{ locale: lang ?? spec.locale, dark, rtl: null, platform: "ios" }} />
      <a href={`appforge://?token=${encodeURIComponent(token)}`} className="mt-6 inline-block rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold">{t(locale, "preview.open")}</a>
    </main>
  );
}
