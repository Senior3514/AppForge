import { notFound } from "next/navigation";
import { LOCALES, LOCALE_NAMES, isLocale } from "@appforge/i18n";
import { MODULES } from "@appforge/modules";
import { PromptBox } from "../../components/PromptBox";

export default async function Landing({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <nav aria-label="Language" className="flex flex-wrap gap-3 text-sm text-neutral-600">
        {LOCALES.map((l) => (
          <a key={l} href={`/${l}`} hrefLang={l} aria-current={l === locale ? "page" : undefined} className={l === locale ? "font-semibold text-neutral-900" : "hover:underline"}>
            {LOCALE_NAMES[l]}
          </a>
        ))}
      </nav>
      <section className="py-16">
        <h1 className="mb-8 text-4xl font-bold tracking-tight sm:text-5xl">AppForge</h1>
        <PromptBox locale={locale} />
      </section>
      <section aria-labelledby="modules" className="pb-16">
        <h2 id="modules" className="sr-only">Modules</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.id} className="rounded-2xl border border-neutral-200 p-4">
              <p className="font-semibold">{m.title}</p>
              <p className="text-sm text-neutral-600">{m.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
