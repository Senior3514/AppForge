import { notFound } from "next/navigation";
import { isLocale, t } from "@appforge/i18n";
import { MODULES } from "@appforge/modules";
import { Faq } from "../../components/Faq";
import { Gallery } from "../../components/Gallery";
import { Pricing } from "../../components/Pricing";
import { PromptBox } from "../../components/PromptBox";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-6xl px-4">
      <section className="py-16">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">{t(locale, "hero.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg text-neutral-700">{t(locale, "hero.subtitle")}</p>
        <div className="mt-8 max-w-3xl"><PromptBox locale={locale} /></div>
      </section>

      <section aria-labelledby="how" className="py-12">
        <h2 id="how" className="text-3xl font-bold">{t(locale, "how.title")}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="rounded-2xl border border-neutral-200 p-5">
              <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] font-bold text-white">{n}</span>
              <h3 className="text-lg font-semibold">{t(locale, `how.${n}.title` as never)}</h3>
              <p className="mt-1 text-neutral-700">{t(locale, `how.${n}.body` as never)}</p>
            </li>
          ))}
        </ol>
      </section>

      <Gallery locale={locale} />

      <section aria-labelledby="modules" className="py-12">
        <h2 id="modules" className="text-3xl font-bold">{t(locale, "modules.title")}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.id} className="rounded-2xl border border-neutral-200 p-4">
              <p className="font-semibold">{t(locale, `mod.${m.id}.t` as never)}</p>
              <p className="text-sm text-neutral-700">{t(locale, `mod.${m.id}.d` as never)}</p>
            </li>
          ))}
        </ul>
      </section>

      <Pricing locale={locale} />
      <Faq locale={locale} />
    </main>
  );
}
