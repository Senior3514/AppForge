import { z } from "zod";
import { ENTITLEMENTS, TRIAL_DAYS, effectivePlan, isPlan, type Plan } from "@appforge/plans";
import {
  Credentials, adoptAnonymousDrafts, claimAnonymous, consumeMagicLink, createMagicLink, createTenantAndUser,
  createAuthToken, findUserByEmail, issueSession, requireSession, sessionOf, verifyLogin, SESSION_COOKIE,
} from "../auth";
import { HttpError, cookieHeader, json, type Router } from "../http";
import type { Deps } from "../deps";
import { hashPassword, hashToken } from "../crypto";
import { InvalidSignatureError } from "../adapters/payments";

const Email = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const Token = z.object({ token: z.string().min(10).max(200) });

function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Please check your details", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
}

export function authRoutes(r: Router, d: Deps) {
  const respondWithSession = async (userId: string, body: unknown, status = 200) => {
    const s = await issueSession(d.db, userId, d.secureCookies);
    return json(body, status, { "set-cookie": s.cookie });
  };

  const sendVerification = async (userId: string, email: string) => {
    const token = await createAuthToken(d.db, userId, "verify");
    await d.adapters.mailer.send(email, "Confirm your AppForge email", `Confirm your email: ${d.publicUrl}/en/verify?token=${token}\nThis link works once and expires in 24 hours.`);
  };

  r.post("/v1/auth/signup", async (c) => {
    if (!d.limiter.allow(`signup:${c.ip}`, 10, 3_600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const { email, password } = parse(Credentials, await c.body());
    if (await findUserByEmail(d.db, email)) throw new HttpError(409, "An account with this email already exists");
    const current = await sessionOf(d.db, c);
    if (current?.anonymous) {
      await claimAnonymous(d.db, current, email, password);
      await sendVerification(current.userId, email);
      return json({ email, claimedDrafts: true });
    }
    const s = await createTenantAndUser(d.db, { email, passwordHash: await hashPassword(password), anonymous: false });
    await sendVerification(s.userId, email);
    return respondWithSession(s.userId, { email, claimedDrafts: false }, 201);
  });

  r.post("/v1/auth/login", async (c) => {
    if (!d.limiter.allow(`login:${c.ip}`, 20, 900_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const { email, password } = parse(Credentials, await c.body());
    const u = await verifyLogin(d.db, email, password);
    if (!u) throw new HttpError(401, "Incorrect email or password");
    if (u.blocked) throw new HttpError(403, "This account has been suspended");
    const anon = await sessionOf(d.db, c);
    if (anon) await adoptAnonymousDrafts(d.db, anon, u.tenant_id);
    return respondWithSession(u.id, { email });
  });

  r.post("/v1/auth/logout", async (c) => {
    const token = c.cookie(SESSION_COOKIE);
    if (token) await d.db.system("delete from sessions where token_hash=$1", [hashToken(token)]);
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(SESSION_COOKIE, "", { maxAgeSec: 0, secure: d.secureCookies }) });
  });

  // Always answers 200 so the endpoint cannot be used to discover which emails have accounts.
  r.post("/v1/auth/magic-link", async (c) => {
    if (!d.limiter.allow(`magic:${c.ip}`, 10, 3_600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const { email } = parse(Email, await c.body());
    if (!d.limiter.allow(`magic-to:${email}`, 3, 3_600_000)) return json({ ok: true });
    const token = await createMagicLink(d.db, email);
    await d.adapters.mailer.send(email, "Your AppForge sign-in link", `Sign in: ${d.publicUrl}/en/login?token=${token}\nThis link works once and expires in 15 minutes.`);
    return json({ ok: true });
  });

  r.post("/v1/auth/magic-link/verify", async (c) => {
    const { token } = parse(Token, await c.body());
    const email = await consumeMagicLink(d.db, token);
    if (!email) throw new HttpError(400, "This link is invalid or has expired");
    const existing = await findUserByEmail(d.db, email);
    const anon = await sessionOf(d.db, c);
    let userId: string;
    if (existing?.blocked) throw new HttpError(403, "This account has been suspended");
    if (existing) { userId = existing.id; if (anon) await adoptAnonymousDrafts(d.db, anon, existing.tenant_id); }
    else if (anon?.anonymous) {
      await d.db.system("update users set email=$2, anonymous=false where id=$1", [anon.userId, email]);
      userId = anon.userId;
    } else userId = (await createTenantAndUser(d.db, { email, passwordHash: null, anonymous: false })).userId;
    // Receiving the link proves the mailbox is theirs.
    await d.db.system("update users set email_verified_at = coalesce(email_verified_at, now()) where id=$1", [userId]);
    return respondWithSession(userId, { email });
  });

  r.get("/v1/me", async (c) => {
    const s = await sessionOf(d.db, c);
    if (!s) return json({ user: null, server: { llm: d.llm.name } });
    const t = (await d.db.system("select plan, plan_status, trial_ends_at from tenants where id=$1", [s.tenantId])).rows[0]!;
    const apps = Number((await d.db.asTenant(s.tenantId, (q) => q("select count(*)::int as n from apps"))).rows[0]!.n);
    const plan = effectivePlan(t.plan as Plan, t.plan_status);
    const hasOwnKey = (await d.db.asTenant(s.tenantId, (q) => q("select 1 from ai_providers"))).rows.length > 0;
    return json({
      aiSource: hasOwnKey ? "user" : d.llm.name === "mock" ? "mock" : "platform",
      user: { email: s.email, anonymous: s.anonymous, verified: s.verified, operator: !!(s.email && s.verified && d.operatorEmails.has(s.email)) },
      tenant: { plan: t.plan, status: t.plan_status, effectivePlan: plan, trialEndsAt: t.trial_ends_at ? new Date(t.trial_ends_at).toISOString() : null },
      entitlements: ENTITLEMENTS[plan], usage: { apps },
      // Lets the UI be honest about demo mode (mock adapters) instead of pretending things are live.
      server: { llm: d.llm.name, payments: d.adapters.payments.name, push: d.adapters.push.name, builds: d.adapters.builds.name, billing: d.adapters.billing.name },
    });
  });

  // ---- platform billing ----
  r.get("/v1/billing/plans", () => json({ trialDays: TRIAL_DAYS, plans: ENTITLEMENTS }));

  r.post("/v1/billing/checkout", async (c) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous) throw new HttpError(403, "Create an account before subscribing");
    const { plan } = parse(z.object({ plan: z.string() }), await c.body());
    if (!isPlan(plan) || plan === "free") throw new HttpError(400, "Choose starter, pro or business");
    const out = await d.adapters.billing.startCheckout({
      tenantId: s.tenantId, email: s.email, plan,
      successUrl: `${d.publicUrl}/en/dashboard?billing=success`, cancelUrl: `${d.publicUrl}/en/pricing`,
    });
    if ("url" in out) return json({ url: out.url });
    // Mock provider: activate immediately with the same 7-day trial the real one gives.
    await d.db.system("update tenants set plan=$2, plan_status='trialing', trial_ends_at = now() + ($3 || ' days')::interval where id=$1", [s.tenantId, plan, String(TRIAL_DAYS)]);
    return json({ activated: true, plan });
  });

  r.post("/v1/billing/cancel", async (c) => {
    const s = await requireSession(d.db, c);
    if (d.adapters.billing.name !== "mock") throw new HttpError(400, "Manage or cancel your subscription in the billing portal");
    await d.db.system("update tenants set plan='free', plan_status='active', trial_ends_at=null where id=$1", [s.tenantId]);
    return json({ plan: "free" });
  });

  r.post("/v1/webhooks/billing", async (c) => {
    let ev;
    try { ev = d.adapters.billing.parseWebhook(await c.raw(), c.req.headers); }
    catch (e) { if (e instanceof InvalidSignatureError) throw new HttpError(400, "Invalid signature"); throw e; }
    if (!ev) return json({ ok: true }); // a valid event we do not act on
    await d.db.system(
      "update tenants set plan=$2, plan_status=$3, stripe_customer_id=coalesce($4, stripe_customer_id) where id=$1",
      [ev.tenantId, ev.status === "canceled" ? "free" : ev.plan, ev.status, ev.customerId ?? null]);
    return json({ ok: true });
  });
}
