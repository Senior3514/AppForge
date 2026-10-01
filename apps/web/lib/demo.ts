import { MockLlm, generateApp } from "@appforge/generator";
import type { Locale } from "@appforge/i18n";
import type { AppSpec } from "@appforge/modules";

const PROMPTS = {
  en: { hero: ["salon booking app", "cafe with menu and rewards", "online store for my products"], gallery: ["fitness coach classes", "community radio station", "restaurant with menu"] },
  he: { hero: ["אפליקציה למספרה", "אפליקציה למסעדה שלי", "חנות אונליין"], gallery: ["מאמן כושר", "רדיו קהילתי", "מסעדה"] },
} as const;

/** Deterministic example apps rendered on the landing page (server-side, no network, same generator the product uses). */
export async function demoSpecs(locale: Locale, set: "hero" | "gallery"): Promise<AppSpec[]> {
  const l = locale === "he" ? "he" : "en";
  return Promise.all(PROMPTS[l][set].map(async (p) => (await generateApp(p, { llm: new MockLlm(), locale: l })).spec));
}
