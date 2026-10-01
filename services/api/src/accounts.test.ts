import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MockLlm } from "@appforge/generator";
import { client, newPlatform, signedUp, testAdapters, type Client } from "./testkit";
import type { Platform } from "./platform";

let p: Platform;
const mail = () => (p.deps.adapters.mailer as ReturnType<typeof testAdapters>["mailer"]).outbox;
const tokenIn = (text: string) => /token=([\w-]+)/.exec(text)![1]!;
const lastTo = (email: string) => mail().filter((m) => m.to === email).at(-1)!;

// A fake provider: records the request and answers like an OpenAI-compatible API (or rejects a bad key).
const calls: { url: string; auth: string | null; body: any }[] = [];
const fakeFetch: typeof fetch = async (input, init) => {
  const url = String(input);
  const auth = new Headers(init?.headers).get("authorization");
  const body = JSON.parse(String(init?.body));
  calls.push({ url, auth, body });
  if (auth === "Bearer bad-key-123456") return new Response(JSON.stringify({ error: { message: "invalid api key" } }), { status: 401 });
  const arg = body.tools[0].function.parameters.properties?.ok ? { ok: true } : JSON.parse(JSON.stringify(await new MockLlm().run({ task: body.messages[1].content.includes("Current AppSpec") ? "patch" : "generate", system: "", user: "", schema: {}, meta: { prompt: "coffee shop", locale: "en" } }).then((r) => r.json)));
  return new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify(arg) } }] } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
};

beforeAll(async () => { p = await newPlatform({ fetchImpl: fakeFetch, operatorEmails: new Set(["boss@example.com"]) }); });
afterAll(() => p.close());

describe("email verification", () => {
  it("sends a link on signup, verifies once, and reflects in /v1/me", async () => {
    const { c, email } = await signedUp(p);
    expect((await c.call("GET", "/v1/me")).body.user.verified).toBe(false);
    const token = tokenIn(lastTo(email).text);
    expect((await c.call("POST", "/v1/auth/verify", { token })).status).toBe(200);
    expect((await c.call("GET", "/v1/me")).body.user.verified).toBe(true);
    expect((await c.call("POST", "/v1/auth/verify", { token })).status).toBe(400); // single use
  });
  it("resend issues a fresh link and invalidates the old one", async () => {
    const { c, email } = await signedUp(p);
    const old = tokenIn(lastTo(email).text);
    expect((await c.call("POST", "/v1/auth/verify/resend")).status).toBe(200);
    const fresh = tokenIn(lastTo(email).text);
    expect(fresh).not.toBe(old);
    expect((await c.call("POST", "/v1/auth/verify", { token: old })).status).toBe(400);
    expect((await c.call("POST", "/v1/auth/verify", { token: fresh })).status).toBe(200);
  });
});

describe("password reset", () => {
  it("resets, signs out other sessions, and the old password stops working", async () => {
    const { c: first, email } = await signedUp(p);
    const anon = client(p, "10.9.0.1");
    expect((await anon.call("POST", "/v1/auth/forgot", { email })).status).toBe(200);
    const token = tokenIn(lastTo(email).text);
    const r = await anon.call("POST", "/v1/auth/reset", { token, password: "a brand new passphrase" });
    expect(r.status).toBe(200);
    expect((await anon.call("GET", "/v1/me")).body.user.email).toBe(email);
    expect((await first.call("GET", "/v1/me")).body.user).toBeNull(); // old session revoked
    expect((await client(p, "10.9.0.2").call("POST", "/v1/auth/login", { email, password: "correct horse battery" })).status).toBe(401);
    expect((await client(p, "10.9.0.3").call("POST", "/v1/auth/login", { email, password: "a brand new passphrase" })).status).toBe(200);
    expect((await anon.call("POST", "/v1/auth/reset", { token, password: "another passphrase!" })).status).toBe(400); // single use
  });
  it("answers 200 for unknown emails and sends nothing", async () => {
    const before = mail().length;
    expect((await client(p, "10.9.1.1").call("POST", "/v1/auth/forgot", { email: "nobody@example.com" })).status).toBe(200);
    expect(mail().length).toBe(before);
  });
});

describe("account settings", () => {
  it("changes password only with the current one, keeping this session", async () => {
    const { c, email } = await signedUp(p);
    expect((await c.call("POST", "/v1/account/password", { current: "wrong password", password: "new passphrase 1" })).status).toBe(403);
    expect((await c.call("POST", "/v1/account/password", { current: "correct horse battery", password: "new passphrase 1" })).status).toBe(200);
    expect((await c.call("GET", "/v1/me")).body.user.email).toBe(email);
    expect((await client(p, "10.9.2.1").call("POST", "/v1/auth/login", { email, password: "new passphrase 1" })).status).toBe(200);
  });
  it("exports only the caller's data", async () => {
    const a = await signedUp(p); const b = await signedUp(p);
    await a.c.call("POST", "/v1/apps", { prompt: "coffee shop" });
    const ea = (await a.c.call("GET", "/v1/account/export")).body;
    const eb = (await b.c.call("GET", "/v1/account/export")).body;
    expect(ea.apps).toHaveLength(1);
    expect(eb.apps).toHaveLength(0);
  });
  it("deletes the whole workspace after confirmation", async () => {
    const { c, email } = await signedUp(p);
    await c.call("POST", "/v1/apps", { prompt: "coffee shop" });
    expect((await c.call("POST", "/v1/account/delete", { confirm: "someone@else.com", password: "correct horse battery" })).status).toBe(400);
    expect((await c.call("POST", "/v1/account/delete", { confirm: email, password: "nope nope nope" })).status).toBe(403);
    expect((await c.call("POST", "/v1/account/delete", { confirm: email, password: "correct horse battery" })).status).toBe(200);
    expect((await client(p, "10.9.3.1").call("POST", "/v1/auth/login", { email, password: "correct horse battery" })).status).toBe(401);
    const left = (await p.deps.db.system("select count(*)::int as n from apps a join tenants t on t.id=a.tenant_id where t.name=$1", [email.split("@")[0]])).rows[0]!.n;
    expect(left).toBe(0);
  });
});

describe("bring your own AI key", () => {
  it("requires an account, never returns the key, and encrypts it at rest", async () => {
    expect((await client(p, "10.9.4.1").call("GET", "/v1/ai")).status).toBe(401);
    const { c } = await signedUp(p);
    const put = await c.call("PUT", "/v1/ai", { provider: "openrouter", model: "anthropic/claude-sonnet-4.5", apiKey: "sk-or-secret-abcd1234" });
    expect(put.status).toBe(200);
    const got = await c.call("GET", "/v1/ai");
    expect(got.body.active).toBe("user");
    expect(got.body.key).toMatchObject({ provider: "openrouter", last4: "1234" });
    expect(JSON.stringify(got.body)).not.toContain("secret-abcd");
    const stored = (await p.deps.db.system("select key_enc from ai_providers")).rows.map((r) => r.key_enc as string);
    expect(stored.some((v) => v.includes("secret-abcd"))).toBe(false);
    expect(stored.every((v) => v.startsWith("v1."))).toBe(true);
  });
  it("validates provider, model and key shape", async () => {
    const { c } = await signedUp(p);
    expect((await c.call("PUT", "/v1/ai", { provider: "evil", model: "x", apiKey: "sk-12345678" })).status).toBe(400);
    expect((await c.call("PUT", "/v1/ai", { provider: "openai", model: "bad model!", apiKey: "sk-12345678" })).status).toBe(400);
    expect((await c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o", apiKey: "short" })).status).toBe(400);
    expect((await c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o" })).status).toBe(400); // no key saved yet
  });
  it("tests the key with a real call and reports a rejected key plainly", async () => {
    const { c } = await signedUp(p);
    await c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o", apiKey: "good-key-123456" });
    expect((await c.call("POST", "/v1/ai/test")).body).toMatchObject({ ok: true });
    await c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o", apiKey: "bad-key-123456" });
    const bad = (await c.call("POST", "/v1/ai/test")).body;
    expect(bad.ok).toBe(false);
    expect(bad.error).toContain("401");
    expect((await c.call("GET", "/v1/ai")).body.key.test).toMatchObject({ ok: false });
  });
  it("generates with the user's key (their provider URL + key), records usage, and surfaces provider errors", async () => {
    const { c } = await signedUp(p);
    await c.call("PUT", "/v1/ai", { provider: "openrouter", model: "some/model", apiKey: "or-good-key-9999" });
    calls.length = 0;
    const r = await c.call("POST", "/v1/apps", { prompt: "coffee shop" });
    expect(r.status).toBe(201);
    expect(calls[0]).toMatchObject({ url: "https://openrouter.ai/api/v1/chat/completions", auth: "Bearer or-good-key-9999" });
    expect(calls[0]!.body.model).toBe("some/model");
    const usage = (await c.call("GET", "/v1/ai")).body.usage30d;
    expect(usage[0]).toMatchObject({ source: "user", calls: 1, input: 100, output: 50 });
    // a rejected key becomes a clear 502, not a generic 500
    await c.call("PUT", "/v1/ai", { provider: "openrouter", model: "some/model", apiKey: "bad-key-123456" });
    const fail = await c.call("POST", "/v1/apps", { prompt: "coffee shop" });
    expect(fail.status).toBe(502);
    expect(fail.body.error).toContain("OpenRouter");
  });
  it("keeps each workspace's key private and removes it on delete", async () => {
    const a = await signedUp(p); const b = await signedUp(p);
    await a.c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o", apiKey: "a-private-key-0001" });
    expect((await b.c.call("GET", "/v1/ai")).body.key).toBeNull();
    expect((await b.c.call("POST", "/v1/ai/test")).status).toBe(400);
    expect((await a.c.call("DELETE", "/v1/ai")).status).toBe(200);
    expect((await a.c.call("GET", "/v1/ai")).body.active).toBe("mock");
  });
  it("is unavailable (not insecure) when the server has no secret", async () => {
    const q = await newPlatform({ sealer: null });
    const { c } = await signedUp(q);
    expect((await c.call("GET", "/v1/ai")).body.keysAvailable).toBe(false);
    expect((await c.call("PUT", "/v1/ai", { provider: "openai", model: "gpt-4o", apiKey: "a-private-key-0001" })).status).toBe(503);
    await q.close();
  });
});

describe("operator console", () => {
  async function operatorClient(verify: boolean): Promise<Client> {
    const c = client(p, `10.9.5.${verify ? 1 : 2}`);
    const email = "boss@example.com";
    const existing = (await p.deps.db.system("select id from users where email=$1", [email])).rows[0];
    if (!existing) await c.call("POST", "/v1/auth/signup", { email, password: "correct horse battery" });
    else await c.call("POST", "/v1/auth/login", { email, password: "correct horse battery" });
    if (verify) await c.call("POST", "/v1/auth/verify", { token: tokenIn(lastTo(email).text) });
    return c;
  }
  it("is invisible to everyone but verified operators", async () => {
    const { c } = await signedUp(p);
    expect((await c.call("GET", "/v1/operator/overview")).status).toBe(404);
    const squatter = await operatorClient(false); // owns the address's account but has not proven the mailbox
    expect((await squatter.call("GET", "/v1/operator/overview")).status).toBe(404);
    const op = await operatorClient(true);
    const o = await op.call("GET", "/v1/operator/overview");
    expect(o.status).toBe(200);
    expect(o.body.totals.users).toBeGreaterThan(0);
    expect((await op.call("GET", "/v1/me")).body.user.operator).toBe(true);
  });
  it("blocks a user: sessions end and login is refused", async () => {
    const victim = await signedUp(p);
    const op = await operatorClient(true);
    const id = (await p.deps.db.system("select id from users where email=$1", [victim.email])).rows[0]!.id;
    expect((await op.call("POST", `/v1/operator/users/${id}/block`, { blocked: true })).status).toBe(200);
    expect((await victim.c.call("GET", "/v1/me")).body.user).toBeNull();
    expect((await client(p, "10.9.6.1").call("POST", "/v1/auth/login", { email: victim.email, password: "correct horse battery" })).status).toBe(403);
    await op.call("POST", `/v1/operator/users/${id}/block`, { blocked: false });
    expect((await client(p, "10.9.6.2").call("POST", "/v1/auth/login", { email: victim.email, password: "correct horse battery" })).status).toBe(200);
  });
});
