"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { api } from "../lib/api";

const input = "w-full rounded-xl border border-slate-300 px-4 py-2.5";
const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main className="bg-aurora min-h-[70vh] px-4 py-14"><div className="glass mx-auto max-w-md rounded-3xl p-8"><h1 className="mb-6 text-2xl font-bold">{title}</h1>{children}</div></main>
);

export function VerifyEmail({ locale }: { locale: Locale }) {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"working" | "ok" | "bad">(token ? "working" : "bad");
  const ran = useRef(false);
  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    api("/auth/verify", { method: "POST", body: { token } }).then(() => setState("ok")).catch(() => setState("bad"));
  }, [token]);
  return <Shell title={t(locale, "nav.settings")}><p role="status">{t(locale, state === "working" ? "verify.working" : state === "ok" ? "verify.ok" : "verify.invalid")}</p></Shell>;
}

export function ForgotPassword({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(false);
    try { await api("/auth/forgot", { method: "POST", body: { email } }); setSent(true); } catch { setError(true); }
  }
  return (
    <Shell title={t(locale, "forgot.title")}>
      <p className="mb-4 text-sm text-slate-700">{t(locale, "forgot.body")}</p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t(locale, "auth.email")}
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        {sent && <p role="status" className="text-sm text-green-800">{t(locale, "forgot.sent")}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{t(locale, "auth.errorGeneric")}</p>}
        <button className="btn-primary w-full px-6 py-3">{t(locale, "forgot.send")}</button>
      </form>
    </Shell>
  );
}

export function ResetPassword({ locale }: { locale: Locale }) {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    try { await api("/auth/reset", { method: "POST", body: { token, password } }); router.push(`/${locale}/dashboard`); router.refresh(); }
    catch { setError(t(locale, "reset.invalid")); }
  }
  return (
    <Shell title={t(locale, "reset.title")}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t(locale, "acct.new")}
          <input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} />
          <span className="mt-1 block text-xs font-normal text-slate-600">{t(locale, "auth.passwordHint")}</span>
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button className="btn-primary w-full px-6 py-3">{t(locale, "reset.submit")}</button>
      </form>
    </Shell>
  );
}
