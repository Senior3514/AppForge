import { randomUUID } from "node:crypto";
import { validateApp, type AppSpec } from "@appforge/modules";
import { applyPatchOps, diff, describeOps, type PatchOps } from "@appforge/spec";
import type { Db, Query, Row } from "./db";
import { HttpError } from "./http";
import { ENTITLEMENTS, effectivePlan, type Plan } from "./entitlements";

export interface AppView {
  id: string; name: string; spec: AppSpec; canUndo: boolean; canRedo: boolean;
  history: { seq: number; label: string; source: string; at: string; applied: boolean }[];
  publishedAt: string | null; shared: boolean; updatedAt: string;
}

const j = (v: unknown) => JSON.stringify(v);

export function checkSpec(doc: unknown): AppSpec {
  const v = validateApp(doc);
  if (!v.ok) throw new HttpError(422, "The change would produce an invalid app", v.errors);
  return v.spec;
}

async function tenantPlan(q: Query, tenantId: string): Promise<Plan> {
  const t = (await q("select plan, plan_status from tenants where id=$1", [tenantId])).rows[0]!;
  return effectivePlan(t.plan as Plan, t.plan_status);
}

export async function viewOf(q: Query, id: string): Promise<AppView | null> {
  const app = (await q("select id, name, spec, rev_cursor, published_at, preview_token, updated_at from apps where id=$1", [id])).rows[0];
  if (!app) return null;
  const revs = (await q("select seq, label, source, created_at from app_revisions where app_id=$1 order by seq", [id])).rows;
  const cursor = app.rev_cursor as number;
  return {
    id: app.id, name: app.name, spec: app.spec, canUndo: cursor > 0, canRedo: revs.some((r) => r.seq > cursor),
    history: revs.map((r) => ({ seq: r.seq, label: r.label, source: r.source, at: new Date(r.created_at).toISOString(), applied: r.seq <= cursor })),
    publishedAt: app.published_at ? new Date(app.published_at).toISOString() : null,
    shared: !!app.preview_token, updatedAt: new Date(app.updated_at).toISOString(),
  };
}

export async function createApp(db: Db, tenantId: string, spec: AppSpec): Promise<AppView> {
  return db.asTenant(tenantId, async (q) => {
    const plan = await tenantPlan(q, tenantId);
    const { maxApps } = ENTITLEMENTS[plan];
    const n = Number((await q("select count(*)::int as n from apps")).rows[0]!.n);
    if (n >= maxApps) throw new HttpError(402, `Your ${plan} plan allows ${maxApps} app${maxApps === 1 ? "" : "s"}. Upgrade to create more.`, { code: "plan_limit", plan, maxApps });
    const id = randomUUID();
    await q("insert into apps (id, tenant_id, name, spec) values ($1,$2,$3,$4::jsonb)", [id, tenantId, spec.name, j(spec)]);
    return (await viewOf(q, id))!;
  });
}

export async function getApp(db: Db, tenantId: string, id: string): Promise<AppView> {
  const v = await db.asTenant(tenantId, (q) => viewOf(q, id));
  if (!v) throw new HttpError(404, "App not found");
  return v;
}

export async function listApps(db: Db, tenantId: string) {
  const rows = (await db.asTenant(tenantId, (q) => q("select id, name, spec, published_at, updated_at from apps order by updated_at desc"))).rows;
  return rows.map((r) => ({ id: r.id as string, name: r.name as string, primary: (r.spec as AppSpec).theme.primary, locale: (r.spec as AppSpec).locale, published: !!r.published_at, updatedAt: new Date(r.updated_at).toISOString() }));
}

export async function deleteApp(db: Db, tenantId: string, id: string) {
  const r = await db.asTenant(tenantId, (q) => q("delete from apps where id=$1", [id]));
  if (!r.rowCount) throw new HttpError(404, "App not found");
}

/** Applies a patch as a new revision. Validation happens before anything is written; a no-op patch records nothing. */
export async function commit(db: Db, tenantId: string, id: string, ops: PatchOps, meta: { label: string; source: "ai" | "manual" | "system" }) {
  return db.asTenant(tenantId, async (q) => {
    const app = (await q("select spec, rev_cursor from apps where id=$1 for update", [id])).rows[0];
    if (!app) throw new HttpError(404, "App not found");
    const before = app.spec as AppSpec;
    let after: AppSpec;
    try { after = checkSpec(applyPatchOps(before, ops)); }
    catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(422, "The change could not be applied", [(e as Error).message]); }
    const patch = diff(before, after);
    if (patch.length === 0) return { view: (await viewOf(q, id))!, changes: [] as string[] };
    const cursor = app.rev_cursor as number;
    await q("delete from app_revisions where app_id=$1 and seq>$2", [id, cursor]);
    await q("insert into app_revisions (tenant_id, app_id, seq, label, source, patch, inverse) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)",
      [tenantId, id, cursor + 1, meta.label.slice(0, 120), meta.source, j(patch), j(diff(after, before))]);
    await q("update apps set spec=$2::jsonb, name=$3, rev_cursor=$4, updated_at=now() where id=$1", [id, j(after), after.name, cursor + 1]);
    return { view: (await viewOf(q, id))!, changes: describeOps(patch) };
  });
}

async function move(db: Db, tenantId: string, id: string, dir: "undo" | "redo") {
  return db.asTenant(tenantId, async (q) => {
    const app = (await q("select spec, rev_cursor from apps where id=$1 for update", [id])).rows[0];
    if (!app) throw new HttpError(404, "App not found");
    const cursor = app.rev_cursor as number;
    const target = dir === "undo" ? cursor : cursor + 1;
    const rev = target > 0 ? (await q("select patch, inverse from app_revisions where app_id=$1 and seq=$2", [id, target])).rows[0] : undefined;
    if (!rev) return (await viewOf(q, id))!; // nothing to undo/redo
    const next = checkSpec(applyPatchOps(app.spec as AppSpec, (dir === "undo" ? rev.inverse : rev.patch) as PatchOps));
    await q("update apps set spec=$2::jsonb, name=$3, rev_cursor=$4, updated_at=now() where id=$1", [id, j(next), next.name, dir === "undo" ? cursor - 1 : cursor + 1]);
    return (await viewOf(q, id))!;
  });
}
export const undo = (db: Db, t: string, id: string) => move(db, t, id, "undo");
export const redo = (db: Db, t: string, id: string) => move(db, t, id, "redo");

/** Resolves any app id to its tenant via the privileged connection; used only by unauthenticated (public) endpoints. */
export async function tenantOfApp(db: Db, appId: string): Promise<Row | null> {
  if (!/^[0-9a-f-]{36}$/.test(appId)) return null;
  return (await db.system("select a.tenant_id, a.published_spec, a.published_at, t.stripe_account_id from apps a join tenants t on t.id=a.tenant_id where a.id=$1", [appId])).rows[0] ?? null;
}
