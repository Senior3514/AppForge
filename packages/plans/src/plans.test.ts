import { describe, expect, it } from "vitest";
import { ENTITLEMENTS, PLANS, effectivePlan, isPlan } from "./index";

describe("plans", () => {
  it("every plan has entitlements, and limits never decrease as plans go up", () => {
    const vals = PLANS.map((p) => ENTITLEMENTS[p]);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!.maxApps).toBeGreaterThan(vals[i - 1]!.maxApps);
      expect(vals[i]!.monthlyActiveUsers).toBeGreaterThan(vals[i - 1]!.monthlyActiveUsers);
      expect(vals[i]!.priceCents).toBeGreaterThan(vals[i - 1]!.priceCents);
    }
    expect(ENTITLEMENTS.free.storePublishing).toBe(false);
    expect(ENTITLEMENTS.business.removeBranding).toBe(true);
  });
  it("past-due and canceled drop to free; trialing keeps the plan", () => {
    expect(effectivePlan("pro", "trialing")).toBe("pro");
    expect(effectivePlan("pro", "active")).toBe("pro");
    expect(effectivePlan("pro", "past_due")).toBe("free");
    expect(effectivePlan("business", "canceled")).toBe("free");
  });
  it("isPlan narrows", () => { expect(isPlan("pro")).toBe(true); expect(isPlan("gold")).toBe(false); });
});
