import { describe, expect, it } from "vitest";
import { toJsonSchema } from "@appforge/spec";
import { AppSpecSchema, BlockSchema, MODULES, validateApp, type AppSpec } from "./index";

/** Contract tests: every module must satisfy these, so new modules are covered automatically. */
describe.each(MODULES.map((m) => [m.id, m] as const))("module contract: %s", (_id, m) => {
  it("defaults satisfy its own props schema", () => expect(m.props.safeParse(m.defaults).success).toBe(true));
  it("has an id valid for use as a discriminator and a description", () => {
    expect(m.id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(m.description.length).toBeGreaterThan(10);
  });
  it("props export to JSON Schema", () => expect(toJsonSchema(m.props)).toMatchObject({ type: "object" }));
  it("ids are unique across the library", () => expect(MODULES.filter((x) => x.id === m.id)).toHaveLength(1));
});

const app = (over: Partial<AppSpec> = {}): AppSpec => ({
  version: 1, name: "Cafe", tagline: "", locale: "en",
  theme: { primary: "#8a5a2b", radius: 14, font: "rounded" },
  navigation: ["home", "menu"],
  screens: [
    { id: "home", title: "Home", icon: "home", blocks: [{ id: "h1", module: "hero", props: { headline: "Hi", subtitle: "", cta: "" } }] },
    { id: "menu", title: "Menu", icon: "list", blocks: [{ id: "l1", module: "list", props: { collection: "items", titleField: "name", subtitleField: null } }] },
  ],
  dataModels: [{ id: "items", fields: [{ name: "name", type: "text" }], seed: [{ name: "Latte" }] }],
  translations: {}, features: { payments: false, push: false, analytics: true },
  ...over,
});

describe("validateApp", () => {
  it("accepts a coherent app", () => expect(validateApp(app()).ok).toBe(true));
  const errs = (a: unknown) => { const r = validateApp(a); return r.ok ? [] : r.errors; };
  it("flags unknown data model", () => expect(errs(app({ dataModels: [] })).join()).toMatch(/unknown data model "items"/));
  it("flags navigation to missing screen", () => expect(errs(app({ navigation: ["home", "nope"] })).join()).toMatch(/unknown screen "nope"/));
  it("flags module feature requirements", () => {
    const a = app();
    a.screens[0]!.blocks.push({ id: "c1", module: "catalog", props: { collection: "items", currency: "USD" } });
    expect(errs(a).join()).toMatch(/requires features.payments/);
  });
  it("flags missing fields and duplicate ids", () => {
    const a = app();
    (a.screens[1]!.blocks[0]!.props as { titleField: string }).titleField = "ghost";
    a.screens[1]!.blocks[0]!.id = "h1";
    const e = errs(a);
    expect(e.some((x) => x.includes('missing field "ghost"'))).toBe(true);
    expect(e.some((x) => x.includes('duplicate block id "h1"'))).toBe(true);
  });
  it("rejects unknown module names (LLM cannot invent modules)", () => {
    const a = app() as unknown as { screens: { blocks: unknown[] }[] };
    a.screens[0]!.blocks.push({ id: "x", module: "shell-exec", props: {} });
    expect(errs(a).length).toBeGreaterThan(0);
  });
  it("schema exports to JSON schema", () => expect(toJsonSchema(AppSpecSchema)).toMatchObject({ type: "object" }));
});

it("BlockSchema covers every module in the library", () => {
  expect([...BlockSchema.options.map((o) => o.shape.module.value)].sort()).toEqual(MODULES.map((m) => m.id).sort());
});
