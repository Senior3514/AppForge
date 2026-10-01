import { describe, expect, it } from "vitest";
import { LOCALES } from "@appforge/i18n";
import { describeChange, describeChanges } from "./changes";

describe("describeChange", () => {
  it("is localised, not English, for every other language", () => {
    const en = describeChange("en", { op: "add", path: "/screens/4" });
    expect(en).toBe("Added a screen or its content");
    for (const l of LOCALES.filter((x) => x !== "en")) expect(describeChange(l, { op: "add", path: "/screens/4" })).not.toBe(en);
    expect(describeChange("he", { op: "replace", path: "/name" })).toBe("שונה: שם האפליקציה");
  });
  it("falls back for unknown paths and dedupes repeated lines", () => {
    expect(describeChange("en", { op: "replace", path: "/weird" })).toBe("Changed a setting");
    expect(describeChanges("en", [{ op: "add", path: "/screens/4" }, { op: "add", path: "/screens/4/blocks/0" }, { op: "add", path: "/navigation/-" }])).toEqual(["Added a screen or its content", "Added the tab bar"]);
  });
});
