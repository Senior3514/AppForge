import type { MetadataRoute } from "next";
import { LOCALES } from "@appforge/i18n";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000";
  return LOCALES.flatMap((l) => ["", "/pricing"].map((p) => ({
    url: `${base}/${l}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7,
    alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `${base}/${x}${p}`])) },
  })));
}
