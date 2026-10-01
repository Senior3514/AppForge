import { z } from "zod";
import type { Db, Row } from "./db";
import { hashPassword, hashToken, newToken, verifyPassword } from "./crypto";
import { HttpError, cookieHeader, type Ctx } from "./http";

export const SESSION_COOKIE = "af_session";
const SESSION_DAYS = 30;
const MAGIC_MINUTES = 15;

export interface Session { userId: string; tenantId: string; email: string | null; anonymous: boolean }

export const Credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(200) });

export async function createTenantAndUser(db: Db, opts: { email: string | null; passwordHash: string | null; anonymous: boolean }): Promise<Session> {
  return db.systemTx(async (q) => {
    const name = opts.email ? opts.email.split("@")[0]! : "Guest workspace";
    const t = (await q("insert into tenants (name) values ($1) returning id", [name])).rows[0]!;
    const u = (await q("insert into users (tenant_id, email, password_hash, anonymous) values ($1,$2,$3,$4) returning id", [t.id, opts.email, opts.passwordHash, opts.anonymous])).rows[0]!;
    return { userId: u.id, tenantId: t.id, email: opts.email, anonymous: opts.anonymous };
  });
}

export async function issueSession(db: Db, userId: string, secure: boolean): Promise<{ token: string; cookie: string }> {
  const token = newToken();
  await db.system("insert into sessions (token_hash, user_id, expires_at) values ($1,$2, now() + ($3 || ' days')::interval)", [hashToken(token), userId, String(SESSION_DAYS)]);
  return { token, cookie: cookieHeader(SESSION_COOKIE, token, { maxAgeSec: SESSION_DAYS * 86400, secure }) };
}

export async function sessionOf(db: Db, c: Ctx): Promise<Session | null> {
  const bearer = /^Bearer (.+)$/.exec(c.req.headers.get("authorization") ?? "")?.[1];
  const token = bearer ?? c.cookie(SESSION_COOKIE);
  if (!token) return null;
  const r = (await db.system(
    "select u.id as user_id, u.tenant_id, u.email, u.anonymous from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at > now()",
    [hashToken(token)])).rows[0];
  return r ? { userId: r.user_id, tenantId: r.tenant_id, email: r.email, anonymous: r.anonymous } : null;
}

export async function requireSession(db: Db, c: Ctx): Promise<Session> {
  const s = await sessionOf(db, c);
  if (!s) throw new HttpError(401, "Please sign in");
  return s;
}

export async function findUserByEmail(db: Db, email: string): Promise<Row | undefined> {
  return (await db.system("select id, tenant_id, password_hash from users where email=$1", [email])).rows[0];
}

/** Turns an anonymous "try first" account into a real one in place, so drafts survive signup. */
export async function claimAnonymous(db: Db, s: Session, email: string, password: string) {
  await db.systemTx(async (q) => {
    await q("update users set email=$2, password_hash=$3, anonymous=false where id=$1", [s.userId, email, await hashPassword(password)]);
    await q("update tenants set name=$2 where id=$1", [s.tenantId, email.split("@")[0]]);
  });
}

/** Logging in from an anonymous session moves that session's drafts into the account being logged into. */
export async function adoptAnonymousDrafts(db: Db, anon: Session, intoTenant: string) {
  if (!anon.anonymous || anon.tenantId === intoTenant) return;
  await db.systemTx(async (q) => {
    await q("update apps set tenant_id=$2 where tenant_id=$1", [anon.tenantId, intoTenant]);
    await q("update app_revisions set tenant_id=$2 where tenant_id=$1", [anon.tenantId, intoTenant]);
  });
}

export const verifyLogin = async (db: Db, email: string, password: string): Promise<Row | null> => {
  const u = await findUserByEmail(db, email);
  // Always run a hash comparison so response time does not reveal whether the email exists.
  const ok = await verifyPassword(password, u?.password_hash ?? "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
  return u && ok ? u : null;
};

export async function createMagicLink(db: Db, email: string): Promise<string> {
  const token = newToken();
  await db.system("insert into magic_links (token_hash, email, expires_at) values ($1,$2, now() + ($3 || ' minutes')::interval)", [hashToken(token), email, String(MAGIC_MINUTES)]);
  return token;
}

/** Single use: the row is deleted as it is read. */
export async function consumeMagicLink(db: Db, token: string): Promise<string | null> {
  const r = (await db.system("delete from magic_links where token_hash=$1 and expires_at > now() returning email", [hashToken(token)])).rows[0];
  return r ? (r.email as string) : null;
}
