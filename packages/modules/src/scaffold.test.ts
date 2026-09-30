import { describe, expect, it } from "vitest";
import { applyPatchOps } from "@appforge/spec";
import { MODULES, removeScreenOps, addModuleOps, validateApp, type AppSpec } from "./index";

const base = (): AppSpec => ({
  version: 1, name: "Cafe", tagline: "", locale: "en",
  theme: { primary: "#8a5a2b", radius: 14, font: "rounded" },
  navigation: ["home"], screens: [{ id: "home", title: "Home", icon: "home", blocks: [] }, { id: "extra", title: "Extra", icon: "x", blocks: [] }],
  dataModels: [], translations: {}, features: { payments: false, push: false, analytics: true },
});

describe("addModuleOps", () => {
  it.each(MODULES.map((m) => [m.id] as const))("adding %s to an empty app yields a valid app", (id) => {
    const out = applyPatchOps(base(), addModuleOps(base(), "home", id));
    const v = validateApp(out);
    expect(v.ok, v.ok ? "" : v.errors.join()).toBe(true);
  });

  it("enables required features (payments for catalog, push for announcements)", () => {
    expect(applyPatchOps(base(), addModuleOps(base(), "home", "catalog")).features.payments).toBe(true);
    expect(applyPatchOps(base(), addModuleOps(base(), "home", "announcements")).features.push).toBe(true);
  });

  it("adds the same module twice with unique block ids, reusing the compatible model", () => {
    let s = applyPatchOps(base(), addModuleOps(base(), "home", "booking"));
    s = applyPatchOps(s, addModuleOps(s, "extra", "booking"));
    expect(s.screens.flatMap((x) => x.blocks.map((b) => b.id))).toEqual(["booking-1", "booking-2"]);
    expect(s.dataModels.filter((m) => m.id.startsWith("bookings"))).toHaveLength(1);
    expect(validateApp(s).ok).toBe(true);
  });

  it("does not reuse an incompatible model with the same id", () => {
    const s0 = base();
    s0.dataModels.push({ id: "products", fields: [{ name: "title", type: "text" }], seed: [] });
    const s = applyPatchOps(s0, addModuleOps(s0, "home", "catalog"));
    expect(s.dataModels.map((m) => m.id)).toEqual(["products", "products-2"]);
    expect(validateApp(s).ok).toBe(true);
  });

  it("rejects unknown module or screen", () => {
    expect(() => addModuleOps(base(), "home", "nope")).toThrow(/unknown module/);
    expect(() => addModuleOps(base(), "ghost", "hero")).toThrow(/unknown screen/);
  });
});

describe("removeScreenOps", () => {
  it("removes the screen and its tab", () => {
    const s0 = base(); s0.navigation = ["home", "extra"];
    const s = applyPatchOps(s0, removeScreenOps(s0, "extra")!);
    expect(s.screens.map((x) => x.id)).toEqual(["home"]);
    expect(s.navigation).toEqual(["home"]);
    expect(validateApp(s).ok).toBe(true);
  });
  it("keeps a valid tab bar when the only tab's screen is removed", () => {
    const s = applyPatchOps(base(), removeScreenOps(base(), "home")!);
    expect(s.navigation).toEqual(["extra"]);
    expect(validateApp(s).ok).toBe(true);
  });
  it("refuses to remove the last screen or an unknown one", () => {
    const one = base(); one.screens.pop();
    expect(removeScreenOps(one, "home")).toBeNull();
    expect(removeScreenOps(base(), "ghost")).toBeNull();
  });
});
