import { notFound } from "next/navigation";
import { isLocale } from "@appforge/i18n";
import { renderMarkdown } from "../../../../lib/markdown";

const API_URL = process.env.APPFORGE_API_URL ?? "http://127.0.0.1:8787";

// Public, indexable page: the App Store and Google Play both require a privacy policy URL.
export default async function Page({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const res = await fetch(`${API_URL}/v1/public/apps/${id}/privacy`, { cache: "no-store" });
  if (!res.ok) notFound();
  return <main className="mx-auto max-w-2xl px-4 py-10">{renderMarkdown(await res.text())}</main>;
}
