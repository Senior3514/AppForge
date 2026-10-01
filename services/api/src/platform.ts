import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createLlm } from "@appforge/generator";
import { createAdapters } from "./adapters";
import { sealer } from "./crypto";
import { openDb } from "./db";
import type { Deps } from "./deps";
import { HttpError, RateLimiter, Router, json } from "./http";
import { aiRoutes } from "./routes/ai";
import { accountRoutes } from "./routes/account";
import { operatorRoutes } from "./routes/operator";
import { adminRoutes } from "./routes/admin";
import { appRoutes } from "./routes/apps";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { publishRoutes } from "./routes/publish";
import { runDueCampaigns } from "./scheduler";

/**
 * Secret that encrypts stored AI keys. Set APPFORGE_SECRET in any real deployment. With the embedded database there is no
 * deployment to protect, so one is generated (and kept next to the data so restarts keep working).
 */
function resolveSecret(env: Record<string, string | undefined>): string | null {
  if (env.APPFORGE_SECRET) return env.APPFORGE_SECRET;
  if (env.DATABASE_URL) return null;
  const dir = env.APPFORGE_DATA_DIR;
  if (!dir) return randomBytes(32).toString("hex");
  const file = path.join(dir, "secret");
  if (existsSync(file)) return readFileSync(file, "utf8").trim();
  mkdirSync(dir, { recursive: true });
  const fresh = randomBytes(32).toString("hex");
  writeFileSync(file, fresh, { mode: 0o600 });
  return fresh;
}

export interface Platform {
  handle(req: Request): Promise<Response>;
  deps: Deps;
  /** Sends due push campaigns now. The server calls this on a timer; tests call it directly. */
  tick(now?: Date): Promise<number>;
  close(): Promise<void>;
}

/** Builds the whole backend. With no overrides and no env it runs on embedded Postgres and mock adapters. */
export async function createPlatform(o: Partial<Deps> & { env?: Record<string, string | undefined> } = {}): Promise<Platform> {
  const env = o.env ?? process.env;
  const publicUrl = o.publicUrl ?? env.APPFORGE_PUBLIC_URL ?? "http://localhost:3000";
  const deps: Deps = {
    db: o.db ?? (await openDb(env)),
    llm: o.llm ?? createLlm(env),
    cache: o.cache ?? new Map(),
    adapters: o.adapters ?? createAdapters(env, publicUrl),
    limiter: o.limiter ?? new RateLimiter(),
    publicUrl,
    secureCookies: o.secureCookies ?? publicUrl.startsWith("https://"),
    fetchImpl: o.fetchImpl,
    sealer: o.sealer !== undefined ? o.sealer : (() => { const k = resolveSecret(env); return k ? sealer(k) : null; })(),
    operatorEmails: o.operatorEmails ?? new Set((env.APPFORGE_OPERATOR_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
  };

  const router = new Router();
  router.get("/health", () => json({ ok: true, llm: deps.llm.name, payments: deps.adapters.payments.name, push: deps.adapters.push.name, builds: deps.adapters.builds.name, billing: deps.adapters.billing.name, mailer: deps.adapters.mailer.name }));
  authRoutes(router, deps);
  accountRoutes(router, deps);
  aiRoutes(router, deps);
  operatorRoutes(router, deps);
  appRoutes(router, deps);
  adminRoutes(router, deps);
  publicRoutes(router, deps);
  publishRoutes(router, deps);

  return {
    deps,
    tick: (now) => runDueCampaigns(deps, now),
    close: () => deps.db.close(),
    async handle(req) {
      try { return await router.handle(req); }
      catch (e) {
        if (e instanceof HttpError) return json({ error: e.message, details: e.details }, e.status);
        console.error(e);
        return json({ error: "Internal error" }, 500);
      }
    },
  };
}
