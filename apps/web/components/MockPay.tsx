"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";

/** Demo checkout page, reachable only when the payments adapter is the mock. */
export function MockPay({ locale, refId }: { locale: Locale; refId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    try { await api(`/public/mock-pay/${encodeURIComponent(refId)}`, { method: "POST" }); router.push(`/${locale}/pay/success`); }
    catch (e) { setError(e instanceof ApiError ? e.message : t(locale, "common.error")); }
  }
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">{t(locale, "pay.mockTitle")}</h1>
      <p className="mt-2 text-slate-700">{t(locale, "pay.mockBody")}</p>
      <button onClick={pay} className="mt-6 rounded-full bg-[var(--brand)] px-6 py-3 font-semibold text-white">{t(locale, "pay.mockBtn")}</button>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </main>
  );
}
