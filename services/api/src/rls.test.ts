import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let db: PGlite;

/** Runs as the unprivileged role with the tenant set for this transaction only. */
async function asTenant<T>(tenant: string | null, fn: (q: PGlite["query"]) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query("set local role app_user");
    if (tenant) await tx.query("select set_config('app.tenant_id', $1, true)", [tenant]);
    return fn(tx.query.bind(tx) as PGlite["query"]);
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role app_user nologin");
  await db.exec(readFileSync(new URL("../migrations/001_init.sql", import.meta.url), "utf8"));
  await db.exec("grant select, insert, update, delete on tenants, apps, app_revisions to app_user");
  await db.exec("grant usage on all sequences in schema public to app_user");
  await db.query("insert into tenants (id, name) values ($1,'A'), ($2,'B')", [A, B]);
  await db.query("insert into apps (tenant_id, name, spec) values ($1,'a-app','{}'), ($2,'b-app','{}')", [A, B]);
});

describe("row-level security", () => {
  it("a tenant only sees its own rows", async () => {
    const r = await asTenant(A, (q) => q<{ name: string }>("select name from apps"));
    expect(r.rows.map((x) => x.name)).toEqual(["a-app"]);
  });
  it("no tenant set → no rows (fails closed)", async () => {
    expect((await asTenant(null, (q) => q("select * from apps"))).rows).toHaveLength(0);
    expect((await asTenant(null, (q) => q("select * from tenants"))).rows).toHaveLength(0);
  });
  it("cannot insert a row for another tenant", async () => {
    await expect(asTenant(A, (q) => q("insert into apps (tenant_id, name, spec) values ($1,'evil','{}')", [B]))).rejects.toThrow(/row-level security/);
  });
  it("cannot update or delete another tenant's rows (silently affects 0 rows)", async () => {
    const u = await asTenant(A, (q) => q("update apps set name='pwned' where tenant_id=$1", [B]));
    const d = await asTenant(A, (q) => q("delete from apps where tenant_id=$1", [B]));
    expect([u.affectedRows, d.affectedRows]).toEqual([0, 0]);
    expect((await db.query<{ name: string }>("select name from apps where tenant_id=$1", [B])).rows[0]!.name).toBe("b-app");
  });
  it("cannot move a row to another tenant", async () => {
    await expect(asTenant(A, (q) => q("update apps set tenant_id=$1 where tenant_id=$2", [B, A]))).rejects.toThrow(/row-level security/);
  });
  it("revisions are isolated too", async () => {
    const appA = (await db.query<{ id: string }>("select id from apps where tenant_id=$1", [A])).rows[0]!.id;
    await asTenant(A, (q) => q("insert into app_revisions (tenant_id, app_id, label, source, patch, inverse) values ($1,$2,'x','ai','[]','[]')", [A, appA]));
    expect((await asTenant(B, (q) => q("select * from app_revisions"))).rows).toHaveLength(0);
    expect((await asTenant(A, (q) => q("select * from app_revisions"))).rows).toHaveLength(1);
  });
});
