import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { Studio } from "../../../../components/Studio";

export default async function StudioPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <Studio locale={locale} appId={id} />;
}
