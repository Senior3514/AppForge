import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { Studio } from "../../../components/Studio";

export default async function StudioPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ prompt?: string }> }) {
  const { locale } = await params;
  const { prompt } = await searchParams;
  if (!isLocale(locale)) notFound();
  return <Studio locale={locale} initialPrompt={prompt ?? ""} />;
}
