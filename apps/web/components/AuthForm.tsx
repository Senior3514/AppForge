"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";

export function AuthForm({ locale, mode }: { locale: Locale; mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = params.get("next");
  const verified = useRef(false);

  const done = () => { router.push(next && next.startsWith("/") ? next : `/${locale}/dashboard`); router.refresh(); };

  // Arriving from an emailed link: exchange the single-use token for a session.
  useEffect(() => {
    const token = params.get("token");
    if (!token || verified.current) return;
    verified.current = true;
    api("/auth/magic-link/verify", { method: "POST", body: { token } }).then(done).catch(() => setError(t(locale, "auth.errorGeneric")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api(mode === "login" ? "/auth/login" : "/auth/signup", { method: "POST", body: { email, password } });
      done();
    } catch (err) {
      const s = err instanceof ApiError ? err.status : 0;
      setError(t(locale, s === 401 ? "auth.errorInvalid" : s === 409 ? "auth.errorExists" : "auth.errorGeneric"));
    } finally { setBusy(false); }
  }

  async function magic() {
    if (!email) return;
    setBusy(true); setError(null);
    try { await api("/auth/magic-link", { method: "POST", body: { email } }); setMagicSent(true); }
    catch { setError(t(locale, "auth.errorGeneric")); }
    finally { setBusy(false); }
  }

  const input = "w-full rounded-xl border border-slate-300 px-4 py-2.5";
  return (
    <main className="bg-aurora min-h-[70vh] px-4 py-14"><div className="glass mx-auto max-w-md rounded-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold">{t(locale, mode === "login" ? "auth.loginTitle" : "auth.signupTitle")}</h1>
      {mode === "signup" && <p className="mb-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900">{t(locale, "auth.claim")}</p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">{t(locale, "auth.email")}
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="block text-sm font-medium">{t(locale, "auth.password")}
          <input type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} className={`${input} mt-1`} />
          {mode === "signup" && <span className="mt-1 block text-xs font-normal text-slate-600">{t(locale, "auth.passwordHint")}</span>}
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {magicSent && <p role="status" className="text-sm text-green-800">{t(locale, "auth.magicSent")}</p>}
        <button disabled={busy} className="btn-primary w-full px-6 py-3">
          {t(locale, mode === "login" ? "auth.submitLogin" : "auth.submitSignup")}
        </button>
        <button type="button" onClick={magic} disabled={busy || !email} className="w-full rounded-full border border-slate-300 px-6 py-3 text-sm disabled:opacity-50">{t(locale, "auth.magic")}</button>
      </form>
      <p className="mt-6 text-sm text-slate-700">
        {t(locale, mode === "login" ? "auth.noAccount" : "auth.haveAccount")}{" "}
        <Link className="font-semibold underline" href={`/${locale}/${mode === "login" ? "signup" : "login"}`}>{t(locale, mode === "login" ? "nav.signup" : "nav.login")}</Link>
      </p>
    </div></main>
  );
}
