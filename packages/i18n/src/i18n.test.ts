import { describe, expect, it } from "vitest";
import { EXAMPLES, EXAMPLE_KEYS, LOCALES, MESSAGES, dirOf, t, tf, type MessageKey } from "./index";

describe("i18n", () => {
  it("has exactly 8 locales with RTL for he and ar only", () => {
    expect(LOCALES).toHaveLength(8);
    expect(LOCALES.filter((l) => dirOf(l) === "rtl")).toEqual(["he", "ar"]);
  });
  it("every locale defines every key with non-empty text", () => {
    const keys = Object.keys(MESSAGES.en);
    for (const l of LOCALES) {
      expect(Object.keys(MESSAGES[l]).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(MESSAGES[l][k as keyof (typeof MESSAGES)["en"]].trim()).not.toBe("");
    }
  });
  it("translates", () => expect(t("he", "hero.cta")).toBe("צרו את האפליקציה שלי"));
  it("every translation keeps exactly the placeholders of the English source", () => {
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(MESSAGES.en) as MessageKey[])
      for (const l of LOCALES) expect(ph(MESSAGES[l][k]), `${l}:${k}`).toEqual(ph(MESSAGES.en[k]));
  });
  it("translations are really translated: no non-English locale copies long English text verbatim", () => {
    const allowed = new Set(["build.ios", "build.android", "plan.starter", "plan.pro", "plan.business"]);
    for (const k of Object.keys(MESSAGES.en) as MessageKey[]) {
      if (allowed.has(k) || MESSAGES.en[k].length < 25) continue;
      for (const l of LOCALES.filter((x) => x !== "en")) expect(MESSAGES[l][k], `${l}:${k}`).not.toBe(MESSAGES.en[k]);
    }
  });
  it("tf fills placeholders and leaves unknown ones visible", () => {
    expect(tf("en", "feat.apps", { n: 3 })).toBe("Up to 3 apps");
    expect(tf("he", "feat.apps", { n: 3 })).toContain("3");
    expect(tf("en", "dash.plan", {})).toBe("Plan: {plan}");
  });
  it("example chips exist for every locale", () => {
    for (const l of LOCALES) for (const k of EXAMPLE_KEYS) expect(EXAMPLES[l][k].trim()).not.toBe("");
  });
});
