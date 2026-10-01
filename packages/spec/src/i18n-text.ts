import type { Locale } from "@appforge/i18n";

interface Translatable { locale: Locale; translations: Partial<Record<Locale, Record<string, string>>> }

/** Resolves a source string for the viewing locale, falling back to the source text. */
export const tr = (spec: Translatable, locale: Locale, source: string): string =>
  locale === spec.locale ? source : spec.translations[locale]?.[source] ?? source;
