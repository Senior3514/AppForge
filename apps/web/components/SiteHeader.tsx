"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";
import { useEffect } from "react";
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
    <header className="border-b border-neutral-200">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
        <Link href={`/${locale}`} className="text-lg font-bold tracking-tight">AppForge</Link>
        <Link href={`/${locale}/pricing`} className="text-neutral-700 hover:underline">{t(locale, "nav.pricing")}</Link>
        {me?.user && <Link href={`/${locale}/dashboard`} className="text-neutral-700 hover:underline">{t(locale, "nav.dashboard")}</Link>}
        <span className="ms-auto" />
        <label className="sr-only" htmlFor="lang">Language</label>
        <select id="lang" value={locale} onChange={(e) => router.push(pathname.replace(/^\/[a-z]{2}(?=\/|$)/, `/${e.target.value}`))} className="rounded border border-neutral-300 px-2 py-1">
          {LOCALES.map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
        </select>
        {signedIn ? (
          <button onClick={logout} className="text-neutral-700 hover:underline">{t(locale, "nav.logout")}</button>
        ) : me ? (
          <>
            <Link href={`/${locale}/login`} className="text-neutral-700 hover:underline">{t(locale, "nav.login")}</Link>
            <Link href={`/${locale}/signup`} className="rounded-full bg-[var(--brand)] px-4 py-1.5 font-semibold text-white">{t(locale, "nav.signup")}</Link>
          </>
        ) : null}
      </nav>
    </header>
  );
}
