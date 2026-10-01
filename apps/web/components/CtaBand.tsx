import { t, type Locale } from "@appforge/i18n";
import { Icon } from "./art";

export function CtaBand({ locale, local }: { locale: Locale; local: boolean }) {
  return (
    <section className="my-16">
      <div className="bg-brand-gradient relative overflow-hidden rounded-[2rem] px-6 py-14 text-center text-white sm:px-12">
        <div className="bg-grid absolute inset-0 opacity-30" aria-hidden />
        <Icon name="bolt" size={36} className="relative mx-auto mb-4 opacity-90" />
        <h2 className="relative mx-auto max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">{t(locale, "hero.title")}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/85">{t(locale, "footer.tagline")}</p>
        <a href={local ? "#prompt" : "#download"} className="relative mt-8 inline-block rounded-full bg-white px-8 py-3.5 font-bold text-indigo-700 shadow-xl transition hover:scale-[1.03]">{t(locale, local ? "hero.cta" : "dl.cta")}</a>
      </div>
    </section>
  );
}
