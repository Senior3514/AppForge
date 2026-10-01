"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { Logo } from "./art";
import { useMe } from "../lib/useMe";

export function SiteHeader({ locale }: { locale: Locale }) {
  const { me } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const local = !!me?.server.local;

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-200/70">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-bold tracking-tight"><Logo />AppForge</Link>
        {local ? (
          <>
            <Link href={`/${locale}/dashboard`} className="text-slate-700 hover:underline">{t(locale, "nav.dashboard")}</Link>
            <Link href={`/${locale}/settings`} className="text-slate-700 hover:underline">{t(locale, "nav.settings")}</Link>
          </>
        ) : (
          <Link href={`/${locale}#download`} className="text-slate-700 hover:underline">{t(locale, "nav.download")}</Link>
        )}
        <span className="ms-auto" />
        <label className="sr-only" htmlFor="lang">Language</label>
        <select id="lang" value={locale} onChange={(e) => router.push(pathname.replace(/^\/[a-z]{2}(?=\/|$)/, `/${e.target.value}`))} className="rounded border border-slate-300 px-2 py-1">
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </select>
        {!local && <Link href={`/${locale}#download`} className="btn-primary px-4 py-1.5">{t(locale, "nav.getApp")}</Link>}
      </nav>
    </header>
  );
}
