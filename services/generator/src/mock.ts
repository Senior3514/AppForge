import { moduleById, type AppSpec, type Block } from "@appforge/modules";
import type { Locale } from "@appforge/i18n";
import type { LlmClient, LlmRequest, LlmResult } from "./llm";

type Copy = Record<"en" | "he", string>;
const pick = (c: Copy, l: Locale) => (l === "he" ? c.he : c.en);

interface Archetype {
  keywords: RegExp; color: string; name: Copy; tagline: Copy;
  model: { id: string; field: string; sub?: string; rows: string[] };
  listTitle: Copy; extra: "booking" | "catalog" | "loyalty" | "radio" | "none";
}

const ARCHETYPES: Archetype[] = [
  { keywords: /restaurant|cafe|coffee|pizza|bakery|מסעד|קפה|פיצ|מאפי/i, color: "#b5532a", name: { en: "Corner Kitchen", he: "המטבח שלנו" }, tagline: { en: "Fresh food, made daily", he: "אוכל טרי, מדי יום" },
    model: { id: "menu", field: "name", sub: "price", rows: ["Signature dish|$12", "Daily special|$9", "House dessert|$6"] }, listTitle: { en: "Menu", he: "תפריט" }, extra: "loyalty" },
  { keywords: /salon|barber|hair|beauty|spa|nail|ספר|מספר|יופי|קוסמט/i, color: "#a23b72", name: { en: "Glow Studio", he: "סטודיו גלואו" }, tagline: { en: "Book your next visit in seconds", he: "קבעו תור תוך שניות" },
    model: { id: "services", field: "name", sub: "price", rows: ["Haircut|$30", "Color|$70", "Styling|$40"] }, listTitle: { en: "Services", he: "שירותים" }, extra: "booking" },
  { keywords: /fitness|gym|coach|trainer|yoga|workout|כושר|מאמן|יוגה|אימון/i, color: "#1f7a5c", name: { en: "Peak Coach", he: "פיק קואץ'" }, tagline: { en: "Train smarter, every week", he: "מתאמנים חכם, כל שבוע" },
    model: { id: "classes", field: "name", sub: "time", rows: ["Strength|Mon 18:00", "Mobility|Wed 07:30", "HIIT|Fri 17:00"] }, listTitle: { en: "Classes", he: "שיעורים" }, extra: "booking" },
  { keywords: /shop|store|ecommerce|e-commerce|sell|products|boutique|חנות|מכיר|מוצרים/i, color: "#2456c9", name: { en: "Little Shop", he: "החנות הקטנה" }, tagline: { en: "Handpicked things you'll love", he: "מוצרים נבחרים שתאהבו" },
    model: { id: "products", field: "name", sub: "price", rows: ["Classic tee|$24", "Canvas bag|$18", "Ceramic mug|$14"] }, listTitle: { en: "Shop", he: "חנות" }, extra: "catalog" },
  { keywords: /radio|podcast|music|station|רדיו|פודקאסט|מוזיקה/i, color: "#6a3fd6", name: { en: "Wave FM", he: "גל FM" }, tagline: { en: "Listen live, anywhere", he: "מאזינים בשידור חי, בכל מקום" },
    model: { id: "shows", field: "name", sub: "time", rows: ["Morning Drive|07:00", "Midday Mix|12:00", "Night Waves|21:00"] }, listTitle: { en: "Shows", he: "תוכניות" }, extra: "radio" },
];
const FALLBACK: Archetype = { keywords: /$^/, color: "#3457d5", name: { en: "My App", he: "האפליקציה שלי" }, tagline: { en: "Everything in one place", he: "הכול במקום אחד" },
  model: { id: "items", field: "name", sub: "note", rows: ["First item|New", "Second item|Popular", "Third item|Soon"] }, listTitle: { en: "Explore", he: "גלו" }, extra: "loyalty" };

const L = (en: string, he: string): Copy => ({ en, he });

function build(a: Archetype, locale: Locale): AppSpec {
  const sub = a.model.sub;
  const rows = a.model.rows.map((r) => { const [n, s] = r.split("|"); return { [a.model.field]: n!, ...(sub ? { [sub]: s! } : {}) }; });
  const dataModels: AppSpec["dataModels"] = [{ id: a.model.id, fields: [{ name: a.model.field, type: "text" }, ...(sub ? [{ name: sub, type: "text" as const }] : [])], seed: rows }];
  const home: Block[] = [{ id: "hero", module: "hero", props: { headline: pick(a.name, locale), subtitle: pick(a.tagline, locale), cta: pick(L("Get started", "התחילו"), locale) } }];
  const screens: AppSpec["screens"] = [
    { id: "home", title: pick(L("Home", "בית"), locale), icon: "home", blocks: home },
    { id: a.model.id, title: pick(a.listTitle, locale), icon: "list", blocks: [{ id: "main-list", module: "list", props: { collection: a.model.id, titleField: a.model.field, subtitleField: sub ?? null } }] },
  ];
  const features = { payments: false, push: false, analytics: true };
  const add = (id: string, title: Copy, icon: string, blocks: Block[]) => screens.push({ id, title: pick(title, locale), icon, blocks });
  if (a.extra === "booking") { dataModels.push({ id: "bookings", fields: [{ name: "name", type: "text" }, { name: "phone", type: "phone" }], seed: [] }); add("book", L("Book", "הזמנה"), "calendar", [{ id: "book-form", module: "booking", props: { collection: "bookings", submitLabel: pick(L("Book now", "הזמינו עכשיו"), locale), askPhone: true } }]); }
  if (a.extra === "catalog") { features.payments = true; screens[1]!.blocks = [{ id: "main-list", module: "catalog", props: { collection: a.model.id, currency: "USD" } }]; }
  if (a.extra === "loyalty") add("rewards", L("Rewards", "הטבות"), "star", [{ id: "card", module: "loyalty", props: { goal: 10, reward: pick(L("Free item", "פריט במתנה"), locale) } }]);
  if (a.extra === "radio") add("live", L("Live", "שידור חי"), "radio", [{ id: "player", module: "radio", props: { streamUrl: "https://example.com/stream", station: pick(a.name, locale) } }]);
  add("contact", L("Contact", "צור קשר"), "map-pin", [{ id: "info", module: "contact", props: { address: "", phone: "", hours: "" } }]);
  return {
    version: 1, name: pick(a.name, locale), tagline: pick(a.tagline, locale), locale,
    theme: { primary: a.color, radius: 14, font: "rounded" },
    navigation: screens.slice(0, 5).map((s) => s.id), screens, dataModels, translations: {}, features,
  };
}

const has = (s: string, r: RegExp) => r.test(s);

/** Deterministic patch rules for "add X" / "change color" / "rename" style instructions. */
function patchFor(spec: AppSpec, prompt: string): unknown[] {
  const ops: unknown[] = [];
  const exists = (id: string) => spec.screens.some((s) => s.id === id);
  const addScreen = (id: string, title: string, icon: string, blocks: Block[]) => {
    if (exists(id)) return;
    ops.push({ op: "add", path: `/screens/${spec.screens.length}`, value: { id, title, icon, blocks } });
    if (spec.navigation.length < 5) ops.push({ op: "add", path: "/navigation/-", value: id });
  };
  if (has(prompt, /loyal|reward|stamp|נאמנות|הטבות|מועדון/i)) addScreen("rewards", spec.locale === "he" ? "הטבות" : "Rewards", "star", [{ id: "card", module: "loyalty", props: { goal: 10, reward: spec.locale === "he" ? "פריט במתנה" : "Free item" } }]);
  if (has(prompt, /contact|location|address|צור קשר|כתובת/i)) addScreen("contact", spec.locale === "he" ? "צור קשר" : "Contact", "map-pin", [{ id: "info", module: "contact", props: { address: "", phone: "", hours: "" } }]);
  if (has(prompt, /radio|stream|רדיו/i)) addScreen("live", spec.locale === "he" ? "שידור חי" : "Live", "radio", [{ id: "player", module: "radio", props: { streamUrl: "https://example.com/stream", station: spec.name } }]);
  const color = /#[0-9a-f]{6}/i.exec(prompt)?.[0];
  if (color) ops.push({ op: "replace", path: "/theme/primary", value: color });
  const rename = /(?:rename|call it|name it)\s+(?:the app\s+)?["“']?(.{1,40}?)["”']?(?=\s+(?:and|with|then)\b|\s*[,.&]|$)/i.exec(prompt);
  if (rename) ops.push({ op: "replace", path: "/name", value: rename[1]!.trim() });
  return ops;
}

/** Offline adapter: instant, deterministic, no network. Understands English and Hebrew prompts. */
export class MockLlm implements LlmClient {
  readonly name = "mock";
  async run(req: LlmRequest): Promise<LlmResult> {
    const usage = { inputTokens: 0, outputTokens: 0 };
    const { prompt, locale, spec } = req.meta;
    if (req.task === "patch") return { json: { ops: patchFor(spec!, prompt) }, usage };
    const a = ARCHETYPES.find((x) => x.keywords.test(prompt)) ?? FALLBACK;
    return { json: build(a, locale === "he" ? "he" : "en"), usage };
  }
}
