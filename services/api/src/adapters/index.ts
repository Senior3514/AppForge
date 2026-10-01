import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BillingProvider } from "./billing";
import { MockBilling, StripeBilling } from "./billing";
import type { BuildProvider } from "./builds";
import { EasCliBuilds, MockBuilds } from "./builds";
import type { Mailer } from "./mailer";
import { MockMailer, ResendMailer } from "./mailer";
import type { PaymentProvider } from "./payments";
import { MockPayments, PayPalPayments, StripePayments } from "./payments";
import type { PushProvider } from "./push";
import { ExpoPush, MockPush } from "./push";

export interface Adapters { mailer: Mailer; payments: PaymentProvider; paypal: PayPalPayments | null; billing: BillingProvider; push: PushProvider; builds: BuildProvider }
type Env = Record<string, string | undefined>;

const flag = (env: Env, name: string, ...required: string[]) => env[name] === "true" && required.every((k) => env[k]);
const RUNTIME_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "apps", "runtime");

/** Each real adapter needs its flag AND its credentials; anything less falls back to the mock, so nothing half-configured runs. */
export function createAdapters(env: Env = process.env, baseUrl = env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000"): Adapters {
  return {
    mailer: env.RESEND_API_KEY && env.MAIL_FROM ? new ResendMailer({ apiKey: env.RESEND_API_KEY, from: env.MAIL_FROM }) : new MockMailer(),
    payments: flag(env, "APPFORGE_FLAG_STRIPE", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET")
      ? new StripePayments({ secretKey: env.STRIPE_SECRET_KEY!, webhookSecret: env.STRIPE_WEBHOOK_SECRET! })
      : new MockPayments(baseUrl),
    paypal: flag(env, "APPFORGE_FLAG_PAYPAL", "PAYPAL_CLIENT_ID", "PAYPAL_SECRET")
      ? new PayPalPayments({ clientId: env.PAYPAL_CLIENT_ID!, secret: env.PAYPAL_SECRET!, live: env.PAYPAL_LIVE === "true" })
      : null,
    billing: flag(env, "APPFORGE_FLAG_STRIPE", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_STARTER", "STRIPE_PRICE_PRO", "STRIPE_PRICE_BUSINESS")
      ? new StripeBilling({ secretKey: env.STRIPE_SECRET_KEY!, webhookSecret: env.STRIPE_WEBHOOK_SECRET!, prices: { starter: env.STRIPE_PRICE_STARTER!, pro: env.STRIPE_PRICE_PRO!, business: env.STRIPE_PRICE_BUSINESS! } })
      : new MockBilling(),
    push: flag(env, "APPFORGE_FLAG_PUSH") ? new ExpoPush({ accessToken: env.EXPO_ACCESS_TOKEN }) : new MockPush(),
    builds: flag(env, "APPFORGE_FLAG_EAS", "EXPO_TOKEN") ? new EasCliBuilds({ runtimeDir: RUNTIME_DIR, expoToken: env.EXPO_TOKEN! }) : new MockBuilds(),
  };
}
