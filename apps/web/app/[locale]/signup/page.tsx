import { notFound } from "next/navigation";
import { Suspense } from "react";
import { isLocale } from "@appforge/i18n";
import { AuthForm } from "../../../components/AuthForm";

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Suspense><AuthForm locale={locale} mode="signup" /></Suspense>;
}
