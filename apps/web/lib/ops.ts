import type { AppSpec, Block } from "@appforge/modules";
import type { Locale } from "@appforge/i18n";

/** Minimal RFC 6902 operation, matching what the API's /edit endpoint accepts. */
export type Op = { op: "add" | "remove" | "replace"; path: string; value?: unknown };

export const MAX_TABS = 5;
export const replaceOp = (path: string, value: unknown): Op => ({ op: "replace", path, value });

export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]!);
  return next;
}

export const navigationOps = (nav: readonly string[], from: number, to: number): Op[] =>
  from === to ? [] : [replaceOp("/navigation", reorder(nav, from, to))];

/** Adds or removes a screen from the tab bar; refuses to exceed the tab limit or empty the bar. */
export function toggleTabOps(spec: AppSpec, screenId: string, on: boolean): Op[] | null {
  const has = spec.navigation.includes(screenId);
  if (on === has) return [];
  if (on) return spec.navigation.length >= MAX_TABS ? null : [replaceOp("/navigation", [...spec.navigation, screenId])];
  return spec.navigation.length <= 1 ? null : [replaceOp("/navigation", spec.navigation.filter((x) => x !== screenId))];
}

/** Set (or clear, when empty) one translation. Source text is the key, as in AppSpec.translations. */
export function translationOps(spec: AppSpec, locale: Locale, source: string, text: string): Op[] {
  const current = spec.translations[locale];
  const next = { ...(current ?? {}) };
  if (text.trim() === "") delete next[source]; else next[source] = text;
  return [{ op: current ? "replace" : "add", path: `/translations/${locale}`, value: next }];
}

const REF_KEYS = new Set(["collection", "titleField", "subtitleField"]);
export interface BlockField { key: string; kind: "text" | "number" | "boolean"; value: string | number | boolean }

/** Editable props of a block. References to data models are structural and edited elsewhere. */
export function blockFields(block: Block): BlockField[] {
  return Object.entries(block.props as Record<string, unknown>)
    .filter(([k, v]) => !REF_KEYS.has(k) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
    .map(([key, value]) => ({ key, value: value as BlockField["value"], kind: typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "text" }));
}

export const blockPropOp = (screenIdx: number, blockIdx: number, key: string, value: unknown): Op =>
  replaceOp(`/screens/${screenIdx}/blocks/${blockIdx}/props/${key}`, value);

export const moveBlockOps = (spec: AppSpec, screenIdx: number, from: number, to: number): Op[] =>
  from === to ? [] : [replaceOp(`/screens/${screenIdx}/blocks`, reorder(spec.screens[screenIdx]!.blocks, from, to))];

export const removeBlockOps = (screenIdx: number, blockIdx: number): Op[] => [{ op: "remove", path: `/screens/${screenIdx}/blocks/${blockIdx}` }];

export const seedCellOp = (modelIdx: number, rowIdx: number, field: string, value: string | number | boolean): Op =>
  replaceOp(`/dataModels/${modelIdx}/seed/${rowIdx}/${field}`, value);

export function addSeedRowOps(spec: AppSpec, modelIdx: number): Op[] {
  const row = Object.fromEntries(spec.dataModels[modelIdx]!.fields.map((f) => [f.name, f.type === "number" ? 0 : f.type === "boolean" ? false : ""]));
  return [{ op: "add", path: `/dataModels/${modelIdx}/seed/-`, value: row }];
}
export const removeSeedRowOps = (modelIdx: number, rowIdx: number): Op[] => [{ op: "remove", path: `/dataModels/${modelIdx}/seed/${rowIdx}` }];

/** Models whose seed rows are shown to customers (lists, catalogs, news), as opposed to form inboxes. */
export function contentModels(spec: AppSpec): { idx: number; id: string; fields: string[] }[] {
  const shown = new Set(spec.screens.flatMap((s) => s.blocks).flatMap((b) => ("collection" in b.props && b.module !== "booking" ? [b.props.collection as string] : [])));
  return spec.dataModels.flatMap((m, idx) => (shown.has(m.id) ? [{ idx, id: m.id, fields: m.fields.map((f) => f.name) }] : []));
}

/**
 * Every customer-visible string, in reading order, deduplicated. These are the keys of AppSpec.translations.
 * Covers what the renderers actually pass through tr(): names, titles, block copy and displayed data rows.
 */
export function sourceStrings(spec: AppSpec): string[] {
  const out: string[] = [spec.name, spec.tagline];
  for (const s of spec.screens) {
    out.push(s.title);
    for (const b of s.blocks) {
      for (const f of blockFields(b)) if (f.kind === "text" && f.key !== "streamUrl" && f.key !== "currency") out.push(String(f.value));
      if ("collection" in b.props) {
        const m = spec.dataModels.find((d) => d.id === (b.props as { collection: string }).collection);
        const titleField = (b.props as { titleField?: string }).titleField ?? (b.module === "catalog" ? "name" : m?.fields[0]?.name);
        for (const row of m?.seed ?? []) if (titleField && typeof row[titleField] === "string") out.push(row[titleField] as string);
      }
    }
  }
  return [...new Set(out.map((x) => x.trim()).filter(Boolean))];
}
