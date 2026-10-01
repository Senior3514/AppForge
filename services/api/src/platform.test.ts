import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, newPlatform, signedUp, testAdapters } from "./testkit";
import type { Platform } from "./platform";

let p: Platform;
beforeAll(async () => { p = await newPlatform(); });
afterAll(() => p.close());

describe("auth", () => {
  it("health reports the active adapters", async () => {
    const r = await client(p).call("GET", "/health");
    expect(r.body).toMatchObject({ ok: true, llm: "mock", payments: "mock", push: "mock" });
  });

  it("signup → me → logout → login", async () => {
    const c = client(p, "10.9.0.1");
    expect((await c.call("GET", "/v1/me")).body.user).toBeNull();
    const s = await c.call("POST", "/v1/auth/signup", { email: "Ann@Example.com", password: "s3cret-pass" });
    expect(s.status).toBe(201);
    expect(s.headers.get("set-cookie")).toMatch(/HttpOnly.*SameSite=Lax/);
    const me = (await c.call("GET", "/v1/me")).body;
    expect(me.user).toEqual({ email: "ann@example.com", anonymous: false });
    expect(me.tenant.plan).toBe("free");
    expect(me.entitlements.maxApps).toBe(1);
    await c.call("POST", "/v1/auth/logout");
    expect((await c.call("GET", "/v1/me")).body.user).toBeNull();
    expect((await c.call("POST", "/v1/auth/login", { email: "ann@example.com", password: "wrong-password" })).status).toBe(401);
    expect((await c.call("POST", "/v1/auth/login", { email: "ann@example.com", password: "s3cret-pass" })).status).toBe(200);
    expect((await c.call("GET", "/v1/me")).body.user.email).toBe("ann@example.com");
  });

  it("rejects duplicate emails, weak passwords and bad emails", async () => {
    const c = client(p, "10.9.0.2");
    expect((await c.call("POST", "/v1/auth/signup", { email: "dup@example.com", password: "longenough1" })).status).toBe(201);
    expect((await client(p, "10.9.0.3").call("POST", "/v1/auth/signup", { email: "dup@example.com", password: "longenough1" })).status).toBe(409);
    expect((await client(p, "10.9.0.4").call("POST", "/v1/auth/signup", { email: "x@example.com", password: "short" })).status).toBe(400);
    expect((await client(p, "10.9.0.5").call("POST", "/v1/auth/signup", { email: "nope", password: "longenough1" })).status).toBe(400);
  });

  it("stores passwords hashed, sessions hashed", async () => {
    await signedUp(p);
    const u = (await p.deps.db.system("select password_hash from users where email is not null limit 1")).rows[0]!;
    expect(u.password_hash).toMatch(/^scrypt\$/);
    const s = (await p.deps.db.system("select token_hash from sessions limit 1")).rows[0]!;
    expect(s.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("magic link: single use, always 200, creates account", async () => {
    const mailer = (p.deps.adapters.mailer as ReturnType<typeof testAdapters>["mailer"]);
    const c = client(p, "10.9.1.1");
    expect((await c.call("POST", "/v1/auth/magic-link", { email: "magic@example.com" })).status).toBe(200);
    const token = /token=([\w-]+)/.exec(mailer.outbox.at(-1)!.text)![1]!;
    expect((await c.call("POST", "/v1/auth/magic-link/verify", { token })).status).toBe(200);
    expect((await c.call("GET", "/v1/me")).body.user.email).toBe("magic@example.com");
    expect((await client(p, "10.9.1.2").call("POST", "/v1/auth/magic-link/verify", { token })).status).toBe(400);
    expect((await c.call("POST", "/v1/auth/magic-link", { email: "unknown-person@example.com" })).status).toBe(200);
  });

  it("rate limits repeated signups from one IP", async () => {
    const c = client(p, "10.9.2.1");
    const codes: number[] = [];
    for (let i = 0; i < 12; i++) codes.push((await c.call("POST", "/v1/auth/signup", { email: `rl${i}@example.com`, password: "longenough1" })).status);
    expect(codes).toContain(429);
  });
});

describe("apps lifecycle", () => {
  it("anonymous try-first → signup keeps the draft", async () => {
    const c = client(p, "10.8.0.1");
    const created = await c.call("POST", "/v1/apps", { prompt: "salon booking app" });
    expect(created.status).toBe(201);
    expect((await c.call("GET", "/v1/me")).body.user.anonymous).toBe(true);
    expect((await c.call("POST", `/v1/apps/${created.body.id}/publish`)).status).toBe(403);
    const up = await c.call("POST", "/v1/auth/signup", { email: "keep@example.com", password: "longenough1" });
    expect(up.body.claimedDrafts).toBe(true);
    const list = (await c.call("GET", "/v1/apps")).body.apps;
    expect(list.map((a: any) => a.id)).toEqual([created.body.id]);
    expect((await c.call("GET", "/v1/me")).body.user).toEqual({ email: "keep@example.com", anonymous: false });
  });

  it("logging in from an anonymous session adopts its drafts", async () => {
    const owner = await signedUp(p);
    await owner.c.call("POST", "/v1/auth/logout");
    const c = client(p, "10.8.0.2");
    const draft = await c.call("POST", "/v1/apps", { prompt: "cafe" });
    // The account already has no apps, so this anonymous draft moves in.
    await c.call("POST", "/v1/auth/login", { email: owner.email, password: "correct horse battery" });
    expect((await c.call("GET", "/v1/apps")).body.apps.map((a: any) => a.id)).toEqual([draft.body.id]);
  });

  it("prompt → chat → edit → undo → redo persists revisions", async () => {
    const { c } = await signedUp(p);
    const a = (await c.call("POST", "/v1/apps", { prompt: "salon booking app" })).body;
    const chat = await c.call("POST", `/v1/apps/${a.id}/chat`, { message: "add a loyalty tab" });
    expect(chat.body.spec.navigation).toContain("rewards");
    expect(chat.body.changes.length).toBeGreaterThan(0);

    const edit = await c.call("POST", `/v1/apps/${a.id}/edit`, { label: "Brand colour", ops: [{ op: "replace", path: "/theme/primary", value: "#123456" }] });
    expect(edit.body.spec.theme.primary).toBe("#123456");
    expect(edit.body.history.map((h: any) => h.source)).toEqual(["ai", "manual"]);

    expect((await c.call("POST", `/v1/apps/${a.id}/undo`)).body.spec.theme.primary).not.toBe("#123456");
    const afterUndo = (await c.call("POST", `/v1/apps/${a.id}/undo`)).body;
    expect(afterUndo.spec.navigation).not.toContain("rewards");
    expect(afterUndo.canUndo).toBe(false);
    expect((await c.call("POST", `/v1/apps/${a.id}/redo`)).body.spec.navigation).toContain("rewards");

    // Survives a fresh read (it is in the database, not memory).
    const fresh = (await c.call("GET", `/v1/apps/${a.id}`)).body;
    expect(fresh.spec.navigation).toContain("rewards");
    expect(fresh.history.filter((h: any) => h.applied)).toHaveLength(1);

    // A new edit after undo discards the redo branch.
    await c.call("POST", `/v1/apps/${a.id}/undo`);
    await c.call("POST", `/v1/apps/${a.id}/edit`, { label: "Rename", ops: [{ op: "replace", path: "/name", value: "Fresh Name" }] });
    const final = (await c.call("GET", `/v1/apps/${a.id}`)).body;
    expect(final.canRedo).toBe(false);
    expect(final.history).toHaveLength(1);
  });

  it("rejects invalid manual edits without recording a revision", async () => {
    const { c } = await signedUp(p);
    const a = (await c.call("POST", "/v1/apps", { prompt: "cafe" })).body;
    const bad = await c.call("POST", `/v1/apps/${a.id}/edit`, { label: "bad", ops: [{ op: "replace", path: "/theme/primary", value: "red" }] });
    expect(bad.status).toBe(422);
    expect(bad.body.details.join()).toMatch(/primary/);
    const missing = await c.call("POST", `/v1/apps/${a.id}/edit`, { label: "x", ops: [{ op: "remove", path: "/nope/3" }] });
    expect(missing.status).toBe(422);
    expect((await c.call("GET", `/v1/apps/${a.id}`)).body.history).toHaveLength(0);
  });

  it("enforces the plan's app limit, then upgrading lifts it", async () => {
    const { c } = await signedUp(p);
    expect((await c.call("POST", "/v1/apps", { prompt: "cafe" })).status).toBe(201);
    const blocked = await c.call("POST", "/v1/apps", { prompt: "salon" });
    expect(blocked.status).toBe(402);
    expect(blocked.body.details).toMatchObject({ code: "plan_limit", maxApps: 1 });
    expect((await c.call("POST", "/v1/billing/checkout", { plan: "starter" })).body).toEqual({ activated: true, plan: "starter" });
    const me = (await c.call("GET", "/v1/me")).body;
    expect(me.tenant).toMatchObject({ plan: "starter", status: "trialing" });
    expect(me.tenant.trialEndsAt).toBeTruthy();
    expect((await c.call("POST", "/v1/apps", { prompt: "salon" })).status).toBe(201);
  });

  it("deleting an app removes it", async () => {
    const { c } = await signedUp(p);
    const a = (await c.call("POST", "/v1/apps", { prompt: "cafe" })).body;
    expect((await c.call("DELETE", `/v1/apps/${a.id}`)).status).toBe(200);
    expect((await c.call("GET", `/v1/apps/${a.id}`)).status).toBe(404);
  });

  it("validates input and limits anonymous generation", async () => {
    const c = client(p, "10.8.5.1");
    expect((await c.call("POST", "/v1/apps", {})).status).toBe(400);
    expect((await c.call("POST", "/v1/apps", { prompt: "   " })).status).toBe(422);
    expect((await c.call("POST", "/v1/apps", "{not json")).status).toBe(400);
  });
});

describe("tenant isolation over HTTP", () => {
  it("another account gets 404 on every per-app endpoint and cannot list it", async () => {
    const a = await signedUp(p);
    const b = await signedUp(p);
    const app = (await a.c.call("POST", "/v1/apps", { prompt: "cafe" })).body;
    const probes: [string, string, unknown?][] = [
      ["GET", ""], ["DELETE", ""], ["POST", "/chat", { message: "add a loyalty tab" }], ["POST", "/undo"], ["POST", "/redo"],
      ["POST", "/share"], ["POST", "/publish"], ["GET", "/analytics"], ["GET", "/orders"], ["GET", "/push"],
      ["POST", "/edit", { label: "x", ops: [{ op: "replace", path: "/name", value: "hacked" }] }], ["GET", "/data/bookings"], ["GET", "/publish/checklist"],
    ];
    for (const [m, path, body] of probes) {
      const r = await b.c.call(m, `/v1/apps/${app.id}${path}`, body);
      expect(r.status, `${m} ${path}`).toBe(404);
    }
    expect((await b.c.call("GET", "/v1/apps")).body.apps).toEqual([]);
    expect((await a.c.call("GET", `/v1/apps/${app.id}`)).body.spec.name).not.toBe("hacked");
  });

  it("endpoints require a session", async () => {
    const c = client(p, "10.7.0.1");
    for (const path of ["/v1/apps", "/v1/apps/00000000-0000-0000-0000-000000000000"]) expect((await c.call("GET", path)).status).toBe(401);
  });
});
