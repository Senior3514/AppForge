import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { SharedPreview } from "../../../../components/SharedPreview";

export default async function Page({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  if (!isLocale(locale) || !/^[\w-]{10,64}$/.test(token)) notFound();
  return <SharedPreview locale={locale} token={token} />;
}
