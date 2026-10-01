import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { openDb, type Db } from "./db";
import { testEnv } from "./testkit";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";
let db: Db;
let appA: string;
let appB: string;

beforeAll(async () => {
  db = await openDb(testEnv());
  await db.system("insert into tenants (id, name) values ($1,'A'), ($2,'B')", [A, B]);
  appA = (await db.system("insert into apps (tenant_id, name, spec) values ($1,'a-app','{}') returning id", [A])).rows[0]!.id;
  appB = (await db.system("insert into apps (tenant_id, name, spec) values ($1,'b-app','{}') returning id", [B])).rows[0]!.id;
});
afterAll(() => db.close());

describe("migrations", () => {
  it("are idempotent when reopened logic re-runs (recorded in _migrations)", async () => {
    const r = await db.system("select name from _migrations order by name");
    expect(r.rows.map((x) => x.name)).toEqual(["001_init.sql", "002_platform.sql", "003_accounts_ai.sql"]);
  });
});

describe("row-level security", () => {
  it("a tenant only sees its own apps", async () => {
    const r = await db.asTenant(A, (q) => q("select name from apps"));
    expect(r.rows.map((x) => x.name)).toEqual(["a-app"]);
  });
  it("no tenant pinned → nothing (fails closed)", async () => {
    // Direct role switch without a tenant: what a bug that forgot asTenant would look like.
    const r = await db.systemTx(async (q) => { await q("set local role app_user"); return q("select * from apps"); });
    expect(r.rows).toHaveLength(0);
  });
  it("cannot insert for another tenant", async () => {
    await expect(db.asTenant(A, (q) => q("insert into apps (tenant_id, name, spec) values ($1,'evil','{}')", [B]))).rejects.toThrow(/row-level security/);
  });
  it("cannot update/delete another tenant's rows", async () => {
    const u = await db.asTenant(A, (q) => q("update apps set name='pwned' where tenant_id=$1", [B]));
    const d = await db.asTenant(A, (q) => q("delete from apps where tenant_id=$1", [B]));
    expect([u.rowCount, d.rowCount]).toEqual([0, 0]);
    expect((await db.system("select name from apps where id=$1", [appB])).rows[0]!.name).toBe("b-app");
  });
  it("cannot move a row to another tenant", async () => {
    await expect(db.asTenant(A, (q) => q("update apps set tenant_id=$1 where tenant_id=$2", [B, A]))).rejects.toThrow(/row-level security/);
  });

  it.each([
    ["app_data", "insert into app_data (tenant_id, app_id, collection, data) values ($1,$2,'c','{}')"],
    ["events", "insert into events (tenant_id, app_id, name, device_id) values ($1,$2,'e','d')"],
    ["push_devices", "insert into push_devices (tenant_id, app_id, token, platform) values ($1,$2,'t','ios')"],
    ["push_campaigns", "insert into push_campaigns (tenant_id, app_id, title, body, send_at) values ($1,$2,'t','b',now())"],
    ["orders", "insert into orders (tenant_id, app_id, items, total_cents, currency, provider) values ($1,$2,'[]',1,'USD','mock')"],
    ["builds", "insert into builds (tenant_id, app_id, platform, bundle_id, provider) values ($1,$2,'ios','x.y','mock')"],
  ])("%s is isolated per tenant", async (table, insert) => {
    await db.asTenant(A, (q) => q(insert, [A, appA]));
    expect((await db.asTenant(A, (q) => q(`select * from ${table}`))).rows).toHaveLength(1);
    expect((await db.asTenant(B, (q) => q(`select * from ${table}`))).rows).toHaveLength(0);
    await expect(db.asTenant(B, (q) => q(insert, [A, appA]))).rejects.toThrow(/row-level security/);
  });

  it("the tenant role cannot read auth tables at all", async () => {
    for (const t of ["users", "sessions", "magic_links"])
      await expect(db.asTenant(A, (q) => q(`select * from ${t}`))).rejects.toThrow(/permission denied/);
  });
});
