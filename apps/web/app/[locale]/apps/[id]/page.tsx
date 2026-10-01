import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@appforge/i18n";
import { AppAdmin } from "../../../../components/AppAdmin";

export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  return <Suspense><AppAdmin locale={locale} appId={id} /></Suspense>;
}
