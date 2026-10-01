import { type Locale, t } from "@appforge/i18n";
import { demoSpecs } from "../lib/demo";
import { PhonePreview } from "./PhonePreview";

/** Example apps rendered with the same preview the studio uses. */
export async function Gallery({ locale }: { locale: Locale }) {
  const specs = await demoSpecs(locale, "gallery");
  return (
    <section aria-labelledby="gallery" className="py-16">
      <h2 id="gallery" className="text-3xl font-bold tracking-tight sm:text-4xl">{t(locale, "gallery.title")}</h2>
      <p className="mt-2 text-slate-600">{t(locale, "gallery.note")}</p>
      <div className="mt-10 flex flex-wrap justify-center gap-10 rounded-[2rem] bg-aurora px-4 py-12 ring-1 ring-slate-200">
        {specs.map((spec) => (
          <figure key={spec.name} className="space-y-4 text-center">
            <PhonePreview spec={spec} opts={{ locale: spec.locale, dark: false, rtl: null, platform: "ios" }} />
            <figcaption className="font-semibold">{spec.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
