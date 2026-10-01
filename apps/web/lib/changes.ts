import { t, tf, type Locale } from "@appforge/i18n";
import type { Op } from "./ops";

const WHAT: Record<string, "change.name" | "change.tagline" | "change.theme" | "change.navigation" | "change.screens" | "change.dataModels" | "change.translations" | "change.features"> = {
  name: "change.name", tagline: "change.tagline", theme: "change.theme", navigation: "change.navigation",
  screens: "change.screens", dataModels: "change.dataModels", translations: "change.translations", features: "change.features",
};

/** One readable line per operation, in the viewer's language (the API returns raw operations, not English text). */
export function describeChange(locale: Locale, op: Pick<Op, "op" | "path">): string {
  const top = op.path.split("/")[1] ?? "";
  const what = t(locale, WHAT[top] ?? "change.other");
  return tf(locale, op.op === "add" ? "change.added" : op.op === "remove" ? "change.removed" : "change.changed", { what });
}

/** Collapses repeated lines (a screen add is usually several ops) so the chat stays short. */
export function describeChanges(locale: Locale, ops: Pick<Op, "op" | "path">[]): string[] {
  return [...new Set(ops.map((o) => describeChange(locale, o)))];
}
