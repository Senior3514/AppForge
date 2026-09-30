export const PLANS = ["free", "starter", "pro", "business"] as const;
export type Plan = (typeof PLANS)[number];

export interface Entitlements {
  maxApps: number;
  storePublishing: boolean;
  customAdminDomain: boolean;
  monthlyActiveUsers: number;
  removeBranding: boolean;
  /** Placeholder list price in USD cents per month; set real prices in your Stripe account. */
  priceCents: number;
}

export const ENTITLEMENTS: Record<Plan, Entitlements> = {
  free:     { maxApps: 1,  storePublishing: false, customAdminDomain: false, monthlyActiveUsers: 100,    removeBranding: false, priceCents: 0 },
  starter:  { maxApps: 3,  storePublishing: true,  customAdminDomain: false, monthlyActiveUsers: 1_000,  removeBranding: false, priceCents: 1900 },
  pro:      { maxApps: 10, storePublishing: true,  customAdminDomain: true,  monthlyActiveUsers: 10_000, removeBranding: false, priceCents: 4900 },
  business: { maxApps: 50, storePublishing: true,  customAdminDomain: true,  monthlyActiveUsers: 100_000, removeBranding: true, priceCents: 14900 },
};

export const TRIAL_DAYS = 7;
export const isPlan = (v: unknown): v is Plan => typeof v === "string" && (PLANS as readonly string[]).includes(v);

/** A canceled or past-due subscription drops to free-tier entitlements; data is never deleted. */
export function effectivePlan(plan: Plan, status: string): Plan {
  return status === "canceled" || status === "past_due" ? "free" : plan;
}
