import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { MockLlm, generateApp } from "@appforge/generator";
import { EasCliBuilds, MockBuilds } from "./adapters/builds";
import { monogram, nameSuggestions } from "./publishing/branding";
import { storeListing } from "./publishing/listing";
import { client, newPlatform, signedUp } from "./testkit";
import type { Platform } from "./platform";

let p: Platform;
beforeAll(async () => { p = await newPlatform(); });
afterAll(() => p.close());

async function account(prompt: string, plan?: string) {
  const u = await signedUp(p);
  if (plan) await u.c.call("POST", "/v1/billing/checkout", { plan });
  const app = (await u.c.call("POST", "/v1/apps", { prompt })).body;
  return { ...u, app };
}

describe("branding kit", () => {
  it("monograms and name suggestions respect scripts and limits", () => {
    expect(monogram("Glow Studio")).toBe("GS");
    expect(monogram("סטודיו גלואו")).toBe("סג");
    expect(monogram("Cafe")).toBe("C");
    const spec = { name: "Glow Studio", locale: "en" } as never;
    const names = nameSuggestions(spec);
    expect(names[0]).toBe("Glow Studio");
    expect(names.every((n) => n.length <= 30)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });

  it("returns palette, typography and asset manifest; Hebrew apps get a Hebrew font", async () => {
    const { c, app } = await account("אפליקציה למסעדה שלי");
    const kit = (await c.call("GET", `/v1/apps/${app.id}/branding`)).body;
    expect(kit.typography.heading).toBe("Heebo");
    expect(kit.palette.light.onPrimary).toMatch(/^#/);
    expect(kit.assets.map((a: any) => a.id)).toEqual(["icon-1024", "icon-512", "adaptive-foreground", "adaptive-background", "splash", "favicon"]);
  });

  it("renders every asset at the exact store size; App Store icon has no alpha, adaptive foreground does", async () => {
    const { c, app } = await account("salon booking app");
    const dims: Record<string, [number, number]> = { "icon-1024": [1024, 1024], "icon-512": [512, 512], "adaptive-foreground": [1024, 1024], "adaptive-background": [1024, 1024], splash: [1284, 2778], favicon: [48, 48] };
    for (const [id, [w, h]] of Object.entries(dims)) {
      const r = await c.call("GET", `/v1/apps/${app.id}/branding/${id}.png`);
      expect(r.status, id).toBe(200);
      const meta = await sharp(r.body).metadata();
      expect([meta.width, meta.height], id).toEqual([w, h]);
      expect(meta.format).toBe("png");
      expect(meta.hasAlpha, id).toBe(id === "adaptive-foreground");
    }
    expect((await c.call("GET", `/v1/apps/${app.id}/branding/nope.png`)).status).toBe(404);
  });

  it("the icon actually uses the brand colour", async () => {
    const { c, app } = await account("salon booking app");
    await c.call("POST", `/v1/apps/${app.id}/edit`, { label: "c", ops: [{ op: "replace", path: "/theme/primary", value: "#00aa00" }] });
    const { data } = await sharp((await c.call("GET", `/v1/apps/${app.id}/branding/icon-512.png`)).body).extract({ left: 4, top: 4, width: 1, height: 1 }).raw().toBuffer({ resolveWithObject: true });
    expect(data[1]!).toBeGreaterThan(data[0]!); // green channel dominates in the corner
  });
});

describe("store listing", () => {
  it("respects store length limits and is derived from the app's modules", async () => {
    const { c, app } = await account("salon booking app");
    const l = (await c.call("POST", `/v1/apps/${app.id}/store-listing`)).body;
    expect(l.title.length).toBeLessThanOrEqual(30);
    expect(l.subtitle.length).toBeLessThanOrEqual(30);
    expect(l.shortDescription.length).toBeLessThanOrEqual(80);
    expect(l.keywords.length).toBeLessThanOrEqual(100);
    expect(l.fullDescription.length).toBeLessThanOrEqual(4000);
    expect(l.fullDescription).toContain("Book appointments");
    expect(l.category).toEqual({ apple: "Lifestyle", play: "Lifestyle" });
    expect(l.screenshots.length).toBe(app.spec.navigation.length * 2);
  });

  it("truncates over-long text at a word boundary and never exceeds the limits", async () => {
    const { spec } = await generateApp("salon booking app", { llm: new MockLlm() });
    const l = storeListing({ ...spec, name: "The Extraordinarily Long Named Application", tagline: "word ".repeat(60) }, null);
    expect(l.title.length).toBeLessThanOrEqual(30);
    expect(l.title).toMatch(/…$/);
    expect(l.title).not.toMatch(/\s…$/);
    expect(l.shortDescription.length).toBeLessThanOrEqual(80);
    expect(l.subtitle.length).toBeLessThanOrEqual(30);
  });

  it("privacy answers match what the app really does", async () => {
    const shop = await account("online store for my products", "starter");
    const l = (await shop.c.call("POST", `/v1/apps/${shop.app.id}/store-listing`)).body;
    expect(l.category.apple).toBe("Shopping");
    expect(l.dataSafety.tracking).toBe(false);
    expect(l.dataSafety.collects.map((x: any) => x.dataType).join()).toMatch(/Purchase history/);
    expect(l.dataSafety.collects.map((x: any) => x.dataType).join()).toMatch(/screen views/);
    expect(l.dataSafety.collects.map((x: any) => x.dataType).join()).not.toMatch(/push token/);
    expect(l.privacyPolicy).toContain(shop.email); // contact = account owner
    const cafe = await account("salon booking app");
    const l2 = (await cafe.c.call("POST", `/v1/apps/${cafe.app.id}/store-listing`)).body;
    expect(l2.dataSafety.collects.map((x: any) => x.dataType).join()).toMatch(/Contact info/);
  });

  it("hosts the privacy policy publicly once published, not before", async () => {
    const { c, app } = await account("cafe", "starter");
    const anon = client(p, "10.5.0.1");
    expect((await anon.call("GET", `/v1/public/apps/${app.id}/privacy`)).status).toBe(404);
    await c.call("POST", `/v1/apps/${app.id}/publish`);
    const r = await anon.call("GET", `/v1/public/apps/${app.id}/privacy`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("Privacy Policy");
  });

  it("generates store screenshots at store sizes, RTL-aware", async () => {
    const { c, app } = await account("אפליקציה למספרה");
    const ios = await c.call("GET", `/v1/apps/${app.id}/screenshots/ios/home.png`);
    const android = await c.call("GET", `/v1/apps/${app.id}/screenshots/android/home.png`);
    expect(await sharp(ios.body).metadata()).toMatchObject({ width: 1290, height: 2796 });
    expect(await sharp(android.body).metadata()).toMatchObject({ width: 1080, height: 1920 });
    expect((await c.call("GET", `/v1/apps/${app.id}/screenshots/ios/ghost.png`)).status).toBe(404);
    expect((await c.call("GET", `/v1/apps/${app.id}/screenshots/tv/home.png`)).status).toBe(404);
  });
});

describe("share QR", () => {
  it("renders an SVG QR only once a share link exists", async () => {
    const { c, app } = await account("cafe");
    expect((await c.call("GET", `/v1/apps/${app.id}/share/qr.svg`)).status).toBe(404);
    await c.call("POST", `/v1/apps/${app.id}/share`);
    const r = await c.call("GET", `/v1/apps/${app.id}/share/qr.svg`);
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("image/svg+xml");
    expect(r.body).toContain("<svg");
  });
});

describe("store builds", () => {
  it("needs a paid plan, then a published app; mock build says it is simulated", async () => {
    const { c, app } = await account("cafe");
    expect((await c.call("POST", `/v1/apps/${app.id}/builds`, { platform: "ios" })).status).toBe(402);
    await c.call("POST", "/v1/billing/checkout", { plan: "starter" });
    expect((await c.call("POST", `/v1/apps/${app.id}/builds`, { platform: "ios" })).status).toBe(409);
    await c.call("POST", `/v1/apps/${app.id}/publish`);
    const b = await c.call("POST", `/v1/apps/${app.id}/builds`, { platform: "android", submit: true });
    expect(b.status).toBe(201);
    expect(b.body.provider).toBe("mock");
    expect(b.body.log).toMatch(/SIMULATED/);
    expect(b.body.bundleId).toMatch(/^app\.appforge\.a[0-9a-f]{12}$/);
    expect((await c.call("GET", `/v1/apps/${app.id}/builds`)).body.builds).toHaveLength(1);
    expect((await c.call("POST", `/v1/apps/${app.id}/builds`, { platform: "android", bundleId: "not valid" })).status).toBe(400);
    expect((await c.call("POST", `/v1/apps/${app.id}/builds`, { platform: "windows" })).status).toBe(400);
  });

  it("EAS adapter passes white-label config via env and reports failure honestly", async () => {
    const seen: any[] = [];
    const ok = new EasCliBuilds({ runtimeDir: "/rt", expoToken: "tok", exec: async (cmd, args, o) => { seen.push({ cmd, args, o }); return { code: 0, out: "queued" }; } });
    const r = await ok.start({ appId: "a1", platform: "ios", bundleId: "com.x.y", appName: "My App", apiUrl: "https://api", submit: true });
    expect(r.status).toBe("submitted");
    expect(seen[0].args).toEqual(expect.arrayContaining(["--platform", "ios", "--non-interactive", "--auto-submit"]));
    expect(seen[0].o.cwd).toBe("/rt");
    expect(seen[0].o.env).toMatchObject({ EXPO_TOKEN: "tok", APPFORGE_APP_ID: "a1", APPFORGE_BUNDLE_ID: "com.x.y", APPFORGE_APP_NAME: "My App", EXPO_PUBLIC_API_URL: "https://api" });
    const bad = await new EasCliBuilds({ runtimeDir: "/rt", expoToken: "t", exec: async () => ({ code: 1, out: "no credentials" }) }).start({ appId: "a", platform: "android", bundleId: "a.b", appName: "x", apiUrl: "u", submit: false });
    expect(bad).toEqual({ status: "failed", log: "no credentials" });
    expect((await new MockBuilds().start({ appId: "a", platform: "ios", bundleId: "a.b", appName: "x", apiUrl: "u", submit: false })).log).toMatch(/SIMULATED/);
  });
});
