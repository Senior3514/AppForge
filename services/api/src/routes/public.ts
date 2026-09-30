import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { AppSpec } from "@appforge/modules";
import type { Deps } from "../deps";
import { InvalidSignatureError } from "../adapters/payments";
import { HttpError, json, type Router } from "../http";
import { tenantOfApp } from "../store";

const MAX_BODY = 8 * 1024;
const MAX_ROWS_PER_COLLECTION = 10_000;

const parse = <T,>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Invalid request body", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
};

/** "$12", "12.50", "12,50 ₪" → cents. Returns null when no price can be read. */
export function priceToCents(raw: unknown): number | null {
  const m = /(\d+)(?:[.,](\d{1,2}))?/.exec(String(raw ?? ""));
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || 0);
}

type FieldType = AppSpec["dataModels"][number]["fields"][number]["type"];
function coerce(type: FieldType, v: unknown): string | number | boolean {
  const bad = () => { throw new HttpError(400, "Invalid value"); };
  switch (type) {
    case "number": return typeof v === "number" && Number.isFinite(v) ? v : bad();
    case "boolean": return typeof v === "boolean" ? v : bad();
    case "email": return typeof v === "string" && v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? v : bad();
    case "phone": return typeof v === "string" && /^[+\d][\d\s\-()]{3,28}$/.test(v) ? v : bad();
    case "date": return typeof v === "string" && !Number.isNaN(Date.parse(v)) && v.length <= 40 ? v : bad();
    case "image": return typeof v === "string" && /^https:\/\//.test(v) && v.length <= 500 ? v : bad();
    default: return typeof v === "string" && v.length <= 500 ? v : bad();
  }
}

export function publicRoutes(r: Router, d: Deps) {
  const limit = (c: { ip: string }, key: string, n: number, windowMs: number) => {
    if (!d.limiter.allow(`${key}:${c.ip}`, n, windowMs)) throw new HttpError(429, "Too many requests");
  };
  async function published(appId: string) {
    const t = await tenantOfApp(d.db, appId);
    if (!t || !t.published_spec) throw new HttpError(404, "App not found");
    return { tenantId: t.tenant_id as string, spec: t.published_spec as AppSpec, stripeAccount: t.stripe_account_id as string | null };
  }

  r.get("/v1/public/preview/:token", async (c) => {
    limit(c, "preview", 120, 60_000);
    const row = (await d.db.system("select id, name, spec from apps where preview_token=$1", [c.params.token!])).rows[0];
    if (!row) throw new HttpError(404, "This preview link is not active");
    return json({ id: row.id, name: row.name, spec: row.spec });
  });

  r.get("/v1/public/apps/:id", async (c) => {
    limit(c, "spec", 240, 60_000);
    const p = await published(c.params.id!);
    return json({ id: c.params.id, spec: p.spec });
  });

  r.post("/v1/public/apps/:id/data/:collection", async (c) => {
    limit(c, `data:${c.params.id}`, 30, 60_000);
    if ((await c.raw()).length > MAX_BODY) throw new HttpError(413, "Request too large");
    const p = await published(c.params.id!);
    const name = c.params.collection!;
    const model = p.spec.dataModels.find((m) => m.id === name);
    // Only collections a form writes to are open to the public; catalog/list collections are read-only.
    const writable = p.spec.screens.some((s) => s.blocks.some((b) => b.module === "booking" && b.props.collection === name));
    if (!model || !writable) throw new HttpError(404, "Unknown collection");
    const { data } = parse(z.object({ data: z.record(z.unknown()) }), await c.body());
    const clean: Record<string, unknown> = {};
    for (const f of model.fields) if (data[f.name] !== undefined && data[f.name] !== "") clean[f.name] = coerce(f.type, data[f.name]);
    if (Object.keys(clean).length === 0) throw new HttpError(400, "No fields provided");
    const id = await d.db.asTenant(p.tenantId, async (q) => {
      const n = Number((await q("select count(*)::int as n from app_data where app_id=$1 and collection=$2", [c.params.id!, name])).rows[0]!.n);
      if (n >= MAX_ROWS_PER_COLLECTION) throw new HttpError(409, "This collection is full");
      return (await q("insert into app_data (tenant_id, app_id, collection, data) values ($1,$2,$3,$4::jsonb) returning id", [p.tenantId, c.params.id!, name, JSON.stringify(clean)])).rows[0]!.id as string;
    });
    return json({ id }, 201);
  });

  r.post("/v1/public/apps/:id/events", async (c) => {
    limit(c, `events:${c.params.id}`, 120, 60_000);
    if ((await c.raw()).length > MAX_BODY * 4) throw new HttpError(413, "Request too large");
    const p = await published(c.params.id!);
    const body = parse(z.object({
      deviceId: z.string().min(8).max(64),
      events: z.array(z.object({ name: z.string().regex(/^[a-z0-9_.:-]{1,40}$/), screen: z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/).optional() })).min(1).max(50),
    }), await c.body());
    await d.db.asTenant(p.tenantId, async (q) => {
      for (const e of body.events)
        await q("insert into events (tenant_id, app_id, name, screen, device_id) values ($1,$2,$3,$4,$5)", [p.tenantId, c.params.id!, e.name, e.screen ?? null, body.deviceId]);
    });
    return json({ ok: true }, 202);
  });

  r.post("/v1/public/apps/:id/devices", async (c) => {
    limit(c, `devices:${c.params.id}`, 20, 60_000);
    const p = await published(c.params.id!);
    const body = parse(z.object({ token: z.string().min(10).max(200), platform: z.enum(["ios", "android", "web"]) }), await c.body());
    await d.db.asTenant(p.tenantId, (q) => q("insert into push_devices (tenant_id, app_id, token, platform) values ($1,$2,$3,$4) on conflict (app_id, token) do nothing", [p.tenantId, c.params.id!, body.token, body.platform]));
    return json({ ok: true }, 201);
  });

  // ---- payments (end-user apps) ----
  r.post("/v1/public/apps/:id/checkout", async (c) => {
    limit(c, `checkout:${c.params.id}`, 20, 60_000);
    const p = await published(c.params.id!);
    const body = parse(z.object({
      items: z.array(z.object({ name: z.string().min(1).max(200), qty: z.number().int().min(1).max(20) })).min(1).max(30),
      provider: z.enum(["stripe", "paypal"]).optional(),
    }), await c.body());

    // The client only names items; prices come from the published spec so they cannot be tampered with.
    const catalogs = p.spec.screens.flatMap((s) => s.blocks).filter((b) => b.module === "catalog");
    if (catalogs.length === 0) throw new HttpError(404, "This app does not sell anything");
    let total = 0; let currency = "USD";
    const lines: { name: string; qty: number; unitCents: number }[] = [];
    for (const it of body.items) {
      const hit = catalogs.map((b) => ({ b, row: p.spec.dataModels.find((m) => m.id === (b.props as { collection: string }).collection)?.seed.find((row) => row.name === it.name) })).find((x) => x.row);
      const cents = hit ? priceToCents(hit.row!.price) : null;
      if (!hit || cents === null) throw new HttpError(400, `Unknown item "${it.name}"`);
      currency = (hit.b.props as { currency: string }).currency;
      total += cents * it.qty;
      lines.push({ name: it.name, qty: it.qty, unitCents: cents });
    }
    if (total <= 0) throw new HttpError(400, "Order total must be greater than zero");

    const provider = body.provider === "paypal" ? d.adapters.paypal : d.adapters.payments;
    if (!provider) throw new HttpError(400, "That payment method is not enabled");
    const orderId = randomUUID();
    await d.db.asTenant(p.tenantId, (q) => q("insert into orders (id, tenant_id, app_id, items, total_cents, currency, provider) values ($1,$2,$3,$4::jsonb,$5,$6,$7)", [orderId, p.tenantId, c.params.id!, JSON.stringify(lines), total, currency, provider.name]));
    try {
      const checkout = await provider.createCheckout({
        orderId, amountCents: total, currency, description: `${p.spec.name} order`,
        successUrl: `${d.publicUrl}/${p.spec.locale}/pay/success?order=${orderId}`, cancelUrl: `${d.publicUrl}/${p.spec.locale}/pay/cancel?order=${orderId}`, locale: p.spec.locale,
        connectedAccountId: p.stripeAccount,
      });
      await d.db.asTenant(p.tenantId, (q) => q("update orders set provider_ref=$2 where id=$1", [orderId, checkout.ref]));
      return json({ orderId, url: checkout.url, totalCents: total, currency }, 201);
    } catch (e) {
      await d.db.asTenant(p.tenantId, (q) => q("update orders set status='failed' where id=$1", [orderId]));
      throw new HttpError(502, (e as Error).message.includes("not connected") ? "The shop is not ready to take payments yet" : "Could not start checkout");
    }
  });

  const setOrder = (provider: string, ref: string, status: "paid" | "failed") =>
    d.db.system("update orders set status=$3 where provider=$1 and provider_ref=$2 and status='pending'", [provider, ref, status]);

  // Only the mock provider can be completed by an unauthenticated call; real providers confirm via signed webhook / server-side capture.
  r.post("/v1/public/mock-pay/:ref", async (c) => {
    if (d.adapters.payments.name !== "mock") throw new HttpError(404, "Not found");
    const res = await setOrder("mock", c.params.ref!, "paid");
    if (!res.rowCount) throw new HttpError(404, "Order not found or already settled");
    return json({ status: "paid" });
  });

  r.post("/v1/webhooks/payments", async (c) => {
    let ev;
    try { ev = d.adapters.payments.parseWebhook(await c.raw(), c.req.headers); }
    catch (e) { if (e instanceof InvalidSignatureError) throw new HttpError(400, "Invalid signature"); throw e; }
    if (ev) await setOrder(d.adapters.payments.name, ev.ref, ev.type === "paid" ? "paid" : "failed");
    return json({ ok: true });
  });

  r.get("/v1/public/paypal/return", async (c) => {
    if (!d.adapters.paypal) throw new HttpError(404, "Not found");
    const ref = c.url.searchParams.get("token") ?? "";
    const ok = await d.adapters.paypal.capture(ref);
    await setOrder("paypal", ref, ok ? "paid" : "failed");
    return json({ status: ok ? "paid" : "failed" });
  });
}
