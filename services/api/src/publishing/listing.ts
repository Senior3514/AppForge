import type { AppSpec } from "@appforge/modules";

const cut = (s: string, max: number) => {
  if (s.length <= max) return s;
  const t = s.slice(0, max - 1);
  return t.replace(/\s+\S*$/, "") + "…";
};

const uses = (spec: AppSpec, m: string) => spec.screens.some((s) => s.blocks.some((b) => b.module === m));
const he = (spec: AppSpec) => spec.locale === "he";

/** What each module lets end users do, used to write the description and derive privacy answers. */
const FEATURE_LINES: Record<string, { en: string; he: string; terms: [string, string] }> = {
  booking: { en: "Book appointments in seconds", he: "קביעת תורים בשניות", terms: ["booking", "הזמנה"] },
  catalog: { en: "Browse products and pay securely", he: "גלישה במוצרים ותשלום מאובטח", terms: ["shop", "חנות"] },
  loyalty: { en: "Collect stamps and earn rewards", he: "צבירת נקודות וקבלת הטבות", terms: ["rewards", "הטבות"] },
  radio: { en: "Listen to the live stream", he: "האזנה לשידור חי", terms: ["radio", "רדיו"] },
  announcements: { en: "Get news and updates first", he: "עדכונים וחדשות ראשונים", terms: ["news", "עדכונים"] },
  contact: { en: "Find us and get in touch", he: "מצאו אותנו ויצרו קשר", terms: ["contact", "צור קשר"] },
  list: { en: "See everything we offer", he: "כל מה שאנחנו מציעים", terms: ["menu", "תפריט"] },
};

export interface DataSafety {
  collects: { dataType: string; purpose: string; linkedToUser: boolean; shared: boolean }[];
  tracking: boolean;
  encryptedInTransit: boolean;
  deletionRequest: string;
}

export function dataSafety(spec: AppSpec, ownerEmail: string | null): DataSafety {
  const collects: DataSafety["collects"] = [];
  const bookingCollections = new Set(spec.screens.flatMap((s) => s.blocks).flatMap((b) => (b.module === "booking" ? [b.props.collection] : [])));
  const bookingFields = new Set(spec.dataModels.filter((m) => bookingCollections.has(m.id)).flatMap((m) => m.fields.map((f) => f.type)));
  if (bookingFields.size) collects.push({ dataType: "Contact info and form answers submitted by the user (e.g. name, phone)", purpose: "App functionality", linkedToUser: true, shared: false });
  if (spec.features.analytics) collects.push({ dataType: "App activity: screen views; a random per-install identifier", purpose: "Analytics", linkedToUser: false, shared: false });
  if (spec.features.push) collects.push({ dataType: "Device push token", purpose: "App functionality (notifications)", linkedToUser: false, shared: true });
  if (spec.features.payments) collects.push({ dataType: "Purchase history (items and totals). Card details are handled by the payment provider and never reach the app owner", purpose: "App functionality", linkedToUser: false, shared: true });
  return { collects, tracking: false, encryptedInTransit: true, deletionRequest: ownerEmail ? `Users can request deletion by emailing ${ownerEmail}` : "Users can request deletion by contacting the app owner" };
}

export function privacyPolicy(spec: AppSpec, ownerEmail: string | null): string {
  const ds = dataSafety(spec, ownerEmail);
  const contact = ownerEmail ?? "[add a contact email]";
  const lines = [
    `# Privacy Policy — ${spec.name}`,
    "",
    `This policy explains what the ${spec.name} app collects and why. It is a template generated from the app's features; review it and adapt it to your business and local law before publishing.`,
    "",
    "## What we collect",
    ...(ds.collects.length ? ds.collects.map((c) => `- **${c.dataType}** — used for: ${c.purpose}.${c.shared ? " Shared with the service provider that delivers it." : ""}`) : ["- The app does not collect personal data."]),
    "",
    "## What we do not do",
    "- We do not sell personal data and we do not track you across other apps or websites.",
    "- Data is sent over encrypted connections (HTTPS).",
    "",
    "## Your choices",
    `- ${ds.deletionRequest}.`,
    "- You can disable notifications at any time in your device settings.",
    "",
    "## Contact",
    contact,
  ];
  return lines.join("\n");
}

const CATEGORY: { module: string; apple: string; play: string }[] = [
  { module: "catalog", apple: "Shopping", play: "Shopping" },
  { module: "radio", apple: "Music", play: "Music & Audio" },
  { module: "booking", apple: "Lifestyle", play: "Lifestyle" },
  { module: "loyalty", apple: "Lifestyle", play: "Lifestyle" },
];

export function storeListing(spec: AppSpec, ownerEmail: string | null) {
  const h = he(spec);
  const modules = [...new Set(spec.screens.flatMap((s) => s.blocks.map((b) => b.module)))];
  const features = modules.map((m) => FEATURE_LINES[m]).filter(Boolean) as (typeof FEATURE_LINES)[string][];
  const f = (x: (typeof FEATURE_LINES)[string]) => (h ? x.he : x.en);

  const intro = spec.tagline || spec.name;
  const fullDescription = cut([intro, "", ...features.map((x) => `• ${f(x)}`), "", spec.screens.map((s) => s.title).join(" · ")].join("\n"), 4000);
  const keywordPool = [...spec.name.split(/\s+/), ...spec.screens.map((s) => s.title), ...features.map((x) => x.terms[h ? 1 : 0])].map((k) => k.toLowerCase().replace(/[,]/g, "")).filter((k) => k.length > 2);
  const keywords: string[] = [];
  for (const k of [...new Set(keywordPool)]) if ([...keywords, k].join(",").length <= 100) keywords.push(k);

  const cat = CATEGORY.find((c) => uses(spec, c.module)) ?? { apple: "Lifestyle", play: "Lifestyle" };
  return {
    listingLocale: h ? "he" : "en",
    note: spec.locale === "en" || h ? null : "Listing text is generated in English; translate it for your store locale.",
    title: cut(spec.name, 30),
    subtitle: cut(spec.tagline || f(features[0] ?? { en: spec.name, he: spec.name, terms: ["", ""] }), 30),
    shortDescription: cut(spec.tagline || intro, 80),
    fullDescription,
    keywords: keywords.join(","),
    category: { apple: cat.apple, play: cat.play },
    dataSafety: dataSafety(spec, ownerEmail),
    privacyPolicy: privacyPolicy(spec, ownerEmail),
    limits: { title: 30, subtitle: 30, shortDescription: 80, keywords: 100, fullDescription: 4000 },
  };
}
