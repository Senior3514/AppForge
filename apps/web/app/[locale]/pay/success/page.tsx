import { notFound } from "next/navigation";
import { isLocale, t } from "@appforge/i18n";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <main className="mx-auto max-w-md px-4 py-20 text-center"><p className="text-xl font-semibold" role="status">{t(locale, "pay.success")}</p></main>;
}
