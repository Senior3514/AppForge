import { readdirSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type Row = Record<string, any>;
export interface QueryResult { rows: Row[]; rowCount: number }
export type Query = (sql: string, params?: unknown[]) => Promise<QueryResult>;

/**
 * Two access paths, on purpose:
 *  - `system`: privileged connection, bypasses RLS. Used only by the auth layer and to resolve an app id to its tenant.
 *  - `asTenant`: drops to the unprivileged `app_user` role and pins `app.tenant_id` for the transaction, so RLS applies.
 */
export interface Db {
  system: Query;
  systemTx<T>(fn: (q: Query) => Promise<T>): Promise<T>;
  asTenant<T>(tenantId: string, fn: (q: Query) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");

async function migrate(q: Query): Promise<void> {
  await q("create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await q("select name from _migrations")).rows.map((r) => r.name as string));
  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await q(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    await q("insert into _migrations (name) values ($1)", [file]);
  }
}

const pin = async (q: Query, tenantId: string) => {
  await q("set local role app_user");
  await q("select set_config('app.tenant_id', $1, true)", [tenantId]);
};

async function openPglite(dataDir: string | undefined): Promise<Db> {
  if (dataDir) mkdirSync(dataDir, { recursive: true });
  const lite = new PGlite(dataDir);
  await lite.waitReady;
  const system: Query = async (sql, params) => {
    // exec() is required for multi-statement migration files; query() for parameterised statements.
    if (!params) { const r = await lite.exec(sql); const last = r.at(-1); return { rows: (last?.rows ?? []) as Row[], rowCount: last?.rows.length ?? 0 }; }
    const r = await lite.query<Row>(sql, params as unknown[]);
    return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
  };
  const tx = <T,>(fn: (q: Query) => Promise<T>, tenantId?: string) =>
    lite.transaction(async (t) => {
      const q: Query = async (sql, params) => { const r = await t.query<Row>(sql, params as unknown[]); return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length }; };
      if (tenantId) await pin(q, tenantId);
      return fn(q);
    });
  await migrate(system);
  return { system, systemTx: (fn) => tx(fn), asTenant: (id, fn) => tx(fn, id), close: () => lite.close() };
}

async function openPg(url: string): Promise<Db> {
  const pool = new pg.Pool({ connectionString: url });
  const system: Query = async (sql, params) => { const r = await pool.query(sql, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; };
  const tx = async <T,>(fn: (q: Query) => Promise<T>, tenantId?: string): Promise<T> => {
    const c = await pool.connect();
    const q: Query = async (sql, params) => { const r = await c.query(sql, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 }; };
    try {
      await c.query("begin");
      if (tenantId) await pin(q, tenantId);
      const out = await fn(q);
      await c.query("commit");
      return out;
    } catch (e) { await c.query("rollback").catch(() => {}); throw e; } finally { c.release(); }
  };
  await migrate(system);
  return { system, systemTx: (fn) => tx(fn), asTenant: (id, fn) => tx(fn, id), close: () => pool.end() };
}

/** DATABASE_URL → real Postgres. Otherwise embedded Postgres (PGlite): persisted in APPFORGE_DATA_DIR, or in memory if unset. */
export function openDb(env: Record<string, string | undefined> = process.env): Promise<Db> {
  return env.DATABASE_URL ? openPg(env.DATABASE_URL) : openPglite(env.APPFORGE_DATA_DIR);
}
