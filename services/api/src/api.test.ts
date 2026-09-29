import { beforeEach, describe, expect, it } from "vitest";
import { MockLlm } from "@appforge/generator";
import { createApi } from "./api";

let call: (method: string, path: string, opts?: { tenant?: string | null; body?: unknown }) => Promise<{ status: number; body: any }>;
beforeEach(() => {
  const handle = createApi({ llm: new MockLlm() });
  call = async (method, path, { tenant = "t1", body } = {}) => {
    const res = await handle(new Request(`http://x${path}`, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: tenant ? { authorization: `Bearer mock:${tenant}` } : {},
    }));
    return { status: res.status, body: await res.json() };
  };
});

describe("api", () => {
  it("health is open, everything else needs auth", async () => {
    expect((await call("GET", "/health", { tenant: null })).status).toBe(200);
    expect((await call("GET", "/v1/apps", { tenant: null })).status).toBe(401);
  });

  it("prompt → app → chat iteration → undo → redo", async () => {
    const created = await call("POST", "/v1/apps", { body: { prompt: "salon booking app" } });
    expect(created.status).toBe(201);
    const id = created.body.id;
    const chat = await call("POST", `/v1/apps/${id}/chat`, { body: { message: "add a loyalty tab" } });
    expect(chat.body.spec.navigation).toContain("rewards");
    expect(chat.body.changes.length).toBeGreaterThan(0);
    expect(chat.body.history).toHaveLength(1);
    expect((await call("POST", `/v1/apps/${id}/undo`)).body.spec.navigation).not.toContain("rewards");
    expect((await call("POST", `/v1/apps/${id}/redo`)).body.spec.navigation).toContain("rewards");
  });

  it("a request that needs no change records no revision", async () => {
    const { body } = await call("POST", "/v1/apps", { body: { prompt: "cafe" } });
    const r = await call("POST", `/v1/apps/${body.id}/chat`, { body: { message: "make it nicer" } });
    expect(r.body.history).toHaveLength(0);
  });

  it("tenants cannot see or modify each other's apps (404, not 403)", async () => {
    const { body } = await call("POST", "/v1/apps", { tenant: "t1", body: { prompt: "cafe" } });
    for (const [m, p] of [["GET", ""], ["POST", "/chat"], ["POST", "/undo"]] as const)
      expect((await call(m, `/v1/apps/${body.id}${p}`, { tenant: "t2", body: m === "GET" ? undefined : { message: "x" } })).status).toBe(404);
    expect((await call("GET", "/v1/apps", { tenant: "t2" })).body.apps).toEqual([]);
    expect((await call("GET", "/v1/apps", { tenant: "t1" })).body.apps).toHaveLength(1);
  });

  it("validates input", async () => {
    expect((await call("POST", "/v1/apps", { body: {} })).status).toBe(400);
    const r = await call("POST", "/v1/apps", { body: { prompt: "   " } });
    expect(r.status).toBe(422);
  });
});
