import type { Operation } from "fast-json-patch";
import type { AppSpec } from "./app";
import { moduleById } from "./library";

type Ops = Operation[];
type Field = AppSpec["dataModels"][number]["fields"][number];
type Seed = AppSpec["dataModels"][number]["seed"];

interface ModelNeed { id: string; fields: Field[]; seed: Seed }

/** Data each module needs in order to be valid and show something useful in previews. */
const NEEDS: Record<string, ModelNeed> = {
  list: { id: "items", fields: [{ name: "name", type: "text" }, { name: "note", type: "text" }], seed: [{ name: "First item", note: "New" }, { name: "Second item", note: "Popular" }] },
  booking: { id: "bookings", fields: [{ name: "name", type: "text" }, { name: "phone", type: "phone" }], seed: [] },
  catalog: { id: "products", fields: [{ name: "name", type: "text" }, { name: "price", type: "text" }], seed: [{ name: "Product one", price: "$10" }, { name: "Product two", price: "$15" }] },
  announcements: { id: "news", fields: [{ name: "title", type: "text" }, { name: "body", type: "text" }], seed: [{ title: "Welcome", body: "Our first announcement" }] },
};
const fieldNames = (m: { fields: Field[] }) => new Set(m.fields.map((f) => f.name));

/**
 * Patch that adds a module to a screen, creating any data model it needs and enabling required features.
 * Reuses an existing model with the same id only if it has the needed fields; otherwise picks a fresh id.
 */
export function addModuleOps(spec: AppSpec, screenId: string, moduleId: string): Ops {
  const def = moduleById(moduleId);
  const screenIdx = spec.screens.findIndex((s) => s.id === screenId);
  if (!def) throw new Error(`unknown module "${moduleId}"`);
  if (screenIdx < 0) throw new Error(`unknown screen "${screenId}"`);

  const ops: Ops = [];
  const props = structuredClone(def.defaults) as Record<string, unknown>;
  const need = NEEDS[moduleId];
  if (need) {
    let id = need.id;
    const existing = (x: string) => spec.dataModels.find((m) => m.id === x);
    const compatible = (x: string) => { const m = existing(x); return !!m && need.fields.every((f) => fieldNames(m).has(f.name)); };
    if (!compatible(id)) {
      for (let n = 2; existing(id); n++) id = `${need.id}-${n}`;
      ops.push({ op: "add", path: "/dataModels/-", value: { id, fields: need.fields, seed: need.seed } });
    }
    props.collection = id;
    if (moduleId === "list") { props.titleField = "name"; props.subtitleField = need.fields.some((f) => f.name === "note") && !compatible(need.id) ? "note" : null; }
  }
  for (const f of def.requires) if (!spec.features[f]) ops.push({ op: "replace", path: `/features/${f}`, value: true });

  const taken = new Set(spec.screens.flatMap((s) => s.blocks.map((b) => b.id)));
  let n = 1;
  while (taken.has(`${moduleId}-${n}`)) n++;
  ops.push({ op: "add", path: `/screens/${screenIdx}/blocks/-`, value: { id: `${moduleId}-${n}`, module: moduleId, props } });
  return ops;
}

/** Patch that removes a screen and its tab. Returns null if it is the last screen (an app needs at least one). */
export function removeScreenOps(spec: AppSpec, screenId: string): Ops | null {
  const i = spec.screens.findIndex((s) => s.id === screenId);
  if (i < 0 || spec.screens.length <= 1) return null;
  const ops: Ops = [{ op: "remove", path: `/screens/${i}` }];
  const nav = spec.navigation.filter((x) => x !== screenId);
  if (nav.length === 0) nav.push(spec.screens.find((s) => s.id !== screenId)!.id); // keep at least one tab
  if (nav.length !== spec.navigation.length || nav.some((x, k) => x !== spec.navigation[k])) ops.push({ op: "replace", path: "/navigation", value: nav });
  return ops;
}
