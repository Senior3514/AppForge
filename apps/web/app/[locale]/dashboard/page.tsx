import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { Dashboard } from "../../../components/Dashboard";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Dashboard locale={locale} />;
}
