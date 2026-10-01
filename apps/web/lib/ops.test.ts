import { describe, expect, it } from "vitest";
import { MockLlm, generateApp } from "@appforge/generator";
import { addModuleOps, removeScreenOps, validateApp, type AppSpec } from "@appforge/modules";
import { applyPatchOps } from "@appforge/spec";
import { tr } from "@appforge/spec";
import * as ops from "./ops";

const gen = async (prompt: string): Promise<AppSpec> => (await generateApp(prompt, { llm: new MockLlm() })).spec;
const apply = (spec: AppSpec, o: ops.Op[]) => applyPatchOps(spec, o as never);
const valid = (spec: AppSpec) => { const v = validateApp(spec); expect(v.ok, v.ok ? "" : v.errors.join()).toBe(true); };

describe("reorder / navigation", () => {
  it("moves items and ignores out-of-range", () => {
    expect(ops.reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(ops.reorder([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
    expect(ops.reorder([1, 2], 5, 0)).toEqual([1, 2]);
    expect(ops.reorder([1, 2], 1, 1)).toEqual([1, 2]);
  });
  it("reorders the tab bar and stays valid", async () => {
    const s = await gen("salon booking app");
    const out = apply(s, ops.navigationOps(s.navigation, 0, 2));
    expect(out.navigation).toEqual(ops.reorder(s.navigation, 0, 2));
    valid(out);
    expect(ops.navigationOps(s.navigation, 1, 1)).toEqual([]);
  });
  it("tab toggling respects the 5-tab cap and never empties the bar", async () => {
    const s = await gen("salon booking app");
    const full = apply(s, [ops.replaceOp("/navigation", ["home", "services", "book", "contact"])]);
    const withExtra = apply(full, addModuleOps(full, "home", "loyalty").map((o) => o as ops.Op));
    expect(ops.toggleTabOps(withExtra, "home", true)).toEqual([]);
    const one = apply(s, [ops.replaceOp("/navigation", ["home"])]);
    expect(ops.toggleTabOps(one, "home", false)).toBeNull();
    const five = apply(s, [ops.replaceOp("/navigation", ["home", "services", "book", "contact"])]);
    five.screens.push({ id: "a", title: "A", icon: "x", blocks: [] }, { id: "b", title: "B", icon: "x", blocks: [] });
    const nav5 = { ...five, navigation: ["home", "services", "book", "contact", "a"] };
    expect(ops.toggleTabOps(nav5, "b", true)).toBeNull();
    expect(apply(s, ops.toggleTabOps(s, "services", false)!).navigation).not.toContain("services");
  });
});

describe("translations", () => {
  it("adds a locale, edits, and clears a translation; preview lookup uses it", async () => {
    let s = await gen("salon booking app");
    s = apply(s, ops.translationOps(s, "fr", s.name, "Studio Éclat"));
    expect(tr(s, "fr", s.name)).toBe("Studio Éclat");
    s = apply(s, ops.translationOps(s, "fr", s.tagline, "Réservez en quelques secondes"));
    expect(Object.keys(s.translations.fr!)).toHaveLength(2);
    s = apply(s, ops.translationOps(s, "fr", s.name, "  "));
    expect(tr(s, "fr", s.name)).toBe(s.name);
    expect(Object.keys(s.translations.fr!)).toHaveLength(1);
    valid(s);
  });
  it("sourceStrings covers names, titles, copy and displayed rows, deduplicated", async () => {
    const s = await gen("salon booking app");
    const src = ops.sourceStrings(s);
    for (const expected of [s.name, s.tagline, "Home", "Haircut", "Book now"]) expect(src).toContain(expected);
    expect(new Set(src).size).toBe(src.length);
    expect(src).not.toContain("https://example.com/stream");
  });
});

describe("blocks and data rows", () => {
  it("edits block props through generic fields, never the data-model references", async () => {
    const s = await gen("salon booking app");
    const hero = s.screens[0]!.blocks[0]!;
    const fields = ops.blockFields(hero);
    expect(fields.map((f) => f.key).sort()).toEqual(["cta", "headline", "subtitle"]);
    const out = apply(s, [ops.blockPropOp(0, 0, "headline", "Hello there")]);
    expect((out.screens[0]!.blocks[0]!.props as { headline: string }).headline).toBe("Hello there");
    const list = s.screens[1]!.blocks[0]!;
    expect(ops.blockFields(list)).toEqual([]);
  });
  it("reorders and removes blocks", async () => {
    let s = await gen("salon booking app");
    s = apply(s, addModuleOps(s, "home", "text").map((o) => o as ops.Op));
    const ids = s.screens[0]!.blocks.map((b) => b.id);
    expect(apply(s, ops.moveBlockOps(s, 0, 0, 1)).screens[0]!.blocks.map((b) => b.id)).toEqual([...ids].reverse());
    expect(apply(s, ops.removeBlockOps(0, 0)).screens[0]!.blocks).toHaveLength(ids.length - 1);
  });
  it("edits, adds and removes seed rows on content models only", async () => {
    let s = await gen("salon booking app");
    const cm = ops.contentModels(s);
    expect(cm.map((m) => m.id)).toEqual(["services"]); // not the bookings inbox
    s = apply(s, [ops.seedCellOp(cm[0]!.idx, 0, "name", "Beard trim")]);
    expect(s.dataModels[cm[0]!.idx]!.seed[0]!.name).toBe("Beard trim");
    const n = s.dataModels[cm[0]!.idx]!.seed.length;
    s = apply(s, ops.addSeedRowOps(s, cm[0]!.idx));
    expect(s.dataModels[cm[0]!.idx]!.seed).toHaveLength(n + 1);
    s = apply(s, ops.removeSeedRowOps(cm[0]!.idx, n));
    expect(s.dataModels[cm[0]!.idx]!.seed).toHaveLength(n);
    valid(s);
  });
  it("removing a screen via scaffold keeps the app valid", async () => {
    const s = await gen("salon booking app");
    valid(apply(s, removeScreenOps(s, "contact")! as ops.Op[]));
  });
});
