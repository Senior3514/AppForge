import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { MockPay } from "../../../../../components/MockPay";

export default async function Page({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale, ref } = await params;
  if (!isLocale(locale) || !/^mock_[0-9a-f-]{36}$/.test(ref)) notFound();
  return <MockPay locale={locale} refId={ref} />;
}
