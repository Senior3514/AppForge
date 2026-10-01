"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { ENTITLEMENTS, PLANS, TRIAL_DAYS, type Plan } from "@appforge/plans";
import { ApiError, api } from "../lib/api";
import { money } from "../lib/format";
import { useMe } from "../lib/useMe";

export function Pricing({ locale }: { locale: Locale }) {
  const { me, reload } = useMe();
  const router = useRouter();
  const [busy, setBusy] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = me?.tenant?.effectivePlan;
  // Until the session is known we cannot tell "signed out" from "not loaded yet", so the buttons stay disabled (otherwise an early click is misrouted to signup).
  const signedIn = !!me?.user && !me.user.anonymous;

  async function choose(plan: Plan) {
    if (!signedIn) { router.push(`/${locale}/signup?next=${encodeURIComponent(`/${locale}/pricing`)}`); return; }
    setBusy(plan); setError(null);
    try {
      const r = await api<{ url?: string; activated?: boolean }>("/billing/checkout", { method: "POST", body: { plan } });
      if (r.url) window.location.href = r.url;
      else { await reload(); router.push(`/${locale}/dashboard`); }
    } catch (e) { setError(e instanceof ApiError ? e.message : t(locale, "common.error")); }
    finally { setBusy(null); }
  }

  return (
    <section aria-labelledby="pricing" className="py-12">
      <h2 id="pricing" className="text-3xl font-bold">{t(locale, "pricing.title")}</h2>
      <p className="mt-2 text-neutral-700">{tf(locale, "pricing.trial", { days: TRIAL_DAYS })}</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((p) => {
          const e = ENTITLEMENTS[p];
          const features = [
            tf(locale, "feat.apps", { n: e.maxApps }),
            tf(locale, "feat.mau", { n: new Intl.NumberFormat(locale).format(e.monthlyActiveUsers) }),
            t(locale, e.storePublishing ? "feat.store" : "feat.noStore"),
            ...(e.customAdminDomain ? [t(locale, "feat.domain")] : []),
            ...(e.removeBranding ? [t(locale, "feat.branding")] : []),
          ];
          return (
            <li key={p} className={`flex flex-col rounded-2xl border p-5 ${current === p ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-neutral-200"}`}>
              <h3 className="text-lg font-semibold">{t(locale, `plan.${p}`)}</h3>
              <p className="mt-2 text-3xl font-bold">{e.priceCents === 0 ? t(locale, "pricing.free") : money(e.priceCents, "USD", locale)}
                {e.priceCents > 0 && <span className="text-sm font-normal text-neutral-600">{t(locale, "pricing.perMonth")}</span>}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">{features.map((f) => <li key={f}>✓ {f}</li>)}</ul>
              {p === "free" ? (
                <Link href={`/${locale}`} className="mt-5 rounded-full border border-neutral-300 px-4 py-2 text-center text-sm font-semibold">{t(locale, "pricing.free")}</Link>
              ) : (
                <button disabled={me === null || busy !== null || current === p} onClick={() => void choose(p)} className="mt-5 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                  {current === p ? t(locale, "pricing.current") : t(locale, "pricing.choose")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
