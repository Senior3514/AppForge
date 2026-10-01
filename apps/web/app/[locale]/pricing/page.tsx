import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { Faq } from "../../../components/Faq";
import { Pricing } from "../../../components/Pricing";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main className="mx-auto max-w-6xl px-4"><Pricing locale={locale} /><Faq locale={locale} /></main>;
}
