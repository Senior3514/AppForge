import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RevisionLog, applyPatchOps, describeOps, makeAppSpecSchema, migrateSpec, toJsonSchema, tr } from "./index";

const Schema = makeAppSpecSchema(z.object({ id: z.string(), module: z.literal("text"), props: z.object({ body: z.string() }) }));
const base: z.infer<typeof Schema> = {
  version: 1, name: "Demo", tagline: "", locale: "en",
  theme: { primary: "#336699", radius: 12, font: "modern" },
  navigation: ["home"], dataModels: [], translations: { he: { Hello: "שלום" } },
  features: { payments: false, push: false, analytics: true },
  screens: [{ id: "home", title: "Home", icon: "home", blocks: [{ id: "b1", module: "text", props: { body: "Hello" } }] }],
};

describe("patch", () => {
  it("does not mutate input", () => {
    const out = applyPatchOps(base, [{ op: "replace", path: "/name", value: "X" }]);
    expect(out.name).toBe("X");
    expect(base.name).toBe("Demo");
  });
  it("throws on a bad pointer", () => expect(() => applyPatchOps(base, [{ op: "remove", path: "/nope/1" }])).toThrow());
  it("describes ops readably", () => expect(describeOps([{ op: "add", path: "/screens/1", value: {} }])).toEqual(["Added screens › 1"]));
});

describe("revisions", () => {
  const log = () => new RevisionLog(base, (d) => Schema.parse(d));
  it("undo/redo round-trips and discards redo branch on new commit", () => {
    const l = log();
    l.commit([{ op: "replace", path: "/name", value: "A" }], { label: "a", source: "ai" });
    l.commit([{ op: "replace", path: "/name", value: "B" }], { label: "b", source: "manual" });
    expect(l.undo().name).toBe("A");
    expect(l.undo().name).toBe("Demo");
    expect(l.canUndo).toBe(false);
    expect(l.redo().name).toBe("A");
    l.commit([{ op: "replace", path: "/name", value: "C" }], { label: "c", source: "ai" });
    expect(l.canRedo).toBe(false);
    expect(l.history.map((r) => r.label)).toEqual(["a", "c"]);
  });
  it("rejects a commit that yields an invalid spec and leaves history untouched", () => {
    const l = log();
    expect(() => l.commit([{ op: "replace", path: "/theme/primary", value: "red" }], { label: "bad", source: "ai" })).toThrow();
    expect(l.history).toHaveLength(0);
    expect(l.current.theme.primary).toBe("#336699");
  });
});

describe("migrate", () => {
  it("passes current version through", () => expect(migrateSpec(base).version).toBe(1));
  it("chains migrations", () => {
    const out = migrateSpec({ version: 1, a: 1 }, { 1: (s) => ({ ...s, b: 2 }), 2: (s) => ({ ...s, c: 3 }) }, 3);
    expect(out).toMatchObject({ version: 3, a: 1, b: 2, c: 3 });
  });
  it("rejects newer or missing", () => {
    expect(() => migrateSpec({ version: 9 })).toThrow(/newer/);
    expect(() => migrateSpec({ version: 1 }, {}, 2)).toThrow(/no migration/);
  });
});

describe("misc", () => {
  it("exports JSON schema with object root", () => expect(toJsonSchema(Schema)).toMatchObject({ type: "object" }));
  it("translates with fallback", () => {
    expect(tr(base, "he", "Hello")).toBe("שלום");
    expect(tr(base, "he", "Unknown")).toBe("Unknown");
    expect(tr(base, "en", "Hello")).toBe("Hello");
  });
});
