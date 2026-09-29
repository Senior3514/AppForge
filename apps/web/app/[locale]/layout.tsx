import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LOCALES, dirOf, isLocale, t } from "@appforge/i18n";
import "../globals.css";

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";
  return {
    title: "AppForge",
    description: t(l, "hero.placeholder"),
    openGraph: { title: "AppForge", description: t(l, "hero.placeholder"), type: "website" },
    alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `/${x}`])) },
  };
}

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";
  return (
    <html lang={l} dir={dirOf(l)}>
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
