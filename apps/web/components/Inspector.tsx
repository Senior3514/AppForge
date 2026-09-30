"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LOCALES, LOCALE_NAMES, t, type Locale } from "@appforge/i18n";
import { MODULES, addModuleOps, removeScreenOps, type AppSpec } from "@appforge/modules";
import {
  MAX_TABS, addSeedRowOps, blockFields, blockPropOp, contentModels, moveBlockOps, navigationOps, removeBlockOps, removeSeedRowOps,
  replaceOp, seedCellOp, sourceStrings, toggleTabOps, translationOps, type Op,
} from "../lib/ops";

export type Edit = (ops: Op[], label: string) => Promise<void>;
const input = "mt-1 w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-sm";
const iconBtn = "rounded border border-neutral-300 px-2 py-0.5 text-xs disabled:opacity-30";

/** Commits on blur/Enter so one edit is one revision, not one per keystroke. `key` resets the field after undo/redo. */
function Field({ label, value, onCommit, maxLength }: { label: string; value: string; onCommit: (v: string) => void; maxLength?: number }) {
  return (
    <label className="block text-xs font-medium">{label}
      <input key={value} defaultValue={value} maxLength={maxLength} className={input}
        onBlur={(e) => { if (e.target.value !== value) onCommit(e.target.value); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
    </label>
  );
}

/** Continuous controls (colour, slider) commit once the user pauses. */
function useIdleCommit<T>(value: T, commit: (v: T) => void, ms = 500) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return [local, (v: T) => { setLocal(v); clearTimeout(timer.current); timer.current = setTimeout(() => { if (v !== value) commit(v); }, ms); }] as const;
}

function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-xl border border-neutral-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

export function Inspector({ spec, locale, edit, translateWithAi, llm, busy }: {
  spec: AppSpec; locale: Locale; edit: Edit; translateWithAi: (target: Locale) => void; llm: string; busy: boolean;
}) {
  const [screenId, setScreenId] = useState(spec.screens[0]!.id);
  const [addId, setAddId] = useState<string>(MODULES[0]!.id);
  const [trLocale, setTrLocale] = useState<Locale>(LOCALES.find((l) => l !== spec.locale) ?? "en");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const screenIdx = Math.max(0, spec.screens.findIndex((s) => s.id === screenId));
  const screen = spec.screens[screenIdx]!;
  const [color, setColor] = useIdleCommit(spec.theme.primary, (v) => { if (/^#[0-9a-f]{6}$/i.test(v)) void edit([replaceOp("/theme/primary", v)], t(locale, "insp.color")); });
  const [radius, setRadius] = useIdleCommit(spec.theme.radius, (v) => void edit([replaceOp("/theme/radius", v)], t(locale, "insp.radius")));
  const models = contentModels(spec);
  const sources = sourceStrings(spec);
  const tr = spec.translations[trLocale] ?? {};

  return (
    <div className="space-y-3" aria-busy={busy}>
      <Section title={t(locale, "insp.app")} open>
        <Field label={t(locale, "insp.name")} value={spec.name} maxLength={40} onCommit={(v) => v.trim() && void edit([replaceOp("/name", v.trim())], t(locale, "insp.name"))} />
        <Field label={t(locale, "insp.tagline")} value={spec.tagline} maxLength={120} onCommit={(v) => void edit([replaceOp("/tagline", v)], t(locale, "insp.tagline"))} />
        <div className="flex items-end gap-3">
          <label className="text-xs font-medium">{t(locale, "insp.color")}
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 block h-9 w-14 cursor-pointer rounded border border-neutral-300" />
          </label>
          <label className="flex-1 text-xs font-medium">{t(locale, "insp.radius")} ({radius})
            <input type="range" min={0} max={32} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 block w-full" />
          </label>
        </div>
        <label className="block text-xs font-medium">{t(locale, "insp.font")}
          <select value={spec.theme.font} onChange={(e) => void edit([replaceOp("/theme/font", e.target.value)], t(locale, "insp.font"))} className={input}>
            <option value="modern">{t(locale, "insp.fontModern")}</option>
            <option value="classic">{t(locale, "insp.fontClassic")}</option>
            <option value="rounded">{t(locale, "insp.fontRounded")}</option>
          </select>
        </label>
      </Section>

      <Section title={t(locale, "insp.tabs")} open>
        <p className="text-xs text-neutral-600">{t(locale, "insp.tabHint")}</p>
        <ul className="space-y-1.5">
          {spec.navigation.map((id, i) => {
            const s = spec.screens.find((x) => x.id === id)!;
            return (
              <li key={id} draggable onDragStart={() => setDragFrom(i)} onDragOver={(e) => e.preventDefault()}
                onDrop={() => { if (dragFrom !== null) void edit(navigationOps(spec.navigation, dragFrom, i), t(locale, "insp.tabs")); setDragFrom(null); }}
                className="flex cursor-grab items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-sm">
                <span aria-hidden>⠿</span><span className="flex-1 truncate">{s.title}</span>
                <button className={iconBtn} aria-label={t(locale, "insp.moveUp")} disabled={i === 0} onClick={() => void edit(navigationOps(spec.navigation, i, i - 1), t(locale, "insp.tabs"))}>▲</button>
                <button className={iconBtn} aria-label={t(locale, "insp.moveDown")} disabled={i === spec.navigation.length - 1} onClick={() => void edit(navigationOps(spec.navigation, i, i + 1), t(locale, "insp.tabs"))}>▼</button>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title={t(locale, "insp.screens")} open>
        <select aria-label={t(locale, "insp.screens")} value={screen.id} onChange={(e) => setScreenId(e.target.value)} className={input}>
          {spec.screens.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
        </select>
        <Field label={t(locale, "insp.screenTitle")} value={screen.title} maxLength={40} onCommit={(v) => v.trim() && void edit([replaceOp(`/screens/${screenIdx}/title`, v.trim())], t(locale, "insp.screenTitle"))} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={spec.navigation.includes(screen.id)} onChange={(e) => {
            const ops = toggleTabOps(spec, screen.id, e.target.checked);
            if (!ops) setNote(t(locale, "insp.tabLimit")); else { setNote(null); if (ops.length) void edit(ops, t(locale, "insp.tabs")); }
          }} />{t(locale, "insp.showTab")}
        </label>
        {note && <p role="alert" className="text-xs text-red-700">{note}</p>}

        {screen.blocks.map((b, bi) => {
          const fields = blockFields(b);
          return (
            <fieldset key={b.id} className="rounded-lg border border-neutral-200 p-2.5">
              <legend className="px-1 text-xs font-semibold">{t(locale, `mod.${b.module}.t` as never)}</legend>
              <div className="mb-2 flex gap-1.5">
                <button className={iconBtn} aria-label={t(locale, "insp.moveUp")} disabled={bi === 0} onClick={() => void edit(moveBlockOps(spec, screenIdx, bi, bi - 1), b.module)}>▲</button>
                <button className={iconBtn} aria-label={t(locale, "insp.moveDown")} disabled={bi === screen.blocks.length - 1} onClick={() => void edit(moveBlockOps(spec, screenIdx, bi, bi + 1), b.module)}>▼</button>
                <button className={`${iconBtn} ms-auto text-red-700`} onClick={() => void edit(removeBlockOps(screenIdx, bi), b.module)}>{t(locale, "insp.removeBlock")}</button>
              </div>
              <div className="space-y-2">
                {fields.map((f) => f.kind === "boolean" ? (
                  <label key={f.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.value as boolean} onChange={(e) => void edit([blockPropOp(screenIdx, bi, f.key, e.target.checked)], f.key)} />{f.key}</label>
                ) : f.kind === "number" ? (
                  <Field key={f.key} label={f.key} value={String(f.value)} onCommit={(v) => Number.isFinite(Number(v)) && v !== "" && void edit([blockPropOp(screenIdx, bi, f.key, Number(v))], f.key)} />
                ) : (
                  <Field key={f.key} label={f.key} value={String(f.value)} onCommit={(v) => void edit([blockPropOp(screenIdx, bi, f.key, v)], f.key)} />
                ))}
              </div>
            </fieldset>
          );
        })}

        <div className="flex gap-2">
          <select aria-label={t(locale, "insp.addModule")} value={addId} onChange={(e) => setAddId(e.target.value)} className={`${input} mt-0`}>
            {MODULES.map((m) => <option key={m.id} value={m.id}>{t(locale, `mod.${m.id}.t` as never)}</option>)}
          </select>
          <button className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white" onClick={() => void edit(addModuleOps(spec, screen.id, addId) as Op[], addId)}>＋ {t(locale, "insp.addModule")}</button>
        </div>
        <button className="text-xs text-red-700 underline" onClick={() => { const ops = removeScreenOps(spec, screen.id); if (ops) { setScreenId(spec.screens.find((s) => s.id !== screen.id)!.id); void edit(ops as Op[], t(locale, "insp.removeScreen")); } }}
          disabled={spec.screens.length <= 1}>{t(locale, "insp.removeScreen")}</button>
      </Section>

      {models.length > 0 && (
        <Section title={t(locale, "insp.data")}>
          {models.map((m) => (
            <div key={m.id} className="space-y-2">
              <p className="text-xs font-semibold">{m.id}</p>
              {spec.dataModels[m.idx]!.seed.map((row, ri) => (
                <div key={ri} className="flex gap-1.5">
                  {m.fields.map((f) => (
                    <input key={`${ri}-${f}-${String(row[f])}`} aria-label={`${m.id} ${ri + 1} ${f}`} defaultValue={String(row[f] ?? "")} className={`${input} mt-0 min-w-0 flex-1`}
                      onBlur={(e) => { if (e.target.value !== String(row[f] ?? "")) void edit([seedCellOp(m.idx, ri, f, e.target.value)], m.id); }} />
                  ))}
                  <button className={iconBtn} aria-label={t(locale, "insp.removeRow")} onClick={() => void edit(removeSeedRowOps(m.idx, ri), m.id)}>✕</button>
                </div>
              ))}
              <button className="text-xs underline" onClick={() => void edit(addSeedRowOps(spec, m.idx), m.id)}>＋ {t(locale, "insp.addRow")}</button>
            </div>
          ))}
        </Section>
      )}

      <Section title={t(locale, "insp.translations")}>
        <label className="block text-xs font-medium">{t(locale, "insp.translateTo")}
          <select value={trLocale} onChange={(e) => setTrLocale(e.target.value as Locale)} className={input}>
            {LOCALES.filter((l) => l !== spec.locale).map((l) => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </label>
        <button disabled={busy || llm === "mock"} onClick={() => translateWithAi(trLocale)} className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50">{t(locale, "insp.translateAi")}</button>
        {llm === "mock" && <p className="text-xs text-neutral-600">{t(locale, "insp.translateNote")}</p>}
        <div className="space-y-2" dir={trLocale === "he" || trLocale === "ar" ? "rtl" : "ltr"}>
          {sources.map((s) => (
            <label key={s} className="block text-xs text-neutral-600" dir="auto">{s}
              <input key={`${trLocale}-${tr[s] ?? ""}`} defaultValue={tr[s] ?? ""} className={`${input} text-neutral-900`} lang={trLocale}
                onBlur={(e) => { if (e.target.value !== (tr[s] ?? "")) void edit(translationOps(spec, trLocale, s, e.target.value), `${LOCALE_NAMES[trLocale]}`); }} />
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}

export { MAX_TABS };
