import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@appforge/i18n";
import { Settings } from "../../../components/Settings";

export const metadata = { robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Suspense><Settings locale={locale} /></Suspense>;
}
