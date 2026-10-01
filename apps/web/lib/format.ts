import type { Locale } from "@appforge/i18n";

export const money = (cents: number, currency: string, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
export const dateTime = (iso: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const dateOnly = (iso: string, locale: Locale) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
