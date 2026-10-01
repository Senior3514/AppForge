import { t, type Locale } from "@appforge/i18n";
import { demoSpecs } from "../lib/demo";
import { Icon } from "./art";
import { PhonePreview } from "./PhonePreview";
import { DownloadButtons } from "./Download";
import { PromptBox } from "./PromptBox";

const OPTS = { dark: false, rtl: null, platform: "ios" } as const;

export async function Hero({ locale, local }: { locale: Locale; local: boolean }) {
  const [a, b, c] = await demoSpecs(locale, "hero");
  return (
    <section className="relative isolate overflow-hidden rounded-b-[2.5rem] bg-aurora">
      <div className="bg-grid absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1.15fr_.85fr] lg:py-20">
        <div>
          <p className="rise mb-5 inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-medium text-indigo-700 ring-1 ring-indigo-100">
            <Icon name="bolt" size={16} /> {t(locale, local ? "feat.store" : "dl.badge")}
          </p>
          <h1 className="rise-2 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl"><span className="text-brand-gradient">{t(locale, "hero.title")}</span></h1>
          <p className="rise-3 mt-5 max-w-xl text-lg text-slate-600">{t(locale, "hero.subtitle")}</p>
          {local
            ? <div id="prompt" className="glass rise-3 mt-8 max-w-2xl scroll-mt-24 rounded-[1.75rem] p-4"><PromptBox locale={locale} /></div>
            : <div className="rise-3 mt-8"><DownloadButtons locale={locale} id="hero-download" /><p className="mt-4 max-w-xl text-sm text-slate-500">{t(locale, "dl.heroNote")}</p></div>}
        </div>

        {/* Floating phones. Forced LTR so the arrangement is identical in RTL; each phone sets its own direction. */}
        <div dir="ltr" className="relative mx-auto hidden h-[560px] w-full max-w-[520px] lg:block" aria-hidden>
          <div className="float-a absolute -left-2 top-24 origin-center scale-[.72]"><PhonePreview spec={a!} opts={{ ...OPTS, locale: a!.locale }} /></div>
          <div className="float-b absolute left-1/2 top-0 z-10 -translate-x-1/2 scale-[.9]"><PhonePreview spec={b!} opts={{ ...OPTS, locale: b!.locale }} /></div>
          <div className="float-c absolute -right-2 top-32 origin-center scale-[.72]"><PhonePreview spec={c!} opts={{ ...OPTS, locale: c!.locale }} /></div>
        </div>
      </div>
    </section>
  );
}
