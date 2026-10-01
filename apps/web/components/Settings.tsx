"use client";
import { useCallback, useEffect, useState } from "react";
import { t, tf, type Locale } from "@appforge/i18n";
import { ApiError, api } from "../lib/api";
import { useMe } from "../lib/useMe";

interface AiState {
  providers: { id: string; label: string; defaultModel: string }[];
  keysAvailable: boolean;
  active: "user" | "platform" | "mock";
  key: { provider: string; model: string; last4: string; test: { at: string; ok: boolean; error: string | null } | null } | null;
  usage30d: { source: string; calls: number; input: number; output: number; cost: number }[];
}

const input = "w-full rounded-xl border border-slate-300 px-4 py-2.5";
const card = "glass rounded-3xl p-6";

function AiPanel({ locale }: { locale: Locale }) {
  const [ai, setAi] = useState<AiState | null>(null);
  const [provider, setProvider] = useState("openrouter");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const s = await api<AiState>("/ai");
    setAi(s);
    if (s.key) { setProvider(s.key.provider); setModel(s.key.model); }
    else setModel(s.providers.find((p) => p.id === "openrouter")?.defaultModel ?? "");
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (!ai) return <p aria-busy>{t(locale, "common.loading")}</p>;

  const pickProvider = (id: string) => { setProvider(id); setModel(ai.providers.find((p) => p.id === id)?.defaultModel ?? ""); };
  const fail = (e: unknown) => setMsg({ ok: false, text: e instanceof ApiError ? e.message : t(locale, "common.error") });

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    try {
      await api("/ai", { method: "PUT", body: { provider, model, ...(apiKey ? { apiKey } : {}) } });
      setApiKey(""); await load(); setMsg({ ok: true, text: t(locale, "ai.saved") });
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function test() {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ ok: boolean; error: string | null }>("/ai/test", { method: "POST", body: {} });
      setMsg({ ok: r.ok, text: r.ok ? t(locale, "ai.testOk") : tf(locale, "ai.testFail", { error: r.error ?? "" }) });
      await load();
    } catch (err) { fail(err); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setMsg(null);
    try { await api("/ai", { method: "DELETE" }); setApiKey(""); await load(); } catch (err) { fail(err); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <p className="mb-1 text-sm text-slate-700">{t(locale, "ai.intro")}</p>
        <p className="mb-5 rounded-xl bg-indigo-50 p-3 text-sm font-medium text-indigo-900" data-testid="ai-active">{t(locale, `ai.active.${ai.active}`)}</p>
        {!ai.keysAvailable ? <p role="alert" className="text-sm text-amber-800">{t(locale, "ai.unavailable")}</p> : (
          <form onSubmit={save} className="space-y-4">
            <label className="block text-sm font-medium">{t(locale, "ai.provider")}
              <select value={provider} onChange={(e) => pickProvider(e.target.value)} className={`${input} mt-1`}>
                {ai.providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">{t(locale, "ai.model")}
              <input dir="ltr" required value={model} onChange={(e) => setModel(e.target.value)} className={`${input} mt-1`} />
            </label>
            <label className="block text-sm font-medium">{t(locale, "ai.key")}
              <input dir="ltr" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(e) => setApiKey(e.target.value)} required={!ai.key} className={`${input} mt-1`} />
              {ai.key && <span className="mt-1 block text-xs font-normal text-slate-600">{tf(locale, "ai.keySaved", { last4: ai.key.last4 })}</span>}
            </label>
            {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} className="btn-primary px-6 py-2.5">{t(locale, "ai.save")}</button>
              {ai.key && <button type="button" onClick={test} disabled={busy} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">{t(locale, "ai.test")}</button>}
              {ai.key && <button type="button" onClick={remove} disabled={busy} className="rounded-full border border-red-300 px-6 py-2.5 text-sm text-red-700">{t(locale, "ai.remove")}</button>}
            </div>
          </form>
        )}
      </section>
      <section className={card}>
        <h2 className="mb-2 font-semibold">{t(locale, "ai.usage")}</h2>
        {ai.usage30d.length === 0 ? <p className="text-sm text-slate-600">{t(locale, "ai.usageNone")}</p> : (
          <ul className="space-y-1 text-sm">
            {ai.usage30d.map((u) => <li key={u.source}>{tf(locale, "ai.usageRow", { calls: u.calls, tokens: u.input + u.output, cost: u.cost.toFixed(2) })}</li>)}
          </ul>
        )}
        <p className="mt-2 text-xs text-slate-500">{t(locale, "ai.costNote")}</p>
      </section>
    </div>
  );
}

function AccountPanel({ locale, email }: { locale: Locale; email: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pw, setPw] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [delPw, setDelPw] = useState("");
  const [del, setDel] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault(); setPw(null);
    try { await api("/account/password", { method: "POST", body: { current, password: next } }); setCurrent(""); setNext(""); setPw({ ok: true, text: t(locale, "acct.passwordDone") }); }
    catch (err) { setPw({ ok: false, text: t(locale, err instanceof ApiError && err.status === 403 ? "acct.passwordBad" : "common.error") }); }
  }
  async function exportData() {
    const data = await api("/account/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "appforge-export.json"; a.click(); URL.revokeObjectURL(url);
  }
  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault(); setDel(null);
    try { await api("/account/delete", { method: "POST", body: { confirm, password: delPw } }); window.location.href = `/${locale}`; }
    catch (err) { setDel(t(locale, err instanceof ApiError && (err.status === 403 || err.status === 400) ? "acct.deleteBad" : "common.error")); }
  }

  return (
    <div className="space-y-6">
      <section className={card}>
        <h2 className="mb-1 font-semibold">{t(locale, "acct.password")}</h2>
        <p className="mb-4 text-sm text-slate-600" dir="ltr">{email}</p>
        <form onSubmit={changePassword} className="space-y-4">
          <label className="block text-sm font-medium">{t(locale, "acct.current")}
            <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm font-medium">{t(locale, "acct.new")}
            <input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={`${input} mt-1`} />
          </label>
          {pw && <p role={pw.ok ? "status" : "alert"} className={`text-sm ${pw.ok ? "text-green-800" : "text-red-700"}`}>{pw.text}</p>}
          <button className="btn-primary px-6 py-2.5">{t(locale, "reset.submit")}</button>
        </form>
      </section>
      <section className={card}>
        <h2 className="mb-1 font-semibold">{t(locale, "acct.export")}</h2>
        <p className="mb-3 text-sm text-slate-600">{t(locale, "acct.exportBody")}</p>
        <button onClick={exportData} className="rounded-full border border-slate-300 px-6 py-2.5 text-sm">{t(locale, "acct.export")}</button>
      </section>
      <section className={`${card} border border-red-200`}>
        <h2 className="mb-1 font-semibold text-red-800">{t(locale, "acct.delete")}</h2>
        <p className="mb-3 text-sm text-slate-600">{t(locale, "acct.deleteBody")}</p>
        <form onSubmit={deleteAccount} className="space-y-3">
          <label className="block text-sm font-medium">{t(locale, "acct.deleteConfirm")}
            <input dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${input} mt-1`} />
          </label>
          <label className="block text-sm font-medium">{t(locale, "auth.password")}
            <input type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} className={`${input} mt-1`} />
          </label>
          {del && <p role="alert" className="text-sm text-red-700">{del}</p>}
          <button disabled={confirm.trim().toLowerCase() !== email} className="rounded-full bg-red-700 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{t(locale, "acct.delete")}</button>
        </form>
      </section>
    </div>
  );
}

export function Settings({ locale }: { locale: Locale }) {
  const { me } = useMe();
  const [tab, setTab] = useState<"ai" | "account">("ai");
  useEffect(() => { if (me && !me.user) window.location.href = `/${locale}/login?next=/${locale}/settings`; }, [me, locale]);
  if (!me?.user) return <main className="px-4 py-14"><p aria-busy>{t(locale, "common.loading")}</p></main>;
  const tabBtn = (id: "ai" | "account", key: "settings.ai" | "settings.account") => (
    <button role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`rounded-full px-5 py-2 text-sm font-semibold ${tab === id ? "bg-slate-900 text-white" : "border border-slate-300"}`}>{t(locale, key)}</button>
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">{t(locale, "settings.title")}</h1>
      {me.user.anonymous ? <p className="text-sm text-slate-700">{t(locale, "ai.needAccount")}</p> : (
        <>
          <div role="tablist" className="mb-6 flex gap-2">{tabBtn("ai", "settings.ai")}{tabBtn("account", "settings.account")}</div>
          {tab === "ai" ? <AiPanel locale={locale} /> : <AccountPanel locale={locale} email={me.user.email ?? ""} />}
        </>
      )}
    </main>
  );
}
