import { t, type Locale } from "@appforge/i18n";

const N = [1, 2, 3, 4, 5] as const;

export function Faq({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="faq" className="py-16">
      <h2 id="faq" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "faq.title")}</h2>
      <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-white">
        {N.map((n) => (
          <details key={n} className="group p-5 open:bg-indigo-50/40">
            <summary className="cursor-pointer text-lg font-medium marker:text-indigo-500">{t(locale, `faq.q${n}` as never)}</summary>
            <p className="mt-2 text-slate-600">{t(locale, `faq.a${n}` as never)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
