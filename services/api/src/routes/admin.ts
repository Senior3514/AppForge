import { z } from "zod";
import type { Deps } from "../deps";
import { requireSession } from "../auth";
import { HttpError, json, type Router } from "../http";
import { getApp } from "../store";

const parse = <T,>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Invalid request body", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
};

const csvCell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection from user-submitted data.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
};

export function adminRoutes(r: Router, d: Deps) {
  /** Confirms the app belongs to the caller's tenant before any per-app query. */
  async function owned(c: { req: Request; params: Record<string, string>; cookie(n: string): string | undefined }) {
    const s = await requireSession(d.db, c as never);
    await getApp(d.db, s.tenantId, c.params.id!);
    return s;
  }

  r.get("/v1/apps/:id/data/:collection", async (c) => {
    const s = await owned(c);
    const limit = Math.min(Number(c.url.searchParams.get("limit") ?? 50) || 50, 500);
    const offset = Math.max(Number(c.url.searchParams.get("offset") ?? 0) || 0, 0);
    const rows = (await d.db.asTenant(s.tenantId, (q) => q("select id, data, created_at from app_data where app_id=$1 and collection=$2 order by created_at desc limit $3 offset $4", [c.params.id!, c.params.collection!, limit, offset]))).rows;
    if (c.url.searchParams.get("format") === "csv") {
      const cols = [...new Set(rows.flatMap((x) => Object.keys(x.data as object)))];
      const csv = [["created_at", ...cols].map(csvCell).join(","), ...rows.map((x) => [new Date(x.created_at).toISOString(), ...cols.map((k) => (x.data as Record<string, unknown>)[k])].map(csvCell).join(","))].join("\n");
      return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${c.params.collection}.csv"` } });
    }
    return json({ rows: rows.map((x) => ({ id: x.id, data: x.data, createdAt: new Date(x.created_at).toISOString() })) });
  });

  r.delete("/v1/apps/:id/data/:collection/:rowId", async (c) => {
    const s = await owned(c);
    const res = await d.db.asTenant(s.tenantId, (q) => q("delete from app_data where id=$1 and app_id=$2 and collection=$3", [c.params.rowId!, c.params.id!, c.params.collection!]));
    if (!res.rowCount) throw new HttpError(404, "Row not found");
    return json({ ok: true });
  });

  r.get("/v1/apps/:id/analytics", async (c) => {
    const s = await owned(c);
    const days = Math.min(Math.max(Number(c.url.searchParams.get("days") ?? 30) || 30, 1), 90);
    const id = c.params.id!;
    return json(await d.db.asTenant(s.tenantId, async (q) => {
      const since = `now() - ($2 || ' days')::interval`;
      const dau = (await q(`select to_char(date_trunc('day', at), 'YYYY-MM-DD') as day, count(distinct device_id)::int as users from events where app_id=$1 and at >= ${since} group by 1 order by 1`, [id, String(days)])).rows;
      const mau = Number((await q("select count(distinct device_id)::int as n from events where app_id=$1 and at >= now() - interval '30 days'", [id])).rows[0]!.n);
      const screens = (await q(`select screen, count(*)::int as views from events where app_id=$1 and name='screen_view' and screen is not null and at >= ${since} group by screen order by views desc limit 10`, [id, String(days)])).rows;
      // "Returning" = seen on at least two different days in the window.
      const ret = (await q(`select count(*)::int as devices, count(*) filter (where d > 1)::int as returning from (select device_id, count(distinct date_trunc('day', at)) as d from events where app_id=$1 and at >= ${since} group by device_id) t`, [id, String(days)])).rows[0]!;
      const orders = (await q(`select count(*)::int as n, coalesce(sum(total_cents),0)::int as revenue from orders where app_id=$1 and status='paid' and created_at >= ${since}`, [id, String(days)])).rows[0]!;
      return {
        days, dau, mau, screens,
        retention: { devices: ret.devices, returning: ret.returning, rate: ret.devices ? ret.returning / ret.devices : 0 },
        orders: { paid: orders.n, revenueCents: orders.revenue },
      };
    }));
  });

  r.get("/v1/apps/:id/orders", async (c) => {
    const s = await owned(c);
    const rows = (await d.db.asTenant(s.tenantId, (q) => q("select id, items, total_cents, currency, status, provider, created_at from orders where app_id=$1 order by created_at desc limit 200", [c.params.id!]))).rows;
    return json({ orders: rows.map((o) => ({ id: o.id, items: o.items, totalCents: o.total_cents, currency: o.currency, status: o.status, provider: o.provider, createdAt: new Date(o.created_at).toISOString() })) });
  });

  r.get("/v1/apps/:id/push", async (c) => {
    const s = await owned(c);
    return json(await d.db.asTenant(s.tenantId, async (q) => ({
      provider: d.adapters.push.name,
      devices: Number((await q("select count(*)::int as n from push_devices where app_id=$1", [c.params.id!])).rows[0]!.n),
      campaigns: (await q("select id, title, body, send_at, status, sent_count, error from push_campaigns where app_id=$1 order by send_at desc limit 50", [c.params.id!])).rows
        .map((x) => ({ id: x.id, title: x.title, body: x.body, sendAt: new Date(x.send_at).toISOString(), status: x.status, sentCount: x.sent_count, error: x.error })),
    })));
  });

  r.post("/v1/apps/:id/push", async (c) => {
    const s = await owned(c);
    const body = parse(z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().min(1).max(180), sendAt: z.string().datetime().optional() }), await c.body());
    const sendAt = body.sendAt ? new Date(body.sendAt) : new Date();
    const row = (await d.db.asTenant(s.tenantId, (q) => q("insert into push_campaigns (tenant_id, app_id, title, body, send_at) values ($1,$2,$3,$4,$5) returning id", [s.tenantId, c.params.id!, body.title, body.body, sendAt]))).rows[0]!;
    return json({ id: row.id, sendAt: sendAt.toISOString() }, 201);
  });

  r.delete("/v1/apps/:id/push/:campaignId", async (c) => {
    const s = await owned(c);
    const res = await d.db.asTenant(s.tenantId, (q) => q("delete from push_campaigns where id=$1 and app_id=$2 and status='scheduled'", [c.params.campaignId!, c.params.id!]));
    if (!res.rowCount) throw new HttpError(404, "No scheduled campaign with that id");
    return json({ ok: true });
  });

  // Connect: each tenant is paid directly into their own Stripe account.
  r.post("/v1/payments/connect", async (c) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous) throw new HttpError(403, "Create a free account first");
    const t = (await d.db.system("select stripe_account_id from tenants where id=$1", [s.tenantId])).rows[0]!;
    const out = await d.adapters.payments.onboard({ accountId: t.stripe_account_id, returnUrl: `${d.publicUrl}/en/dashboard?connect=done`, refreshUrl: `${d.publicUrl}/en/dashboard?connect=refresh` });
    await d.db.system("update tenants set stripe_account_id=$2 where id=$1", [s.tenantId, out.accountId]);
    return json({ url: out.url, provider: d.adapters.payments.name });
  });
}
