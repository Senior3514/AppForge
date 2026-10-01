import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { newPlatform } from "./testkit";
import type { Platform } from "./platform";

const KEY = "k".repeat(32);
let p: Platform;
const call = (path: string, init: RequestInit = {}, key: string | null = KEY) =>
  p.handle(new Request(`http://api${path}`, { ...init, headers: { ...(key ? { "x-appforge-local-key": key } : {}), "content-type": "application/json", ...(init.headers ?? {}) } }));

beforeAll(async () => { p = await newPlatform({ local: { key: KEY } }); });
afterAll(() => p.close());

describe("desktop agent (local) mode", () => {
  it("needs a configured key to start", async () => {
    await expect(newPlatform({ local: undefined, env: { APPFORGE_LOCAL: "true" } })).rejects.toThrow(/APPFORGE_LOCAL_KEY/);
  });
  it("refuses every request that lacks the shared key (a web page cannot act as the owner)", async () => {
    expect((await call("/v1/me", {}, null)).status).toBe(403);
    expect((await call("/v1/me", {}, "wrong".padEnd(32, "x"))).status).toBe(403);
    expect((await call("/v1/apps", { method: "POST", body: JSON.stringify({ prompt: "coffee shop" }) }, null)).status).toBe(403);
    expect((await call("/health", {}, null)).status).toBe(200);
  });
  it("is signed in as the built-in owner with no login, on an unlimited plan", async () => {
    const me = await (await call("/v1/me")).json();
    expect(me.user).toMatchObject({ anonymous: false, verified: true });
    expect(me.server.local).toBe(true);
    expect(me.tenant.effectivePlan).toBe("business");
    expect(me.user.operator).toBe(false);
  });
  it("builds, lists and edits apps as that owner (and the same owner on the next request)", async () => {
    const created = await call("/v1/apps", { method: "POST", body: JSON.stringify({ prompt: "coffee shop" }) });
    expect(created.status).toBe(201);
    const app = await created.json();
    const list = await (await call("/v1/apps")).json();
    expect(list.apps.map((a: any) => a.id)).toContain(app.id);
    const chat = await call(`/v1/apps/${app.id}/chat`, { method: "POST", body: JSON.stringify({ message: "add a loyalty tab" }) });
    expect(chat.status).toBe(200);
  });
  it("lets the owner keep their own AI key locally", async () => {
    const put = await call("/v1/ai", { method: "PUT", body: JSON.stringify({ provider: "openrouter", model: "x/y", apiKey: "sk-or-local-1234567" }) });
    expect(put.status).toBe(200);
    expect((await (await call("/v1/ai")).json()).key.last4).toBe("4567");
  });
});
