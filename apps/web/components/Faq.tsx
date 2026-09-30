import { t, type Locale } from "@appforge/i18n";

const N = [1, 2, 3, 4, 5] as const;

export function Faq({ locale }: { locale: Locale }) {
  return (
    <section aria-labelledby="faq" className="py-12">
      <h2 id="faq" className="text-3xl font-bold">{t(locale, "faq.title")}</h2>
      <div className="mt-6 divide-y divide-neutral-200 rounded-2xl border border-neutral-200">
        {N.map((n) => (
          <details key={n} className="group p-4">
            <summary className="cursor-pointer font-medium">{t(locale, `faq.q${n}` as never)}</summary>
            <p className="mt-2 text-neutral-700">{t(locale, `faq.a${n}` as never)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
