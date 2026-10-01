import { z } from "zod";
import { requireSession, type Session } from "../auth";
import type { Deps } from "../deps";
import { HttpError, json, type Router } from "../http";

/** Operator console: for the people running this deployment, listed in APPFORGE_OPERATOR_EMAILS. */
export function operatorRoutes(r: Router, d: Deps) {
  const operator = async (c: Parameters<typeof requireSession>[1]): Promise<Session> => {
    const s = await requireSession(d.db, c);
    // Verified email is required so nobody can gain access by signing up with an operator's address first.
    if (!s.email || !s.verified || !d.operatorEmails.has(s.email)) throw new HttpError(404, "Not found");
    return s;
  };

  r.get("/v1/operator/overview", async (c) => {
    await operator(c);
    const one = async (sql: string) => (await d.db.system(sql)).rows[0]!;
    const totals = await one(`select
      (select count(*)::int from users where not anonymous) as users,
      (select count(*)::int from users where anonymous) as guests,
      (select count(*)::int from apps) as apps,
      (select count(*)::int from apps where published_at is not null) as published,
      (select count(*)::int from tenants where plan <> 'free') as paying,
      (select count(*)::int from ai_providers) as own_keys`);
    const ai = (await d.db.system("select source, count(*)::int as calls, coalesce(sum(cost_usd),0)::float as cost from ai_usage where at > now() - interval '30 days' group by source")).rows;
    const users = (await d.db.system(`select u.id, u.email, u.email_verified_at is not null as verified, u.blocked, u.created_at, t.plan,
      (select count(*)::int from apps a where a.tenant_id = u.tenant_id) as apps
      from users u join tenants t on t.id=u.tenant_id where not u.anonymous order by u.created_at desc limit 100`)).rows;
    return json({ totals, ai, users: users.map((u) => ({ ...u, created_at: new Date(u.created_at).toISOString() })) });
  });

  r.post("/v1/operator/users/:id/block", async (c) => {
    const s = await operator(c);
    const { blocked } = z.object({ blocked: z.boolean() }).parse(await c.body());
    if (!/^[0-9a-f-]{36}$/.test(c.params.id!)) throw new HttpError(404, "Not found");
    if (c.params.id === s.userId) throw new HttpError(400, "You cannot block yourself");
    const res = await d.db.systemTx(async (q) => {
      const u = await q("update users set blocked=$2 where id=$1 returning id", [c.params.id!, blocked]);
      if (blocked) await q("delete from sessions where user_id=$1", [c.params.id!]);
      return u;
    });
    if (!res.rows[0]) throw new HttpError(404, "Not found");
    return json({ ok: true });
  });
}
