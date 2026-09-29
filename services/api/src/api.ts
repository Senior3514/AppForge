import { randomUUID } from "node:crypto";
import { z } from "zod";
import { validateApp, type AppSpec } from "@appforge/modules";
import { RevisionLog } from "@appforge/spec";
import { GenerationError, generateApp, iterateApp, type GenerateOptions, type LlmClient } from "@appforge/generator";
import { LOCALES } from "@appforge/i18n";

/** Resolves a request to a tenant id, or null. The mock accepts "Bearer mock:<tenant>"; real JWT auth arrives with the backend phase. */
export type Authenticator = (req: Request) => string | null;
export const mockAuth: Authenticator = (req) => {
  const m = /^Bearer mock:([a-z0-9-]{1,40})$/.exec(req.headers.get("authorization") ?? "");
  return m ? m[1]! : null;
};

interface Deps { llm: LlmClient; auth?: Authenticator; cache?: GenerateOptions["cache"] }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const err = (status: number, message: string, details?: string[]) => json({ error: message, details }, status);

const CreateBody = z.object({ prompt: z.string(), locale: z.enum(LOCALES).optional() });
const ChatBody = z.object({ message: z.string() });

export function createApi({ llm, auth = mockAuth, cache = new Map() }: Deps) {
  // tenant → app → history. Lookups are always keyed by the authenticated tenant, so another tenant's id is simply "not found".
  const store = new Map<string, Map<string, RevisionLog<AppSpec>>>();
  const appsOf = (tenant: string) => store.get(tenant) ?? store.set(tenant, new Map()).get(tenant)!;
  const view = (id: string, log: RevisionLog<AppSpec>) => ({ id, spec: log.current, canUndo: log.canUndo, canRedo: log.canRedo, history: log.history.map(({ id, label, source, at }) => ({ id, label, source, at })) });
  const validate = (d: AppSpec) => { const v = validateApp(d); if (!v.ok) throw new Error(v.errors.join("; ")); return v.spec; };

  return async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return json({ ok: true, llm: llm.name });
    const tenant = auth(req);
    if (!tenant) return err(401, "Unauthorized");

    const route = url.pathname.split("/").filter(Boolean); // v1 apps [id [action]]
    if (route[0] !== "v1" || route[1] !== "apps") return err(404, "Not found");
    const [, , appId, action] = route;

    try {
      if (!appId && req.method === "POST") {
        const body = CreateBody.safeParse(await req.json().catch(() => null));
        if (!body.success) return err(400, "Invalid request body");
        const r = await generateApp(body.data.prompt, { llm, locale: body.data.locale, cache });
        const id = randomUUID();
        const log = new RevisionLog<AppSpec>(r.spec, validate);
        appsOf(tenant).set(id, log);
        return json({ ...view(id, log), costUsd: r.costUsd, cached: r.cached }, 201);
      }
      if (!appId && req.method === "GET") return json({ apps: [...appsOf(tenant)].map(([id, l]) => ({ id, name: l.current.name })) });

      const log = appId ? appsOf(tenant).get(appId) : undefined;
      if (!appId || !log) return err(404, "App not found");

      if (!action && req.method === "GET") return json(view(appId, log));
      if (action === "chat" && req.method === "POST") {
        const body = ChatBody.safeParse(await req.json().catch(() => null));
        if (!body.success) return err(400, "Invalid request body");
        const r = await iterateApp(log.current, body.data.message, { llm });
        if (r.ops.length === 0) return json({ ...view(appId, log), changes: [], note: "No change was needed." });
        log.commit(r.ops, { label: body.data.message.slice(0, 80), source: "ai" });
        return json({ ...view(appId, log), changes: r.changes, costUsd: r.costUsd });
      }
      if (action === "undo" && req.method === "POST") { log.undo(); return json(view(appId, log)); }
      if (action === "redo" && req.method === "POST") { log.redo(); return json(view(appId, log)); }
      return err(404, "Not found");
    } catch (e) {
      if (e instanceof GenerationError) return err(422, e.message, e.errors);
      console.error(e);
      return err(500, "Internal error");
    }
  };
}
