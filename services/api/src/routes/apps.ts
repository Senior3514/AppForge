import { z } from "zod";
import { GenerationError, generateApp, iterateApp } from "@appforge/generator";
import { LOCALES } from "@appforge/i18n";
import type { AppSpec } from "@appforge/modules";
import type { PatchOps } from "@appforge/spec";
import { createTenantAndUser, issueSession, requireSession, sessionOf, type Session } from "../auth";
import { newToken } from "../crypto";
import type { Deps } from "../deps";
import { ENTITLEMENTS, effectivePlan, type Plan } from "@appforge/plans";
import { HttpError, json, type Router } from "../http";
import { commit, createApp, deleteApp, getApp, listApps, redo, undo } from "../store";

const CreateBody = z.object({ prompt: z.string(), locale: z.enum(LOCALES).optional() });
const ChatBody = z.object({ message: z.string() });
const EditBody = z.object({
  label: z.string().min(1).max(120),
  ops: z.array(z.object({ op: z.enum(["add", "remove", "replace"]), path: z.string().max(200), value: z.unknown().optional() })).min(1).max(50),
});

const parse = <T,>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Invalid request body", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
};

/** Checklist item ids are stable; the web app localises them. `owner: "you"` items cannot be done by us. */
export interface ChecklistItem { id: string; owner: "us" | "you"; status: "done" | "todo" | "blocked" }

export function appRoutes(r: Router, d: Deps) {
  const plan = async (tenantId: string): Promise<Plan> => {
    const t = (await d.db.system("select plan, plan_status from tenants where id=$1", [tenantId])).rows[0]!;
    return effectivePlan(t.plan as Plan, t.plan_status);
  };

  r.post("/v1/apps", async (c) => {
    const body = parse(CreateBody, await c.body());
    let session: Session | null = await sessionOf(d.db, c);
    let setCookie: string | undefined;
    if (!session) {
      // Try-first: no signup needed to see a preview. Rate limited because each one costs a generation.
      if (!d.limiter.allow(`anon:${c.ip}`, 5, 3_600_000)) throw new HttpError(429, "Please create a free account to keep generating apps.");
      session = await createTenantAndUser(d.db, { email: null, passwordHash: null, anonymous: true });
      setCookie = (await issueSession(d.db, session.userId, d.secureCookies)).cookie;
    }
    if (!d.limiter.allow(`gen:${session.tenantId}`, session.anonymous ? 5 : 40, 3_600_000)) throw new HttpError(429, "Generation limit reached. Try again in a while.");
    try {
      const gen = await generateApp(body.prompt, { llm: d.llm, locale: body.locale, cache: d.cache });
      const view = await createApp(d.db, session.tenantId, gen.spec);
      return json({ ...view, costUsd: gen.costUsd, cached: gen.cached }, 201, setCookie ? { "set-cookie": setCookie } : {});
    } catch (e) {
      if (e instanceof GenerationError) throw new HttpError(422, e.message, e.errors);
      throw e;
    }
  });

  r.get("/v1/apps", async (c) => json({ apps: await listApps(d.db, (await requireSession(d.db, c)).tenantId) }));
  r.get("/v1/apps/:id", async (c) => json(await getApp(d.db, (await requireSession(d.db, c)).tenantId, c.params.id!)));
  r.delete("/v1/apps/:id", async (c) => { await deleteApp(d.db, (await requireSession(d.db, c)).tenantId, c.params.id!); return json({ ok: true }); });

  r.post("/v1/apps/:id/chat", async (c) => {
    const s = await requireSession(d.db, c);
    const { message } = parse(ChatBody, await c.body());
    if (!d.limiter.allow(`chat:${s.tenantId}`, s.anonymous ? 15 : 120, 3_600_000)) throw new HttpError(429, "Too many changes in a short time. Try again in a while.");
    const current = await getApp(d.db, s.tenantId, c.params.id!);
    try {
      const out = await iterateApp(current.spec, message, { llm: d.llm });
      if (out.ops.length === 0) return json({ ...current, changes: [], note: "no_change" });
      const res = await commit(d.db, s.tenantId, current.id, out.ops as PatchOps, { label: message, source: "ai" });
      return json({ ...res.view, changes: res.changes, ops: res.ops, costUsd: out.costUsd });
    } catch (e) {
      if (e instanceof GenerationError) throw new HttpError(422, e.message, e.errors);
      throw e;
    }
  });

  // Inspector / manual edits use the exact same revision mechanism as AI edits.
  r.post("/v1/apps/:id/edit", async (c) => {
    const s = await requireSession(d.db, c);
    const body = parse(EditBody, await c.body());
    const res = await commit(d.db, s.tenantId, c.params.id!, body.ops as PatchOps, { label: body.label, source: "manual" });
    return json({ ...res.view, changes: res.changes, ops: res.ops });
  });

  r.post("/v1/apps/:id/undo", async (c) => json(await undo(d.db, (await requireSession(d.db, c)).tenantId, c.params.id!)));
  r.post("/v1/apps/:id/redo", async (c) => json(await redo(d.db, (await requireSession(d.db, c)).tenantId, c.params.id!)));

  // ---- sharing (live draft preview by capability link) ----
  r.post("/v1/apps/:id/share", async (c) => {
    const s = await requireSession(d.db, c);
    const token = newToken(18);
    const res = await d.db.asTenant(s.tenantId, (q) => q("update apps set preview_token=coalesce(preview_token,$2) where id=$1 returning preview_token", [c.params.id!, token]));
    if (!res.rows[0]) throw new HttpError(404, "App not found");
    return json({ token: res.rows[0].preview_token, url: `${d.publicUrl}/en/preview/${res.rows[0].preview_token}` });
  });
  r.delete("/v1/apps/:id/share", async (c) => {
    const s = await requireSession(d.db, c);
    await d.db.asTenant(s.tenantId, (q) => q("update apps set preview_token=null where id=$1", [c.params.id!]));
    return json({ ok: true });
  });

  // ---- publishing: a published snapshot is what end-user apps load; editing the draft does not change it until republished ----
  r.post("/v1/apps/:id/publish", async (c) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous) throw new HttpError(403, "Create a free account to publish");
    const res = await d.db.asTenant(s.tenantId, (q) => q("update apps set published_spec=spec, published_at=now() where id=$1 returning published_at", [c.params.id!]));
    if (!res.rows[0]) throw new HttpError(404, "App not found");
    return json({ publishedAt: new Date(res.rows[0].published_at).toISOString() });
  });
  r.post("/v1/apps/:id/unpublish", async (c) => {
    const s = await requireSession(d.db, c);
    await d.db.asTenant(s.tenantId, (q) => q("update apps set published_spec=null, published_at=null where id=$1", [c.params.id!]));
    return json({ ok: true });
  });

  r.get("/v1/apps/:id/publish/checklist", async (c) => {
    const s = await requireSession(d.db, c);
    const app = await getApp(d.db, s.tenantId, c.params.id!);
    const spec: AppSpec = app.spec;
    const p = await plan(s.tenantId);
    const t = (await d.db.system("select stripe_account_id from tenants where id=$1", [s.tenantId])).rows[0]!;
    const uses = (m: string) => spec.screens.some((sc) => sc.blocks.some((b) => b.module === m));
    const items: ChecklistItem[] = [
      { id: "account", owner: "us", status: s.anonymous ? "todo" : "done" },
      { id: "plan", owner: "us", status: ENTITLEMENTS[p].storePublishing ? "done" : "blocked" },
      { id: "web_publish", owner: "us", status: app.publishedAt ? "done" : "todo" },
      { id: "listing", owner: "us", status: "todo" },
      { id: "apple_account", owner: "you", status: "todo" },
      { id: "google_account", owner: "you", status: "todo" },
      ...(spec.features.payments ? [{ id: "payments", owner: "you" as const, status: t.stripe_account_id ? "done" as const : "todo" as const }] : []),
      ...(uses("announcements") ? [{ id: "push_credentials", owner: "you" as const, status: "todo" as const }] : []),
      { id: "privacy_policy_url", owner: "you", status: "todo" },
    ];
    return json({ items });
  });
}
