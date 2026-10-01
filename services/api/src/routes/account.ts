import { z } from "zod";
import { consumeAuthToken, createAuthToken, findUserByEmail, issueSession, requireSession, SESSION_COOKIE } from "../auth";
import { hashPassword, hashToken, verifyPassword } from "../crypto";
import type { Deps } from "../deps";
import { HttpError, cookieHeader, json, type Router } from "../http";

const Password = z.string().min(8).max(200);
const parse = <T,>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, "Please check your details", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
};

export function accountRoutes(r: Router, d: Deps) {
  const mail = (to: string, subject: string, text: string) => d.adapters.mailer.send(to, subject, text);

  // ---- email verification ----
  r.post("/v1/auth/verify", async (c) => {
    const { token } = parse(z.object({ token: z.string().min(10).max(200) }), await c.body());
    const userId = await consumeAuthToken(d.db, token, "verify");
    if (!userId) throw new HttpError(400, "This link is invalid or has expired");
    await d.db.system("update users set email_verified_at = coalesce(email_verified_at, now()) where id=$1", [userId]);
    return json({ ok: true });
  });

  r.post("/v1/auth/verify/resend", async (c) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous || !s.email) throw new HttpError(403, "Create an account first");
    if (s.verified) return json({ ok: true, alreadyVerified: true });
    if (!d.limiter.allow(`verify:${s.userId}`, 3, 3_600_000)) throw new HttpError(429, "Too many emails. Try again later.");
    const token = await createAuthToken(d.db, s.userId, "verify");
    await mail(s.email, "Confirm your AppForge email", `Confirm your email: ${d.publicUrl}/en/verify?token=${token}\nThis link works once and expires in 24 hours.`);
    return json({ ok: true });
  });

  // ---- password reset (always 200, so it cannot reveal which emails have accounts) ----
  r.post("/v1/auth/forgot", async (c) => {
    if (!d.limiter.allow(`forgot:${c.ip}`, 10, 3_600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const { email } = parse(z.object({ email: z.string().trim().toLowerCase().email().max(254) }), await c.body());
    if (!d.limiter.allow(`forgot-to:${email}`, 3, 3_600_000)) return json({ ok: true });
    const u = await findUserByEmail(d.db, email);
    if (u && !u.blocked) {
      const token = await createAuthToken(d.db, u.id, "reset");
      await mail(email, "Reset your AppForge password", `Choose a new password: ${d.publicUrl}/en/reset?token=${token}\nThis link works once and expires in 1 hour. If you did not ask for it, ignore this email.`);
    }
    return json({ ok: true });
  });

  r.post("/v1/auth/reset", async (c) => {
    if (!d.limiter.allow(`reset:${c.ip}`, 20, 3_600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const body = parse(z.object({ token: z.string().min(10).max(200), password: Password }), await c.body());
    const userId = await consumeAuthToken(d.db, body.token, "reset");
    if (!userId) throw new HttpError(400, "This link is invalid or has expired");
    // Whoever may have had access with the old password is signed out; receiving the email also proves the mailbox.
    await d.db.systemTx(async (q) => {
      await q("update users set password_hash=$2, email_verified_at = coalesce(email_verified_at, now()) where id=$1", [userId, await hashPassword(body.password)]);
      await q("delete from sessions where user_id=$1", [userId]);
    });
    const s = await issueSession(d.db, userId, d.secureCookies);
    return json({ ok: true }, 200, { "set-cookie": s.cookie });
  });

  // ---- account settings ----
  const owner = async (c: Parameters<typeof requireSession>[1]) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous) throw new HttpError(403, "Create an account first");
    return s;
  };

  r.post("/v1/account/password", async (c) => {
    const s = await owner(c);
    if (!d.limiter.allow(`pw:${s.userId}`, 10, 3_600_000)) throw new HttpError(429, "Too many attempts. Try again later.");
    const body = parse(z.object({ current: z.string().max(200), password: Password }), await c.body());
    const u = (await d.db.system("select password_hash from users where id=$1", [s.userId])).rows[0];
    // Magic-link-only accounts have no password yet: they may set one without a current password.
    if (u?.password_hash && !(await verifyPassword(body.current, u.password_hash))) throw new HttpError(403, "Your current password is incorrect");
    const keep = c.cookie(SESSION_COOKIE) ?? /^Bearer (.+)$/.exec(c.req.headers.get("authorization") ?? "")?.[1];
    await d.db.systemTx(async (q) => {
      await q("update users set password_hash=$2 where id=$1", [s.userId, await hashPassword(body.password)]);
      await q("delete from sessions where user_id=$1 and token_hash <> $2", [s.userId, keep ? hashToken(keep) : ""]);
    });
    return json({ ok: true });
  });

  // A portable copy of everything the workspace owns (GDPR-style access/portability).
  r.get("/v1/account/export", async (c) => {
    const s = await owner(c);
    const data = await d.db.asTenant(s.tenantId, async (q) => ({
      apps: (await q("select id, name, spec, published_spec, published_at, branding, updated_at from apps order by updated_at desc")).rows,
      appData: (await q("select app_id, collection, data, created_at from app_data order by created_at")).rows,
      orders: (await q("select * from orders order by created_at")).rows,
      aiUsage: (await q("select at, task, source, input_tokens, output_tokens, cost_usd from ai_usage order by at")).rows,
    }));
    return json({ exportedAt: new Date().toISOString(), account: { email: s.email }, ...data }, 200, { "content-disposition": 'attachment; filename="appforge-export.json"' });
  });

  r.post("/v1/account/delete", async (c) => {
    const s = await owner(c);
    const body = parse(z.object({ confirm: z.string().max(254), password: z.string().max(200).optional() }), await c.body());
    if (body.confirm.trim().toLowerCase() !== s.email) throw new HttpError(400, "Type your email address to confirm");
    const u = (await d.db.system("select password_hash from users where id=$1", [s.userId])).rows[0];
    if (u?.password_hash && !(await verifyPassword(body.password ?? "", u.password_hash))) throw new HttpError(403, "Your password is incorrect");
    // Everything hangs off the tenant, so one delete removes apps, data, keys, sessions and the user.
    await d.db.system("delete from tenants where id=$1", [s.tenantId]);
    return json({ ok: true }, 200, { "set-cookie": cookieHeader(SESSION_COOKIE, "", { maxAgeSec: 0, secure: d.secureCookies }) });
  });
}
