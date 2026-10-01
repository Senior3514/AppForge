import { LOCALES, LOCALE_NAMES, dirOf, t, type Locale } from "@appforge/i18n";
import { Icon } from "./art";

/** Every supported language in its own script; links switch the whole site. */
export function LanguageChips({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="langs" className="py-16">
      <div className="flex items-center gap-3"><span className="icon-tile inline-flex h-11 w-11 items-center justify-center rounded-2xl"><Icon name="globe" /></span>
        <h2 id="langs" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "faq.q4")}</h2></div>
      <p className="mt-3 max-w-3xl text-slate-600">{t(locale, "faq.a4")}</p>
      <ul className="mt-8 flex flex-wrap gap-2.5">
        {LOCALES.map((l) => (
          <li key={l}>
            <a href={`/${l}`} lang={l} hrefLang={l} dir={dirOf(l)} aria-current={l === locale ? "page" : undefined}
              className={`card-lift inline-block rounded-full border px-4 py-2 text-base ${l === locale ? "border-indigo-300 bg-indigo-50 font-semibold text-indigo-800" : "border-slate-200 bg-white text-slate-700"}`}>
              {LOCALE_NAMES[l]}{dirOf(l) === "rtl" && <span className="ms-2 rounded bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-500" dir="ltr">RTL</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
