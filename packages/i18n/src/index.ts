import { en, type MessageKey } from "./messages/en";
import { he } from "./messages/he";

/** English is the default; Hebrew is the second language (right-to-left). */
export const LOCALES = ["en", "he"] as const;
export const DEFAULT_LOCALE = "en" as const satisfies (typeof LOCALES)[number];
export type Locale = (typeof LOCALES)[number];

const RTL: ReadonlySet<Locale> = new Set<Locale>(["he"]);
export const isRtl = (l: Locale): boolean => RTL.has(l);
export const dirOf = (l: Locale): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const LOCALE_NAMES: Record<Locale, string> = { en: "English", he: "עברית" };


export type { MessageKey };
/** Platform UI strings. Each language file is typed `Record<MessageKey, string>`, so a missing key is a compile error. */
export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, he };

export const t = (locale: Locale, key: MessageKey): string => MESSAGES[locale][key];

/** `t` with `{name}` placeholders filled in. */
export const tf = (locale: Locale, key: MessageKey, vars: Record<string, string | number>): string =>
  t(locale, key).replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** Example-prompt chips on the landing page; label doubles as the starter prompt in that language. */
export const EXAMPLE_KEYS = ["restaurant", "salon", "fitness", "ecommerce", "community", "radio", "church", "service", "loyalty"] as const;
export type ExampleKey = (typeof EXAMPLE_KEYS)[number];

export const EXAMPLES: Record<Locale, Record<ExampleKey, string>> = {
  en: { restaurant: "Restaurant", salon: "Salon booking", fitness: "Fitness coach", ecommerce: "E-commerce", community: "Community", radio: "Online radio", church: "Church / community", service: "Local service", loyalty: "Loyalty club" },
  he: { restaurant: "מסעדה", salon: "הזמנת תורים למספרה", fitness: "מאמן כושר", ecommerce: "חנות אונליין", community: "קהילה", radio: "רדיו אונליין", church: "בית כנסת / קהילה", service: "שירות מקומי", loyalty: "מועדון לקוחות" },
};
