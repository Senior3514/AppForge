import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, newPlatform, signedUp, stripeSig, testAdapters } from "./testkit";
import { StripeBilling } from "./adapters/billing";
import { StripePayments, verifyStripeSignature } from "./adapters/payments";
import type { Platform } from "./platform";

let p: Platform;
beforeAll(async () => { p = await newPlatform(); });
afterAll(() => p.close());

/** A published app of the given kind, owned by a fresh paid-up account. */
async function publishedApp(prompt: string) {
  const u = await signedUp(p);
  await u.c.call("POST", "/v1/billing/checkout", { plan: "pro" });
  const app = (await u.c.call("POST", "/v1/apps", { prompt })).body;
  await u.c.call("POST", `/v1/apps/${app.id}/publish`);
  return { ...u, app };
}

describe("sharing & publishing", () => {
  it("share link exposes the live draft; revoking closes it", async () => {
    const { c, app } = await publishedApp("cafe");
    const { token } = (await c.call("POST", `/v1/apps/${app.id}/share`)).body;
    const anon = client(p, "10.6.0.1");
    expect((await anon.call("GET", `/v1/public/preview/${token}`)).body.spec.name).toBe(app.spec.name);
    await c.call("POST", `/v1/apps/${app.id}/edit`, { label: "r", ops: [{ op: "replace", path: "/name", value: "Draft Rename" }] });
    expect((await anon.call("GET", `/v1/public/preview/${token}`)).body.spec.name).toBe("Draft Rename");
    await c.call("DELETE", `/v1/apps/${app.id}/share`);
    expect((await anon.call("GET", `/v1/public/preview/${token}`)).status).toBe(404);
  });

  it("the published snapshot does not change when the draft is edited until republished", async () => {
    const { c, app } = await publishedApp("cafe");
    const anon = client(p, "10.6.0.2");
    const before = (await anon.call("GET", `/v1/public/apps/${app.id}`)).body.spec.name;
    await c.call("POST", `/v1/apps/${app.id}/edit`, { label: "r", ops: [{ op: "replace", path: "/name", value: "Not Yet Live" }] });
    expect((await anon.call("GET", `/v1/public/apps/${app.id}`)).body.spec.name).toBe(before);
    await c.call("POST", `/v1/apps/${app.id}/publish`);
    expect((await anon.call("GET", `/v1/public/apps/${app.id}`)).body.spec.name).toBe("Not Yet Live");
    await c.call("POST", `/v1/apps/${app.id}/unpublish`);
    expect((await anon.call("GET", `/v1/public/apps/${app.id}`)).status).toBe(404);
  });

  it("unpublished and malformed ids are 404", async () => {
    const u = await signedUp(p);
    const app = (await u.c.call("POST", "/v1/apps", { prompt: "cafe" })).body;
    const anon = client(p, "10.6.0.3");
    expect((await anon.call("GET", `/v1/public/apps/${app.id}`)).status).toBe(404);
    expect((await anon.call("GET", "/v1/public/apps/not-a-uuid")).status).toBe(404);
  });

  it("checklist separates what we do from what the user must own", async () => {
    const { c, app } = await publishedApp("online store for my products");
    const items = (await c.call("GET", `/v1/apps/${app.id}/publish/checklist`)).body.items;
    const by = Object.fromEntries(items.map((i: any) => [i.id, i]));
    expect(by.apple_account).toMatchObject({ owner: "you", status: "todo" });
    expect(by.google_account).toMatchObject({ owner: "you", status: "todo" });
    expect(by.plan.status).toBe("done");
    expect(by.web_publish.status).toBe("done");
    expect(by.payments).toMatchObject({ owner: "you", status: "todo" }); // a shop needs Stripe
  });
});

describe("end-user data, events, devices", () => {
  it("accepts a valid booking, stores it per tenant, admin reads and exports it", async () => {
    const { c, app } = await publishedApp("salon booking app");
    const anon = client(p, "10.6.1.1");
    const r = await anon.call("POST", `/v1/public/apps/${app.id}/data/bookings`, { data: { name: "Dana", phone: "+972 50 123 4567" } });
    expect(r.status).toBe(201);
    const rows = (await c.call("GET", `/v1/apps/${app.id}/data/bookings`)).body.rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toEqual({ name: "Dana", phone: "+972 50 123 4567" });
    const csv = await c.call("GET", `/v1/apps/${app.id}/data/bookings?format=csv`);
    expect(csv.headers.get("content-type")).toMatch(/text\/csv/);
    expect(csv.body).toContain("Dana");
    expect((await c.call("DELETE", `/v1/apps/${app.id}/data/bookings/${rows[0].id}`)).status).toBe(200);
    expect((await c.call("GET", `/v1/apps/${app.id}/data/bookings`)).body.rows).toHaveLength(0);
  });

  it("CSV export neutralises spreadsheet formulas", async () => {
    const { c, app } = await publishedApp("salon booking app");
    await client(p, "10.6.1.2").call("POST", `/v1/public/apps/${app.id}/data/bookings`, { data: { name: "=HYPERLINK(\"http://evil\")" } });
    const csv = (await c.call("GET", `/v1/apps/${app.id}/data/bookings?format=csv`)).body as string;
    expect(csv).toContain(`"'=HYPERLINK`);
  });

  it("rejects unknown/read-only collections, bad values, unknown fields and oversize bodies", async () => {
    const { app } = await publishedApp("salon booking app");
    const anon = client(p, "10.6.1.3");
    const post = (col: string, data: unknown) => anon.call("POST", `/v1/public/apps/${app.id}/data/${col}`, { data });
    expect((await post("services", { name: "x" })).status).toBe(404); // read-only list
    expect((await post("nope", { name: "x" })).status).toBe(404);
    expect((await post("bookings", { phone: "not a phone!!" })).status).toBe(400);
    expect((await post("bookings", { name: "x".repeat(501) })).status).toBe(400);
    expect((await post("bookings", { unknown: "x" })).status).toBe(400); // no known fields → nothing to store
    expect((await anon.call("POST", `/v1/public/apps/${app.id}/data/bookings`, { data: { name: "x".repeat(9000) } })).status).toBe(413);
  });

  it("rate limits public submissions per IP", async () => {
    const { app } = await publishedApp("salon booking app");
    const anon = client(p, "10.6.1.4");
    const codes: number[] = [];
    for (let i = 0; i < 35; i++) codes.push((await anon.call("POST", `/v1/public/apps/${app.id}/data/bookings`, { data: { name: `n${i}` } })).status);
    expect(codes.filter((x) => x === 201)).toHaveLength(30);
    expect(codes).toContain(429);
  });

  it("does not let one tenant's app receive data for another's id", async () => {
    const a = await publishedApp("salon booking app");
    const b = await publishedApp("salon booking app");
    await client(p, "10.6.1.5").call("POST", `/v1/public/apps/${a.app.id}/data/bookings`, { data: { name: "for A" } });
    expect((await b.c.call("GET", `/v1/apps/${b.app.id}/data/bookings`)).body.rows).toHaveLength(0);
    expect((await b.c.call("GET", `/v1/apps/${a.app.id}/data/bookings`)).status).toBe(404);
  });

  it("analytics: DAU/MAU, screen views, retention", async () => {
    const { c, app } = await publishedApp("cafe");
    const anon = client(p, "10.6.2.1");
    const send = (deviceId: string, events: any[]) => anon.call("POST", `/v1/public/apps/${app.id}/events`, { deviceId, events });
    expect((await send("device-aaaaaaaa", [{ name: "screen_view", screen: "home" }, { name: "screen_view", screen: "menu" }])).status).toBe(202);
    await send("device-bbbbbbbb", [{ name: "screen_view", screen: "home" }]);
    // Backdate one of device A's events so it counts as a second day.
    await p.deps.db.system("update events set at = at - interval '1 day' where device_id='device-aaaaaaaa' and screen='menu'");
    const a = (await c.call("GET", `/v1/apps/${app.id}/analytics?days=7`)).body;
    expect(a.mau).toBe(2);
    expect(a.screens[0]).toEqual({ screen: "home", views: 2 });
    expect(a.dau.length).toBe(2);
    expect(a.retention).toMatchObject({ devices: 2, returning: 1 });
    expect((await send("short", [{ name: "x" }])).status).toBe(400);
    expect((await send("device-cccccccc", [{ name: "Bad Name!" }])).status).toBe(400);
  });
});

describe("push", () => {
  it("campaigns send on schedule through the provider; future ones wait", async () => {
    const { c, app } = await publishedApp("cafe");
    const anon = client(p, "10.6.3.1");
    await anon.call("POST", `/v1/public/apps/${app.id}/devices`, { token: "ExponentPushToken[aaaaaaaaaaaa]", platform: "ios" });
    await anon.call("POST", `/v1/public/apps/${app.id}/devices`, { token: "ExponentPushToken[aaaaaaaaaaaa]", platform: "ios" }); // idempotent
    await anon.call("POST", `/v1/public/apps/${app.id}/devices`, { token: "ExponentPushToken[bbbbbbbbbbbb]", platform: "android" });
    const future = new Date(Date.now() + 3_600_000).toISOString();
    const now = await c.call("POST", `/v1/apps/${app.id}/push`, { title: "Hello", body: "Fresh croissants" });
    const later = await c.call("POST", `/v1/apps/${app.id}/push`, { title: "Later", body: "Tonight", sendAt: future });
    expect([now.status, later.status]).toEqual([201, 201]);

    await p.tick();
    const push = (await c.call("GET", `/v1/apps/${app.id}/push`)).body;
    expect(push.devices).toBe(2);
    const byTitle = Object.fromEntries(push.campaigns.map((x: any) => [x.title, x]));
    expect(byTitle.Hello).toMatchObject({ status: "sent", sentCount: 2 });
    expect(byTitle.Later.status).toBe("scheduled");
    expect(await p.tick()).toBe(0); // nothing is sent twice
    expect((await c.call("DELETE", `/v1/apps/${app.id}/push/${byTitle.Later.id}`)).status).toBe(200);
    expect((await c.call("DELETE", `/v1/apps/${app.id}/push/${byTitle.Hello.id}`)).status).toBe(404); // already sent
    expect((await c.call("POST", `/v1/apps/${app.id}/push`, { title: "", body: "x" })).status).toBe(400);
  });

  it("a provider failure marks the campaign failed instead of crashing the scheduler", async () => {
    const adapters = testAdapters();
    adapters.push.send = async () => { throw new Error("provider down"); };
    const q = await newPlatform({ adapters });
    const u = await signedUp(q);
    await u.c.call("POST", "/v1/billing/checkout", { plan: "pro" });
    const app = (await u.c.call("POST", "/v1/apps", { prompt: "cafe" })).body;
    await u.c.call("POST", `/v1/apps/${app.id}/push`, { title: "T", body: "B" });
    await q.tick();
    expect((await u.c.call("GET", `/v1/apps/${app.id}/push`)).body.campaigns[0]).toMatchObject({ status: "failed", error: "provider down" });
    await q.close();
  });
});

describe("payments", () => {
  it("prices come from the spec, never the client; mock checkout settles an order", async () => {
    const { c, app } = await publishedApp("online store for my products");
    const anon = client(p, "10.6.4.1");
    const res = await anon.call("POST", `/v1/public/apps/${app.id}/checkout`, { items: [{ name: "Classic tee", qty: 2 }, { name: "Canvas bag", qty: 1 }], price: 1, totalCents: 1 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ totalCents: 2 * 2400 + 1800, currency: "USD" });
    const ref = new URL(res.body.url).pathname.split("/").pop()!;
    expect((await c.call("GET", `/v1/apps/${app.id}/orders`)).body.orders[0]).toMatchObject({ status: "pending", totalCents: 6600 });
    expect((await anon.call("POST", `/v1/public/mock-pay/${ref}`)).status).toBe(200);
    expect((await anon.call("POST", `/v1/public/mock-pay/${ref}`)).status).toBe(404); // already settled
    expect((await c.call("GET", `/v1/apps/${app.id}/orders`)).body.orders[0].status).toBe("paid");
    expect((await c.call("GET", `/v1/apps/${app.id}/analytics`)).body.orders).toEqual({ paid: 1, revenueCents: 6600 });
  });

  it("rejects unknown items, bad quantities and apps without a catalog", async () => {
    const shop = await publishedApp("online store for my products");
    const cafe = await publishedApp("salon booking app");
    const anon = client(p, "10.6.4.2");
    const co = (id: string, items: unknown) => anon.call("POST", `/v1/public/apps/${id}/checkout`, { items });
    expect((await co(shop.app.id, [{ name: "Nonexistent", qty: 1 }])).status).toBe(400);
    expect((await co(shop.app.id, [{ name: "Classic tee", qty: 0 }])).status).toBe(400);
    expect((await co(shop.app.id, [{ name: "Classic tee", qty: 1000 }])).status).toBe(400);
    expect((await co(shop.app.id, [])).status).toBe(400);
    expect((await co(cafe.app.id, [{ name: "Haircut", qty: 1 }])).status).toBe(404);
  });

  it("stripe: Connect checkout is created on the tenant's account; webhook needs a valid signature", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json(url.endsWith("checkout/sessions") ? { id: "cs_test_1", url: "https://checkout.stripe.test/s" } : url.endsWith("/accounts") ? { id: "acct_123" } : { url: "https://connect.stripe.test/onboard" });
    }) as unknown as typeof fetch;
    const secret = "whsec_test";
    const adapters = { ...testAdapters(), payments: new StripePayments({ secretKey: "sk_test", webhookSecret: secret, fetchImpl }) };
    const q = await newPlatform({ adapters });
    const u = await signedUp(q);
    await u.c.call("POST", "/v1/billing/checkout", { plan: "pro" });
    const app = (await u.c.call("POST", "/v1/apps", { prompt: "online store for my products" })).body;
    await u.c.call("POST", `/v1/apps/${app.id}/publish`);
    const anon = client(q, "10.6.4.3");

    // Not connected yet → the shop refuses instead of taking money to the platform.
    expect((await anon.call("POST", `/v1/public/apps/${app.id}/checkout`, { items: [{ name: "Classic tee", qty: 1 }] })).status).toBe(502);

    expect((await u.c.call("POST", "/v1/payments/connect")).body).toMatchObject({ url: "https://connect.stripe.test/onboard", provider: "stripe" });
    const ok = await anon.call("POST", `/v1/public/apps/${app.id}/checkout`, { items: [{ name: "Classic tee", qty: 1 }] });
    expect(ok.body.url).toBe("https://checkout.stripe.test/s");
    const sessionCall = calls.find((x) => x.url.endsWith("checkout/sessions"))!;
    expect((sessionCall.init.headers as Record<string, string>)["stripe-account"]).toBe("acct_123");
    expect(String(sessionCall.init.body)).toContain("unit_amount%5D=2400");

    const raw = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_test_1" } } });
    expect((await anon.call("POST", "/v1/webhooks/payments", raw, { "stripe-signature": "t=1,v1=deadbeef" })).status).toBe(400);
    expect((await anon.call("POST", "/v1/webhooks/payments", raw)).status).toBe(400);
    expect((await u.c.call("GET", `/v1/apps/${app.id}/orders`)).body.orders[0].status).toBe("pending");
    expect((await anon.call("POST", "/v1/webhooks/payments", raw, { "stripe-signature": stripeSig(raw, secret) })).status).toBe(200);
    expect((await u.c.call("GET", `/v1/apps/${app.id}/orders`)).body.orders[0].status).toBe("paid");
    // A stale but correctly signed event (replay) is rejected.
    expect((await anon.call("POST", "/v1/webhooks/payments", raw, { "stripe-signature": stripeSig(raw, secret, 1000) })).status).toBe(400);
    await q.close();
  });

  it("signature verification: tamper, wrong secret, replay window", () => {
    const raw = '{"a":1}'; const t = 1_700_000_000;
    const now = () => t * 1000;
    expect(verifyStripeSignature(raw, stripeSig(raw, "s", t), "s", now)).toBe(true);
    expect(verifyStripeSignature(raw + " ", stripeSig(raw, "s", t), "s", now)).toBe(false);
    expect(verifyStripeSignature(raw, stripeSig(raw, "other", t), "s", now)).toBe(false);
    expect(verifyStripeSignature(raw, stripeSig(raw, "s", t), "s", () => (t + 301) * 1000)).toBe(false);
    expect(verifyStripeSignature(raw, null, "s", now)).toBe(false);
  });
});

describe("platform billing", () => {
  it("stripe billing webhook updates the plan; cancel drops entitlements but keeps data", async () => {
    const secret = "whsec_billing";
    const adapters = { ...testAdapters(), billing: new StripeBilling({ secretKey: "sk", webhookSecret: secret, prices: { starter: "p1", pro: "p2", business: "p3" } }) };
    const q = await newPlatform({ adapters });
    const u = await signedUp(q);
    const me0 = (await u.c.call("GET", "/v1/me")).body;
    const tenantId = (await q.deps.db.system("select tenant_id from users where email=$1", [u.email])).rows[0]!.tenant_id;
    const hook = (type: string, status: string) => {
      const raw = JSON.stringify({ type, data: { object: { status, customer: "cus_1", metadata: { tenant_id: tenantId, plan: "pro" } } } });
      return u.c.call("POST", "/v1/webhooks/billing", raw, { "stripe-signature": stripeSig(raw, secret) });
    };
    expect(me0.tenant.plan).toBe("free");
    expect((await hook("customer.subscription.created", "trialing")).status).toBe(200);
    expect((await u.c.call("GET", "/v1/me")).body.tenant).toMatchObject({ plan: "pro", status: "trialing", effectivePlan: "pro" });
    await u.c.call("POST", "/v1/apps", { prompt: "cafe" });
    await u.c.call("POST", "/v1/apps", { prompt: "salon" });
    await hook("customer.subscription.updated", "past_due");
    const me = (await u.c.call("GET", "/v1/me")).body;
    expect(me.tenant.effectivePlan).toBe("free");
    expect((await u.c.call("GET", "/v1/apps")).body.apps).toHaveLength(2); // data kept
    expect((await u.c.call("POST", "/v1/apps", { prompt: "gym" })).status).toBe(402);
    const bad = await u.c.call("POST", "/v1/webhooks/billing", "{}", { "stripe-signature": "t=1,v1=00" });
    expect(bad.status).toBe(400);
    await q.close();
  });

  it("anonymous users must sign up to subscribe; unknown plans are rejected", async () => {
    const c = client(p, "10.6.5.1");
    await c.call("POST", "/v1/apps", { prompt: "cafe" });
    expect((await c.call("POST", "/v1/billing/checkout", { plan: "pro" })).status).toBe(403);
    const u = await signedUp(p);
    expect((await u.c.call("POST", "/v1/billing/checkout", { plan: "free" })).status).toBe(400);
    expect((await u.c.call("POST", "/v1/billing/checkout", { plan: "enterprise" })).status).toBe(400);
    expect((await client(p).call("GET", "/v1/billing/plans")).body.trialDays).toBe(7);
  });
});
