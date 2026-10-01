import Link from "next/link";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { Logo } from "./art";

export function Footer({ locale }: { locale: Locale }) {
  return (
    <footer className="mt-8 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 text-lg font-bold"><Logo size={30} /> AppForge</p>
          <p className="mt-3 max-w-sm text-sm text-slate-600">{t(locale, "footer.tagline")}</p>
          <nav aria-label="Footer" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <Link className="text-slate-700 hover:underline" href={`/${locale}/pricing`}>{t(locale, "nav.pricing")}</Link>
            <Link className="text-slate-700 hover:underline" href={`/${locale}/dashboard`}>{t(locale, "nav.dashboard")}</Link>
            <Link className="text-slate-700 hover:underline" href={`/${locale}/login`}>{t(locale, "nav.login")}</Link>
          </nav>
        </div>
        <ul className="flex flex-wrap content-start gap-x-4 gap-y-2 text-sm text-slate-600">
          {LOCALES.map((l) => <li key={l}><a href={`/${l}`} lang={l} hrefLang={l} className={l === locale ? "font-semibold text-slate-900" : "hover:underline"}>{LOCALE_NAMES[l]}</a></li>)}
        </ul>
      </div>
      <p className="border-t border-slate-200 py-4 text-center text-xs text-slate-500">© AppForge</p>
    </footer>
  );
}
