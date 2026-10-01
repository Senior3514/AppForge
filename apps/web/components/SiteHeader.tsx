"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";
import { useEffect } from "react";
import { Logo } from "./art";
import { useMe } from "../lib/useMe";

export function SiteHeader({ locale }: { locale: Locale }) {
  const { me, reload } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const signedIn = !!me?.user && !me.user.anonymous;
  // The header lives in the layout and survives navigation, so refresh the session whenever the page changes (login, signup, logout).
  useEffect(() => { void reload(); }, [pathname, reload]);

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    await reload();
    router.push(`/${locale}`);
  }

  return (
    <header className="glass sticky top-0 z-30 border-b border-slate-200/70">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href={`/${locale}`} className="flex items-center gap-2 text-lg font-bold tracking-tight"><Logo />AppForge</Link>
        <Link href={`/${locale}/pricing`} className="text-slate-700 hover:underline">{t(locale, "nav.pricing")}</Link>
        {me?.user && <Link href={`/${locale}/dashboard`} className="text-slate-700 hover:underline">{t(locale, "nav.dashboard")}</Link>}
        {signedIn && <Link href={`/${locale}/settings`} className="text-slate-700 hover:underline">{t(locale, "nav.settings")}</Link>}
        {me?.user?.operator && <Link href={`/${locale}/operator`} className="text-slate-700 hover:underline">{t(locale, "nav.operator")}</Link>}
        <span className="ms-auto" />
        <label className="sr-only" htmlFor="lang">Language</label>
        <select id="lang" value={locale} onChange={(e) => router.push(pathname.replace(/^\/[a-z]{2}(?=\/|$)/, `/${e.target.value}`))} className="rounded border border-slate-300 px-2 py-1">
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </select>
        {signedIn ? (
          <button onClick={logout} className="text-slate-700 hover:underline">{t(locale, "nav.logout")}</button>
        ) : me ? (
          <>
            <Link href={`/${locale}/login`} className="text-slate-700 hover:underline">{t(locale, "nav.login")}</Link>
            <Link href={`/${locale}/signup`} className="btn-primary px-4 py-1.5">{t(locale, "nav.signup")}</Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
