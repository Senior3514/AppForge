import type { Deps } from "./deps";

/** Sends every campaign whose time has come. Rows are claimed with SKIP LOCKED so two workers never send the same campaign. */
export async function runDueCampaigns(d: Deps, now = new Date()): Promise<number> {
  const due = (await d.db.system(
    `update push_campaigns set status='sending'
     where id in (select id from push_campaigns where status='scheduled' and send_at <= $1 order by send_at limit 20 for update skip locked)
     returning id, tenant_id, app_id, title, body`, [now])).rows;
  for (const c of due) {
    try {
      const tokens = (await d.db.asTenant(c.tenant_id, (q) => q("select token from push_devices where app_id=$1", [c.app_id]))).rows.map((r) => r.token as string);
      const res = await d.adapters.push.send(tokens, { title: c.title, body: c.body });
      await d.db.asTenant(c.tenant_id, (q) => q("update push_campaigns set status='sent', sent_count=$2 where id=$1", [c.id, res.sent]));
    } catch (e) {
      await d.db.asTenant(c.tenant_id, (q) => q("update push_campaigns set status='failed', error=$2 where id=$1", [c.id, (e as Error).message.slice(0, 300)]));
    }
  }
  return due.length;
}
