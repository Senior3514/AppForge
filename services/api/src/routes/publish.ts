import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import sharp from "sharp";
import { z } from "zod";
import type { AppSpec } from "@appforge/modules";
import type { Deps } from "../deps";
import { requireSession } from "../auth";
import { ENTITLEMENTS, effectivePlan, type Plan } from "@appforge/plans";
import { HttpError, json, type Router } from "../http";
import { getApp, tenantOfApp } from "../store";
import { BRAND_ASSETS, assetSvg, brandingKit, type BrandAsset } from "../publishing/branding";
import { STORE_SCREENSHOT_SIZES, screenshotSvg } from "../publishing/mockup";
import { privacyPolicy, storeListing } from "../publishing/listing";

const png = (buf: Buffer) => new Response(new Uint8Array(buf), { headers: { "content-type": "image/png", "cache-control": "private, max-age=60" } });
const BUNDLE_ID = /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/;

export function publishRoutes(r: Router, d: Deps) {
  const ownerEmail = async (tenantId: string) =>
    ((await d.db.system("select email from users where tenant_id=$1 and email is not null order by created_at limit 1", [tenantId])).rows[0]?.email as string | undefined) ?? null;

  async function mine(c: { req: Request; params: Record<string, string>; cookie(n: string): string | undefined }) {
    const s = await requireSession(d.db, c as never);
    return { s, app: await getApp(d.db, s.tenantId, c.params.id!) };
  }

  r.get("/v1/apps/:id/branding", async (c) => json(brandingKit((await mine(c)).app.spec)));

  r.get("/v1/apps/:id/branding/:asset", async (c) => {
    const { app } = await mine(c);
    const id = c.params.asset!.replace(/\.png$/, "") as BrandAsset;
    const def = BRAND_ASSETS[id];
    if (!def) throw new HttpError(404, "Unknown asset");
    let img = sharp(Buffer.from(assetSvg(app.spec, id)));
    // The App Store rejects icons with an alpha channel.
    if (!def.transparent) img = img.flatten({ background: app.spec.theme.primary });
    return png(await img.png().toBuffer());
  });

  r.get("/v1/apps/:id/screenshots/:platform/:screen", async (c) => {
    const { app } = await mine(c);
    const size = STORE_SCREENSHOT_SIZES[c.params.platform as "ios" | "android"];
    if (!size) throw new HttpError(404, "Unknown platform");
    if (!app.spec.screens.some((s) => s.id === c.params.screen!.replace(/\.png$/, ""))) throw new HttpError(404, "Unknown screen");
    const svg = screenshotSvg(app.spec, c.params.screen!.replace(/\.png$/, ""), size, c.url.searchParams.get("dark") === "1");
    return png(await sharp(Buffer.from(svg)).png().toBuffer());
  });

  r.post("/v1/apps/:id/store-listing", async (c) => {
    const { s, app } = await mine(c);
    const listing = storeListing(app.spec, await ownerEmail(s.tenantId));
    const screenshots = app.spec.navigation.flatMap((screen) =>
      (["ios", "android"] as const).map((platform) => ({ platform, screen, ...STORE_SCREENSHOT_SIZES[platform], path: `/v1/apps/${app.id}/screenshots/${platform}/${screen}.png` })));
    return json({ ...listing, screenshots, screenshotsNote: "Generated mock-ups of each tab. Replace with captures from a real device if you prefer." });
  });

  // The App Store and Google Play both require a privacy policy URL, so a published app serves its own.
  r.get("/v1/public/apps/:id/privacy", async (c) => {
    const t = await tenantOfApp(d.db, c.params.id!);
    if (!t?.published_spec) throw new HttpError(404, "Not found");
    const md = privacyPolicy(t.published_spec as AppSpec, await ownerEmail(t.tenant_id));
    return new Response(md, { headers: { "content-type": "text/markdown; charset=utf-8" } });
  });

  r.get("/v1/apps/:id/share/qr.svg", async (c) => {
    const { app } = await mine(c);
    const row = (await d.db.asTenant((await requireSession(d.db, c)).tenantId, (q) => q("select preview_token from apps where id=$1", [app.id]))).rows[0];
    if (!row?.preview_token) throw new HttpError(404, "Create a share link first");
    const svg = await QRCode.toString(`${d.publicUrl}/en/preview/${row.preview_token}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    return new Response(svg, { headers: { "content-type": "image/svg+xml" } });
  });

  // ---- store builds (white-label via EAS); the user must own the developer accounts ----
  r.post("/v1/apps/:id/builds", async (c) => {
    const { s, app } = await mine(c);
    const t = (await d.db.system("select plan, plan_status from tenants where id=$1", [s.tenantId])).rows[0]!;
    const plan = effectivePlan(t.plan as Plan, t.plan_status);
    if (!ENTITLEMENTS[plan].storePublishing) throw new HttpError(402, "Store publishing needs a paid plan", { code: "plan_limit", plan });
    if (!app.publishedAt) throw new HttpError(409, "Publish the app first: store builds load the published version");
    if (!d.limiter.allow(`build:${s.tenantId}`, 5, 3_600_000)) throw new HttpError(429, "Too many builds. Try again later.");
    const body = z.object({ platform: z.enum(["ios", "android"]), submit: z.boolean().default(false), bundleId: z.string().regex(BUNDLE_ID).max(100).optional() }).safeParse(await c.body());
    if (!body.success) throw new HttpError(400, "Invalid request body", body.error.issues.map((i) => i.message));
    const bundleId = body.data.bundleId ?? `app.appforge.a${app.id.replaceAll("-", "").slice(0, 12)}`;
    const id = randomUUID();
    await d.db.asTenant(s.tenantId, (q) => q("insert into builds (id, tenant_id, app_id, platform, bundle_id, provider, status) values ($1,$2,$3,$4,$5,$6,'building')", [id, s.tenantId, app.id, body.data.platform, bundleId, d.adapters.builds.name]));
    const res = await d.adapters.builds.start({ appId: app.id, platform: body.data.platform, bundleId, appName: app.name, apiUrl: d.publicUrl, submit: body.data.submit });
    await d.db.asTenant(s.tenantId, (q) => q("update builds set status=$2, log=$3 where id=$1", [id, res.status, res.log]));
    return json({ id, status: res.status, provider: d.adapters.builds.name, bundleId, log: res.log }, 201);
  });

  r.get("/v1/apps/:id/builds", async (c) => {
    const { s, app } = await mine(c);
    const rows = (await d.db.asTenant(s.tenantId, (q) => q("select id, platform, status, bundle_id, log, provider, created_at from builds where app_id=$1 order by created_at desc limit 20", [app.id]))).rows;
    return json({ builds: rows.map((b) => ({ id: b.id, platform: b.platform, status: b.status, bundleId: b.bundle_id, log: b.log, provider: b.provider, createdAt: new Date(b.created_at).toISOString() })) });
  });
}
