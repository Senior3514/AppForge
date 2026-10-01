import { createHmac, timingSafeEqual } from "node:crypto";

export interface CheckoutInput {
  orderId: string; amountCents: number; currency: string; description: string;
  successUrl: string; cancelUrl: string;
  /** The app's language, so hosted pages can match it. */
  locale?: string;
  /** The tenant's own Stripe account (Connect), so money goes to them, not to us. */
  connectedAccountId?: string | null;
}
export class InvalidSignatureError extends Error { constructor() { super("invalid webhook signature"); } }
export type PaymentEvent = { type: "paid" | "failed"; ref: string };

export interface PaymentProvider {
  readonly name: string;
  createCheckout(i: CheckoutInput): Promise<{ url: string; ref: string }>;
  /** Throws InvalidSignatureError on a bad signature; returns null for events we do not act on. */
  parseWebhook(raw: string, headers: Headers): PaymentEvent | null;
  onboard(i: { accountId?: string | null; returnUrl: string; refreshUrl: string }): Promise<{ accountId: string; url: string }>;
}

export class MockPayments implements PaymentProvider {
  readonly name = "mock";
  constructor(private baseUrl: string) {}
  async createCheckout(i: CheckoutInput) {
    const ref = `mock_${i.orderId}`;
    return { ref, url: `${this.baseUrl}/${i.locale ?? "en"}/pay/mock/${ref}` };
  }
  parseWebhook() { return null; }
  async onboard(i: { accountId?: string | null; returnUrl: string }) {
    return { accountId: i.accountId ?? "acct_mock", url: i.returnUrl };
  }
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();

/** Verifies Stripe's `Stripe-Signature` header (t=…,v1=HMAC-SHA256(secret, `${t}.${payload}`)) with a replay window. */
export function verifyStripeSignature(raw: string, header: string | null, secret: string, now = Date.now, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || !parts.v1 || Math.abs(now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${raw}`).digest();
  const got = Buffer.from(parts.v1, "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

interface StripeOpts { secretKey: string; webhookSecret: string; fetchImpl?: typeof fetch; now?: () => number }

export class StripePayments implements PaymentProvider {
  readonly name = "stripe";
  constructor(private o: StripeOpts) {}

  private async api(path: string, body: Record<string, string>, account?: string | null) {
    const res = await (this.o.fetchImpl ?? fetch)(`https://api.stripe.com/v1/${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${this.o.secretKey}`, "content-type": "application/x-www-form-urlencoded", ...(account ? { "stripe-account": account } : {}) },
      body: form(body),
    });
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as Record<string, any>;
  }

  /** Checkout Session on the tenant's connected account. Apple Pay / Google Pay appear automatically in Checkout when enabled in the Stripe dashboard. */
  async createCheckout(i: CheckoutInput) {
    if (!i.connectedAccountId) throw new Error("This app has not connected a Stripe account yet");
    const s = await this.api("checkout/sessions", {
      mode: "payment",
      success_url: i.successUrl, cancel_url: i.cancelUrl,
      client_reference_id: i.orderId, "metadata[order_id]": i.orderId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": i.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(i.amountCents),
      "line_items[0][price_data][product_data][name]": i.description,
    }, i.connectedAccountId);
    return { url: s.url as string, ref: s.id as string };
  }

  parseWebhook(raw: string, headers: Headers): PaymentEvent | null {
    if (!verifyStripeSignature(raw, headers.get("stripe-signature"), this.o.webhookSecret, this.o.now)) throw new InvalidSignatureError();
    const ev = JSON.parse(raw) as { type: string; data: { object: { id: string } } };
    if (ev.type === "checkout.session.completed") return { type: "paid", ref: ev.data.object.id };
    if (ev.type === "checkout.session.expired" || ev.type === "checkout.session.async_payment_failed") return { type: "failed", ref: ev.data.object.id };
    return null;
  }

  async onboard(i: { accountId?: string | null; returnUrl: string; refreshUrl: string }) {
    const accountId = i.accountId ?? ((await this.api("accounts", { type: "express" })).id as string);
    const link = await this.api("account_links", { account: accountId, type: "account_onboarding", return_url: i.returnUrl, refresh_url: i.refreshUrl });
    return { accountId, url: link.url as string };
  }
}

/** PayPal Orders v2 (feature-flagged). Payment is confirmed by capturing on return, not by webhook. */
export class PayPalPayments implements PaymentProvider {
  readonly name = "paypal";
  constructor(private o: { clientId: string; secret: string; live?: boolean; fetchImpl?: typeof fetch }) {}
  private get base() { return this.o.live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com"; }
  private get f() { return this.o.fetchImpl ?? fetch; }

  private async token(): Promise<string> {
    const res = await this.f(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${this.o.clientId}:${this.o.secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) throw new Error(`PayPal auth ${res.status}`);
    return ((await res.json()) as { access_token: string }).access_token;
  }

  async createCheckout(i: CheckoutInput) {
    const res = await this.f(`${this.base}/v2/checkout/orders`, {
      method: "POST",
      headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ reference_id: i.orderId, description: i.description, amount: { currency_code: i.currency.toUpperCase(), value: (i.amountCents / 100).toFixed(2) } }],
        application_context: { return_url: i.successUrl, cancel_url: i.cancelUrl, user_action: "PAY_NOW" },
      }),
    });
    if (!res.ok) throw new Error(`PayPal ${res.status}`);
    const o = (await res.json()) as { id: string; links: { rel: string; href: string }[] };
    const approve = o.links.find((l) => l.rel === "approve" || l.rel === "payer-action")?.href;
    if (!approve) throw new Error("PayPal returned no approval link");
    return { url: approve, ref: o.id };
  }

  /** Captures an approved order; true if funds were captured. */
  async capture(ref: string): Promise<boolean> {
    const res = await this.f(`${this.base}/v2/checkout/orders/${encodeURIComponent(ref)}/capture`, {
      method: "POST", headers: { authorization: `Bearer ${await this.token()}`, "content-type": "application/json" },
    });
    return res.ok && ((await res.json()) as { status: string }).status === "COMPLETED";
  }

  parseWebhook() { return null; }
  async onboard(): Promise<never> { throw new Error("PayPal payouts go to the platform account configured in PAYPAL_CLIENT_ID; per-tenant onboarding is not supported"); }
}
