import { notFound } from "next/navigation";
import { isLocale, t } from "@appforge/i18n";
import { MODULES } from "@appforge/modules";
import { CtaBand } from "../../components/CtaBand";
import { Faq } from "../../components/Faq";
import { Gallery } from "../../components/Gallery";
import { Hero } from "../../components/Hero";
import { LanguageChips } from "../../components/LanguageChips";
import { Pricing } from "../../components/Pricing";
import { IconTile, StepArt } from "../../components/art";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <Hero locale={locale} />
      <main className="mx-auto max-w-6xl px-4">
        <section aria-labelledby="how" className="py-16">
          <h2 id="how" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "how.title")}</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="card-lift rounded-3xl border border-slate-200 bg-white p-5">
                <StepArt n={n} />
                <div className="mt-4 flex items-center gap-3">
                  <span className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white">{n}</span>
                  <h3 className="text-lg font-semibold">{t(locale, `how.${n}.title` as never)}</h3>
                </div>
                <p className="mt-2 text-slate-600">{t(locale, `how.${n}.body` as never)}</p>
              </li>
            ))}
          </ol>
        </section>

        <Gallery locale={locale} />

        <section aria-labelledby="modules" className="py-16">
          <h2 id="modules" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "modules.title")}</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <li key={m.id} className="card-lift flex gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <IconTile name={m.id} />
                <div><p className="font-semibold">{t(locale, `mod.${m.id}.t` as never)}</p>
                  <p className="mt-1 text-sm text-slate-600">{t(locale, `mod.${m.id}.d` as never)}</p></div>
              </li>
            ))}
          </ul>
        </section>

        <LanguageChips locale={locale} />
        <Pricing locale={locale} />
        <Faq locale={locale} />
        <CtaBand locale={locale} />
      </main>
    </>
  );
}
