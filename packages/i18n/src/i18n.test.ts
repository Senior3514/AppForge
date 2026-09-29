import { describe, expect, it } from "vitest";
import { EXAMPLES, EXAMPLE_KEYS, LOCALES, MESSAGES, dirOf, t } from "./index";

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
  it("example chips exist for every locale", () => {
    for (const l of LOCALES) for (const k of EXAMPLE_KEYS) expect(EXAMPLES[l][k].trim()).not.toBe("");
  });
});
