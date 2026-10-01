import { describe, expect, it } from "vitest";
import { contrast, paletteFromPrimary, scriptOf } from "./index";

describe("ui-tokens", () => {
  it("contrast of black on white is 21", () => expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0));
  it("palettes keep AA contrast for any brand colour", () => {
    for (const primary of ["#ffee00", "#0a2a66", "#e63946", "#2a9d8f", "#777777"])
      for (const mode of ["light", "dark"] as const) {
        const p = paletteFromPrimary(primary, mode);
        expect(contrast(p.primary, p.onPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.background, p.text)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(p.background, p.mutedText)).toBeGreaterThanOrEqual(4.5);
      }
  });
  it("rejects bad hex", () => expect(() => paletteFromPrimary("red")).toThrow());
  it("picks script fonts", () => expect([scriptOf("he"), scriptOf("en")]).toEqual(["hebrew", "latin"]));
});
