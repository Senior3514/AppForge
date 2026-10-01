import { createLlm } from "@appforge/generator";
import { createAdapters } from "./adapters";
import { openDb } from "./db";
import type { Deps } from "./deps";
import { HttpError, RateLimiter, Router, json } from "./http";
import { adminRoutes } from "./routes/admin";
import { appRoutes } from "./routes/apps";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { publishRoutes } from "./routes/publish";
import { runDueCampaigns } from "./scheduler";

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
  };

  const router = new Router();
  router.get("/health", () => json({ ok: true, llm: deps.llm.name, payments: deps.adapters.payments.name, push: deps.adapters.push.name, builds: deps.adapters.builds.name, billing: deps.adapters.billing.name, mailer: deps.adapters.mailer.name }));
  authRoutes(router, deps);
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
