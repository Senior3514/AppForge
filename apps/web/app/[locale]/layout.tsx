import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LOCALES, dirOf, isLocale, t } from "@appforge/i18n";
import { SiteHeader } from "../../components/SiteHeader";
import "../globals.css";

export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";
  const description = t(l, "hero.subtitle");
  return {
    metadataBase: new URL(process.env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000"),
    title: { default: `AppForge — ${t(l, "hero.title")}`, template: "%s · AppForge" },
    description,
    openGraph: { title: `AppForge — ${t(l, "hero.title")}`, description, type: "website", locale: l },
    alternates: { languages: Object.fromEntries(LOCALES.map((x) => [x, `/${x}`])) },
  };
}

export default async function RootLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "en";
  return (
    <html lang={l} dir={dirOf(l)}>
      <body className="bg-white text-neutral-900 antialiased">
        <SiteHeader locale={l} />
        {children}
        <footer className="mt-12 border-t border-neutral-200 py-8 text-center text-sm text-neutral-600">
          <p>AppForge · {t(l, "footer.tagline")}</p>
        </footer>
      </body>
    </html>
  );
}
