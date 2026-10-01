"use client";
import { useState, type ReactNode } from "react";
import { dirOf, type Locale } from "@appforge/i18n";
import type { AppSpec, Block } from "@appforge/modules";
import { tr } from "@appforge/spec";
import { paletteFromPrimary, scriptOf, fontFamily } from "@appforge/ui-tokens";

export interface PreviewOptions { locale: Locale; dark: boolean; rtl: boolean | null; platform: "ios" | "android" }

/** Web preview of the universal runtime: same AppSpec, sandbox data, real interactions. */
export function PhonePreview({ spec, opts }: { spec: AppSpec; opts: PreviewOptions }) {
  const [tab, setTab] = useState(spec.navigation[0]!);
  const active = spec.screens.find((s) => s.id === tab) ?? spec.screens.find((s) => s.id === spec.navigation[0])!;
  const p = paletteFromPrimary(spec.theme.primary, opts.dark ? "dark" : "light");
  const dir = opts.rtl === null ? dirOf(opts.locale) : opts.rtl ? "rtl" : "ltr";
  const T = (s: string) => tr(spec, opts.locale, s);
  const radius = spec.theme.radius;

  return (
    <div className={`relative mx-auto w-[300px] bg-gradient-to-b from-slate-600 to-slate-900 p-[10px] shadow-[0_30px_60px_-20px_rgba(15,23,42,.55)] ring-1 ring-black/30 ${opts.platform === "ios" ? "rounded-[46px]" : "rounded-[28px]"}`} data-testid="phone">
      <span aria-hidden className={`absolute left-1/2 top-[18px] z-10 -translate-x-1/2 bg-black ${opts.platform === "ios" ? "h-[22px] w-[88px] rounded-full" : "h-3 w-3 rounded-full"}`} />
      <div dir={dir} lang={opts.locale} style={{ background: p.background, color: p.text, fontFamily: fontFamily[scriptOf(opts.locale)] }} className={`flex h-[560px] flex-col overflow-hidden ${opts.platform === "ios" ? "rounded-[36px]" : "rounded-[20px]"}`}>
        <header style={{ background: p.primary, color: p.onPrimary }} className="px-4 pb-3 pt-2 text-lg font-semibold"><div aria-hidden style={{ direction: "ltr" }} className="flex justify-between px-1 pb-3 pt-1 text-[10px] font-semibold opacity-90"><span>9:41</span><span>●●● ▮</span></div>{T(spec.name)}</header>
        <div className="flex-1 space-y-3 overflow-y-auto p-3" role="tabpanel">
          {active.blocks.map((b) => (
            <div key={b.id}><BlockView b={b} spec={spec} T={T} p={p} radius={radius} /></div>
          ))}
        </div>
        <nav role="tablist" style={{ borderTop: `1px solid ${p.border}`, background: p.surface }} className="flex">
          {spec.navigation.map((id) => {
            const s = spec.screens.find((x) => x.id === id)!;
            return (
              <button key={id} role="tab" aria-selected={id === active.id} onClick={() => setTab(id)}
                style={{ color: id === active.id ? p.primary : p.mutedText }} className="flex-1 truncate px-1 py-3 text-xs font-medium">
                {T(s.title)}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

type Pal = ReturnType<typeof paletteFromPrimary>;
interface V { b: Block; spec: AppSpec; T: (s: string) => string; p: Pal; radius: number }

function Card({ p, radius, children }: { p: Pal; radius: number; children: ReactNode }) {
  return <div style={{ background: p.surface, border: `1px solid ${p.border}`, borderRadius: radius }} className="p-3">{children}</div>;
}
const Btn = ({ p, radius, children, onClick }: { p: Pal; radius: number; children: ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} style={{ background: p.primary, color: p.onPrimary, borderRadius: radius }} className="px-4 py-2 text-sm font-semibold">{children}</button>
);

function BlockView({ b, spec, T, p, radius }: V) {
  switch (b.module) {
    case "hero": return (
      <div style={{ background: p.primary, color: p.onPrimary, borderRadius: radius }} className="p-5">
        <h2 className="text-2xl font-bold">{T(b.props.headline)}</h2>
        {b.props.subtitle && <p className="mt-1 text-sm opacity-90">{T(b.props.subtitle)}</p>}
        {b.props.cta && <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">{T(b.props.cta)}</span>}
      </div>);
    case "text": return <p className="text-sm">{T(b.props.body)}</p>;
    case "list": case "announcements": return <Rows b={b} spec={spec} T={T} p={p} radius={radius} />;
    case "catalog": return <Catalog b={b} spec={spec} T={T} p={p} radius={radius} />;
    case "booking": return <Booking b={b} spec={spec} T={T} p={p} radius={radius} />;
    case "loyalty": return <Loyalty goal={b.props.goal} reward={T(b.props.reward)} p={p} radius={radius} />;
    case "contact": return (
      <Card p={p} radius={radius}>
        {[b.props.address, b.props.phone, b.props.hours].filter(Boolean).map((l) => <p key={l} className="text-sm">{T(l)}</p>)}
        {!b.props.address && !b.props.phone && !b.props.hours && <p style={{ color: p.mutedText }} className="text-sm">—</p>}
      </Card>);
    case "radio": return <Radio station={T(b.props.station)} p={p} radius={radius} />;
  }
}

function rowsOf(spec: AppSpec, id: string) { return spec.dataModels.find((d) => d.id === id)?.seed ?? []; }

function Rows({ b, spec, T, p, radius }: V) {
  const props = b.props as { collection: string; titleField?: string; subtitleField?: string | null };
  const titleField = props.titleField ?? spec.dataModels.find((d) => d.id === props.collection)?.fields[0]?.name ?? "name";
  return (
    <div className="space-y-2">
      {rowsOf(spec, props.collection).map((r, i) => (
        <Card key={i} p={p} radius={radius}>
          <p className="font-medium">{T(String(r[titleField] ?? ""))}</p>
          {props.subtitleField && <p style={{ color: p.mutedText }} className="text-sm">{String(r[props.subtitleField] ?? "")}</p>}
        </Card>
      ))}
    </div>
  );
}

function Catalog({ b, spec, T, p, radius }: V) {
  const [cart, setCart] = useState(0);
  const props = b.props as { collection: string };
  return (
    <div className="space-y-2">
      {rowsOf(spec, props.collection).map((r, i) => (
        <Card key={i} p={p} radius={radius}>
          <div className="flex items-center justify-between gap-2">
            <div><p className="font-medium">{T(String(r.name ?? ""))}</p><p style={{ color: p.mutedText }} className="text-sm">{String(r.price ?? "")}</p></div>
            <Btn p={p} radius={radius} onClick={() => setCart((c) => c + 1)}>+</Btn>
          </div>
        </Card>
      ))}
      <p aria-live="polite" className="text-sm font-semibold">🛒 {cart}</p>
    </div>
  );
}

function Booking({ b, T, p, radius }: V) {
  const props = b.props as { submitLabel: string; askPhone: boolean };
  const [done, setDone] = useState(false);
  return (
    <Card p={p} radius={radius}>
      <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
        <input required aria-label="name" style={{ borderColor: p.border, background: p.background }} className="w-full rounded border p-2 text-sm" />
        {props.askPhone && <input aria-label="phone" inputMode="tel" style={{ borderColor: p.border, background: p.background }} className="w-full rounded border p-2 text-sm" />}
        <Btn p={p} radius={radius}>{T(props.submitLabel)}</Btn>
        {done && <p role="status" className="text-sm">✓</p>}
      </form>
    </Card>
  );
}

function Loyalty({ goal, reward, p, radius }: { goal: number; reward: string; p: Pal; radius: number }) {
  const [n, setN] = useState(0);
  return (
    <Card p={p} radius={radius}>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: goal }, (_, i) => (
          <span key={i} style={{ background: i < n ? p.primary : "transparent", border: `2px solid ${p.primary}` }} className="h-6 w-6 rounded-full" />
        ))}
      </div>
      <p className="mt-2 text-sm">{n >= goal ? `🎉 ${reward}` : `${n}/${goal} · ${reward}`}</p>
      <div className="mt-2"><Btn p={p} radius={radius} onClick={() => setN((v) => Math.min(goal, v + 1))}>+1</Btn></div>
    </Card>
  );
}

function Radio({ station, p, radius }: { station: string; p: Pal; radius: number }) {
  const [on, setOn] = useState(false);
  return (
    <Card p={p} radius={radius}>
      <p className="font-medium">{station}</p>
      <div className="mt-2"><Btn p={p} radius={radius} onClick={() => setOn((v) => !v)}>{on ? "⏸" : "▶"}</Btn></div>
    </Card>
  );
}
