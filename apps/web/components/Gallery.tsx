import { MockLlm, generateApp } from "@appforge/generator";
import { type Locale, t } from "@appforge/i18n";
import { PhonePreview } from "./PhonePreview";

const PROMPTS = { en: ["cafe with menu and rewards", "salon booking app", "online store for my products"], he: ["אפליקציה למסעדה שלי", "אפליקציה למספרה", "חנות אונליין"] } as const;

/** Pre-generated specs rendered with the same preview the studio uses. Deterministic, built on the server. */
export async function Gallery({ locale }: { locale: Locale }) {
  const prompts = PROMPTS[locale === "he" ? "he" : "en"];
  const specs = await Promise.all(prompts.map(async (p) => (await generateApp(p, { llm: new MockLlm(), locale: locale === "he" ? "he" : "en" })).spec));
  return (
    <section aria-labelledby="gallery" className="py-12">
      <h2 id="gallery" className="text-3xl font-bold">{t(locale, "gallery.title")}</h2>
      <p className="mt-2 text-neutral-700">{t(locale, "gallery.note")}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-8">
        {specs.map((spec) => <PhonePreview key={spec.name} spec={spec} opts={{ locale: spec.locale, dark: false, rtl: null, platform: "ios" }} />)}
      </div>
    </section>
  );
}
