import type { Plan } from "../entitlements";
import { TRIAL_DAYS } from "../entitlements";
import { InvalidSignatureError, verifyStripeSignature } from "./payments";

export interface BillingEvent { tenantId: string; plan: Plan; status: "active" | "trialing" | "past_due" | "canceled"; customerId?: string }

export interface BillingProvider {
  readonly name: string;
  /** `activated`: the provider needs no redirect (mock). `url`: send the user to hosted checkout. */
  startCheckout(i: { tenantId: string; email: string | null; plan: Exclude<Plan, "free">; successUrl: string; cancelUrl: string }): Promise<{ url: string } | { activated: true }>;
  parseWebhook(raw: string, headers: Headers): BillingEvent | null;
}

export class MockBilling implements BillingProvider {
  readonly name = "mock";
  async startCheckout() { return { activated: true as const }; }
  parseWebhook() { return null; }
}

interface StripeBillingOpts {
  secretKey: string; webhookSecret: string;
  /** Stripe Price ids per paid plan, created in your dashboard. */
  prices: Record<Exclude<Plan, "free">, string>;
  fetchImpl?: typeof fetch; now?: () => number;
}

export class StripeBilling implements BillingProvider {
  readonly name = "stripe";
  constructor(private o: StripeBillingOpts) {}

  async startCheckout(i: { tenantId: string; email: string | null; plan: Exclude<Plan, "free">; successUrl: string; cancelUrl: string }) {
    const price = this.o.prices[i.plan];
    if (!price) throw new Error(`No Stripe price configured for plan "${i.plan}"`);
    const body = new URLSearchParams({
      mode: "subscription", success_url: i.successUrl, cancel_url: i.cancelUrl,
      client_reference_id: i.tenantId,
      "line_items[0][price]": price, "line_items[0][quantity]": "1",
      "subscription_data[trial_period_days]": String(TRIAL_DAYS),
      "subscription_data[metadata][tenant_id]": i.tenantId, "subscription_data[metadata][plan]": i.plan,
    });
    if (i.email) body.set("customer_email", i.email);
    const res = await (this.o.fetchImpl ?? fetch)("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST", headers: { authorization: `Bearer ${this.o.secretKey}`, "content-type": "application/x-www-form-urlencoded" }, body,
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}`);
    return { url: ((await res.json()) as { url: string }).url };
  }

  parseWebhook(raw: string, headers: Headers): BillingEvent | null {
    if (!verifyStripeSignature(raw, headers.get("stripe-signature"), this.o.webhookSecret, this.o.now)) throw new InvalidSignatureError();
    const ev = JSON.parse(raw) as { type: string; data: { object: { status: string; customer: string; metadata?: Record<string, string> } } };
    if (!ev.type.startsWith("customer.subscription.")) return null;
    const s = ev.data.object;
    const tenantId = s.metadata?.tenant_id;
    const plan = s.metadata?.plan as Plan | undefined;
    if (!tenantId || !plan) return null;
    const status = ev.type.endsWith(".deleted") ? "canceled"
      : s.status === "trialing" ? "trialing" : s.status === "active" ? "active"
      : s.status === "canceled" ? "canceled" : "past_due";
    return { tenantId, plan, status, customerId: s.customer };
  }
}
