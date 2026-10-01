import { ar } from "./messages/ar";
import { de } from "./messages/de";
import { en, type MessageKey } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { he } from "./messages/he";
import { pt } from "./messages/pt";
import { ru } from "./messages/ru";

export const LOCALES = ["en", "he", "ar", "es", "fr", "de", "pt", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

const RTL: ReadonlySet<Locale> = new Set<Locale>(["he", "ar"]);
export const isRtl = (l: Locale): boolean => RTL.has(l);
export const dirOf = (l: Locale): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", he: "עברית", ar: "العربية", es: "Español",
  fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский",
};


export type { MessageKey };
/** Platform UI strings. Each language file is typed `Record<MessageKey, string>`, so a missing key is a compile error. */
export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, he, ar, es, fr, de, pt, ru };

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
  ar: { restaurant: "مطعم", salon: "حجز صالون", fitness: "مدرب لياقة", ecommerce: "متجر إلكتروني", community: "مجتمع", radio: "راديو عبر الإنترنت", church: "كنيسة / جمعية", service: "خدمة محلية", loyalty: "نادي ولاء" },
  es: { restaurant: "Restaurante", salon: "Reservas de salón", fitness: "Entrenador personal", ecommerce: "Tienda online", community: "Comunidad", radio: "Radio online", church: "Iglesia / comunidad", service: "Servicio local", loyalty: "Club de fidelidad" },
  fr: { restaurant: "Restaurant", salon: "Réservation salon", fitness: "Coach sportif", ecommerce: "Boutique en ligne", community: "Communauté", radio: "Radio en ligne", church: "Église / association", service: "Service local", loyalty: "Club de fidélité" },
  de: { restaurant: "Restaurant", salon: "Salon-Buchung", fitness: "Fitness-Coach", ecommerce: "Onlineshop", community: "Community", radio: "Online-Radio", church: "Kirche / Gemeinde", service: "Lokaler Service", loyalty: "Bonusclub" },
  pt: { restaurant: "Restaurante", salon: "Agendamento de salão", fitness: "Personal trainer", ecommerce: "Loja online", community: "Comunidade", radio: "Rádio online", church: "Igreja / comunidade", service: "Serviço local", loyalty: "Clube de fidelidade" },
  ru: { restaurant: "Ресторан", salon: "Запись в салон", fitness: "Фитнес-тренер", ecommerce: "Интернет-магазин", community: "Сообщество", radio: "Онлайн-радио", church: "Церковь / община", service: "Местные услуги", loyalty: "Клуб лояльности" },
};
