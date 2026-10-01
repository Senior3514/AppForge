import { ar } from "./messages/ar";
import { de } from "./messages/de";
import { en, type MessageKey } from "./messages/en";
import { es } from "./messages/es";
import { fr } from "./messages/fr";
import { he } from "./messages/he";
import { pt } from "./messages/pt";
import { ru } from "./messages/ru";
import { it } from "./messages/it";
import { nl } from "./messages/nl";
import { pl } from "./messages/pl";
import { tr } from "./messages/tr";
import { uk } from "./messages/uk";
import { ja } from "./messages/ja";
import { ko } from "./messages/ko";
import { zh } from "./messages/zh";
import { hi } from "./messages/hi";
import { id } from "./messages/id";
import { vi } from "./messages/vi";
import { fa } from "./messages/fa";

/** English is the default and comes first. Hebrew, Arabic and Persian are right-to-left. */
export const LOCALES = ["en", "he", "ar", "es", "fr", "de", "pt", "ru", "it", "nl", "pl", "tr", "uk", "ja", "ko", "zh", "hi", "id", "vi", "fa"] as const;
export const DEFAULT_LOCALE = "en" as const satisfies (typeof LOCALES)[number];
export type Locale = (typeof LOCALES)[number];

const RTL: ReadonlySet<Locale> = new Set<Locale>(["he", "ar", "fa"]);
export const isRtl = (l: Locale): boolean => RTL.has(l);
export const dirOf = (l: Locale): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");
export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English", he: "עברית", ar: "العربية", es: "Español",
  fr: "Français", de: "Deutsch", pt: "Português", ru: "Русский",
  it: "Italiano", nl: "Nederlands", pl: "Polski", tr: "Türkçe", uk: "Українська", ja: "日本語",
  ko: "한국어", zh: "中文", hi: "हिन्दी", id: "Bahasa Indonesia", vi: "Tiếng Việt", fa: "فارسی",
};


export type { MessageKey };
/** Platform UI strings. Each language file is typed `Record<MessageKey, string>`, so a missing key is a compile error. */
export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, he, ar, es, fr, de, pt, ru, it, nl, pl, tr, uk, ja, ko, zh, hi, id, vi, fa };

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
  it: { restaurant: "Ristorante", salon: "Prenotazioni salone", fitness: "Personal trainer", ecommerce: "E-commerce", community: "Comunità", radio: "Radio online", church: "Chiesa / comunità", service: "Servizio locale", loyalty: "Club fedeltà" },
  nl: { restaurant: "Restaurant", salon: "Salonafspraken", fitness: "Fitnesscoach", ecommerce: "Webshop", community: "Community", radio: "Online radio", church: "Kerk / gemeenschap", service: "Lokale dienst", loyalty: "Klantenclub" },
  pl: { restaurant: "Restauracja", salon: "Rezerwacje w salonie", fitness: "Trener fitness", ecommerce: "Sklep internetowy", community: "Społeczność", radio: "Radio internetowe", church: "Parafia / wspólnota", service: "Usługa lokalna", loyalty: "Klub lojalnościowy" },
  tr: { restaurant: "Restoran", salon: "Salon randevusu", fitness: "Fitness koçu", ecommerce: "E-ticaret", community: "Topluluk", radio: "Çevrimiçi radyo", church: "Kilise / topluluk", service: "Yerel hizmet", loyalty: "Sadakat kulübü" },
  uk: { restaurant: "Ресторан", salon: "Запис до салону", fitness: "Фітнес-тренер", ecommerce: "Інтернет-магазин", community: "Спільнота", radio: "Онлайн-радіо", church: "Церква / громада", service: "Місцеві послуги", loyalty: "Клуб лояльності" },
  ja: { restaurant: "レストラン", salon: "サロン予約", fitness: "フィットネスコーチ", ecommerce: "ネットショップ", community: "コミュニティ", radio: "ネットラジオ", church: "教会・地域団体", service: "地域サービス", loyalty: "ポイントクラブ" },
  ko: { restaurant: "레스토랑", salon: "미용실 예약", fitness: "피트니스 코치", ecommerce: "쇼핑몰", community: "커뮤니티", radio: "온라인 라디오", church: "교회/모임", service: "동네 서비스", loyalty: "멤버십 클럽" },
  zh: { restaurant: "餐厅", salon: "沙龙预约", fitness: "健身教练", ecommerce: "网店", community: "社区", radio: "网络电台", church: "教会/社群", service: "本地服务", loyalty: "会员俱乐部" },
  hi: { restaurant: "रेस्टोरेंट", salon: "सैलून बुकिंग", fitness: "फ़िटनेस कोच", ecommerce: "ऑनलाइन दुकान", community: "समुदाय", radio: "ऑनलाइन रेडियो", church: "मंदिर / समुदाय", service: "स्थानीय सेवा", loyalty: "लॉयल्टी क्लब" },
  id: { restaurant: "Restoran", salon: "Reservasi salon", fitness: "Pelatih kebugaran", ecommerce: "Toko online", community: "Komunitas", radio: "Radio online", church: "Gereja / komunitas", service: "Layanan lokal", loyalty: "Klub loyalitas" },
  vi: { restaurant: "Nhà hàng", salon: "Đặt lịch salon", fitness: "Huấn luyện viên thể hình", ecommerce: "Cửa hàng online", community: "Cộng đồng", radio: "Radio trực tuyến", church: "Nhà thờ / cộng đồng", service: "Dịch vụ địa phương", loyalty: "Câu lạc bộ khách hàng" },
  fa: { restaurant: "رستوران", salon: "رزرو آرایشگاه", fitness: "مربی تناسب اندام", ecommerce: "فروشگاه آنلاین", community: "جامعه", radio: "رادیو آنلاین", church: "کلیسا / انجمن", service: "خدمات محلی", loyalty: "باشگاه مشتریان" },
};
