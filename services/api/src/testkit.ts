import { createHmac } from "node:crypto";
import { MockLlm } from "@appforge/generator";
import { createAdapters, type Adapters } from "./adapters";
import { MockBilling } from "./adapters/billing";
import { MockMailer } from "./adapters/mailer";
import { MockPayments } from "./adapters/payments";
import { MockPush } from "./adapters/push";
import { MockBuilds } from "./adapters/builds";
import { createPlatform, type Platform } from "./platform";

export interface Client {
  call(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: any; headers: Headers }>;
  cookie: string | undefined;
}

/** A browser-like client: keeps the session cookie between calls and can present a chosen IP. */
export function client(p: Platform, ip = "10.0.0.1"): Client {
  const c: Client = {
    cookie: undefined,
    async call(method, path, body, headers = {}) {
      const res = await p.handle(new Request(`http://api${path}`, {
        method, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        headers: { "x-forwarded-for": ip, ...(c.cookie ? { cookie: c.cookie } : {}), ...headers },
      }));
      const set = res.headers.getSetCookie()[0];
      if (set) { const pair = set.split(";")[0]!; c.cookie = pair.endsWith("=") ? undefined : pair; }
      if ((res.headers.get("content-type") ?? "").startsWith("image/png")) return { status: res.status, body: Buffer.from(await res.arrayBuffer()), headers: res.headers };
      const text = await res.text();
      let parsed: any = text;
      try { parsed = JSON.parse(text); } catch { /* non-JSON (csv, png) */ }
      return { status: res.status, body: parsed, headers: res.headers };
    },
  };
  return c;
}

export const testAdapters = (): Adapters & { mailer: MockMailer; push: MockPush } => ({
  ...createAdapters({}), mailer: new MockMailer(() => {}), push: new MockPush(), payments: new MockPayments("http://web"), billing: new MockBilling(), builds: new MockBuilds(), paypal: null,
});

export const newPlatform = (over: Parameters<typeof createPlatform>[0] = {}) =>
  createPlatform({ env: {}, llm: new MockLlm(), adapters: testAdapters(), ...over });

export const stripeSig = (raw: string, secret: string, t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")}`;

let n = 0;
export async function signedUp(p: Platform, ip = `10.1.${++n}.1`) {
  const c = client(p, ip);
  const email = `user${n}@example.com`;
  const r = await c.call("POST", "/v1/auth/signup", { email, password: "correct horse battery" });
  if (r.status !== 201) throw new Error(`signup failed: ${JSON.stringify(r.body)}`);
  return { c, email };
}
