import { z } from "zod";
import { AI_PROVIDERS, isAiProvider } from "@appforge/generator";
import { requireSession } from "../auth";
import { llmFor } from "../ai";
import type { Deps } from "../deps";
import { HttpError, json, type Router } from "../http";

const KeyBody = z.object({
  provider: z.string().refine(isAiProvider, "Unknown provider"),
  model: z.string().trim().regex(/^[\w.:/-]{1,100}$/, "Model names use letters, digits and . : / - _ only"),
  apiKey: z.string().trim().regex(/^[\x21-\x7e]{8,400}$/, "That does not look like an API key").optional(),
});

const parse = <T,>(schema: z.ZodType<T>, data: unknown): T => {
  const r = schema.safeParse(data);
  if (!r.success) throw new HttpError(400, r.error.issues[0]?.message ?? "Invalid request", r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
  return r.data;
};

/** Bring-your-own-key console: each workspace can run generation on its own OpenRouter / Anthropic / OpenAI account. */
export function aiRoutes(r: Router, d: Deps) {
  const owner = async (c: Parameters<typeof requireSession>[1]) => {
    const s = await requireSession(d.db, c);
    if (s.anonymous) throw new HttpError(403, "Create an account to manage AI keys");
    return s;
  };

  r.get("/v1/ai", async (c) => {
    const s = await owner(c);
    const { row, usage } = await d.db.asTenant(s.tenantId, async (q) => ({
      row: (await q("select provider, model, key_last4, last_test_at, last_test_ok, last_test_error, updated_at from ai_providers")).rows[0],
      usage: (await q("select source, count(*)::int as calls, coalesce(sum(input_tokens),0)::int as input, coalesce(sum(output_tokens),0)::int as output, coalesce(sum(cost_usd),0)::float as cost from ai_usage where at > now() - interval '30 days' group by source")).rows,
    }));
    return json({
      providers: Object.entries(AI_PROVIDERS).map(([id, p]) => ({ id, label: p.label, defaultModel: p.defaultModel })),
      keysAvailable: !!d.sealer,
      platform: d.llm.name,
      active: row ? "user" : d.llm.name === "mock" ? "mock" : "platform",
      key: row ? {
        provider: row.provider, model: row.model, last4: row.key_last4, updatedAt: new Date(row.updated_at).toISOString(),
        test: row.last_test_at ? { at: new Date(row.last_test_at).toISOString(), ok: row.last_test_ok, error: row.last_test_error } : null,
      } : null,
      usage30d: usage,
    });
  });

  r.put("/v1/ai", async (c) => {
    const s = await owner(c);
    if (!d.sealer) throw new HttpError(503, "This server has no APPFORGE_SECRET, so it cannot store keys safely");
    const body = parse(KeyBody, await c.body());
    const existing = (await d.db.asTenant(s.tenantId, (q) => q("select 1 from ai_providers"))).rows[0];
    if (!body.apiKey && !existing) throw new HttpError(400, "Enter your API key");
    if (body.apiKey) {
      await d.db.asTenant(s.tenantId, (q) => q(
        `insert into ai_providers (tenant_id, provider, model, key_enc, key_last4, updated_at) values ($1,$2,$3,$4,$5, now())
         on conflict (tenant_id) do update set provider=$2, model=$3, key_enc=$4, key_last4=$5, updated_at=now(), last_test_at=null, last_test_ok=null, last_test_error=null`,
        [s.tenantId, body.provider, body.model, d.sealer!.seal(body.apiKey!), body.apiKey!.slice(-4)]));
    } else {
      // Model/provider change without re-entering the key is only valid within the same provider (a key is not portable).
      const res = await d.db.asTenant(s.tenantId, (q) => q("update ai_providers set model=$2, updated_at=now(), last_test_at=null, last_test_ok=null, last_test_error=null where provider=$1 returning 1", [body.provider, body.model]));
      if (!res.rows[0]) throw new HttpError(400, "Enter the API key for the new provider");
    }
    return json({ ok: true });
  });

  r.delete("/v1/ai", async (c) => {
    const s = await owner(c);
    await d.db.asTenant(s.tenantId, (q) => q("delete from ai_providers"));
    return json({ ok: true });
  });

  // Makes one tiny real call so a wrong key / model / empty balance shows up here, not in the middle of building an app.
  r.post("/v1/ai/test", async (c) => {
    const s = await owner(c);
    if (!d.limiter.allow(`ai-test:${s.tenantId}`, 10, 3_600_000)) throw new HttpError(429, "Too many tests. Try again later.");
    const resolved = await llmFor(d, s.tenantId);
    if (resolved.source !== "user") throw new HttpError(400, "No personal key is saved yet");
    let ok = true; let error: string | null = null;
    try {
      await resolved.llm.run({
        task: "patch", system: "Call the tool with ok=true.", user: "ping",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
        meta: { prompt: "ping", locale: "en" },
      });
    } catch (e) { ok = false; error = (e as Error).message.slice(0, 300); }
    await d.db.asTenant(s.tenantId, (q) => q("update ai_providers set last_test_at=now(), last_test_ok=$1, last_test_error=$2", [ok, error]));
    return json({ ok, error });
  });
}
