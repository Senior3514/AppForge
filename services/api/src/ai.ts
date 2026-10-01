import { AI_PROVIDERS, createUserLlm, isAiProvider, type AiProvider, type LlmClient } from "@appforge/generator";
import type { Deps } from "./deps";
import { HttpError } from "./http";

export type AiSource = "user" | "platform" | "mock";
export interface ResolvedLlm { llm: LlmClient; source: AiSource; provider?: AiProvider; model?: string }

/** Which model serves this tenant: their own key first, then the platform's, then the built-in mock generator. */
export async function llmFor(d: Deps, tenantId: string): Promise<ResolvedLlm> {
  const row = (await d.db.asTenant(tenantId, (q) => q("select provider, model, key_enc from ai_providers"))).rows[0];
  if (row && isAiProvider(row.provider)) {
    if (!d.sealer) throw new HttpError(503, "Saved AI keys are unavailable: the server has no APPFORGE_SECRET");
    let key: string;
    try { key = d.sealer.open(row.key_enc); }
    catch { throw new HttpError(409, "Your saved AI key can no longer be read. Please enter it again in Settings."); }
    return { llm: createUserLlm(row.provider, row.model, key, d.fetchImpl), source: "user", provider: row.provider, model: row.model };
  }
  return { llm: d.llm, source: d.llm.name === "mock" ? "mock" : "platform" };
}

export async function recordUsage(d: Deps, tenantId: string, task: string, source: AiSource, usage: { inputTokens: number; outputTokens: number }, costUsd: number) {
  await d.db.asTenant(tenantId, (q) => q(
    "insert into ai_usage (tenant_id, task, source, input_tokens, output_tokens, cost_usd) values ($1,$2,$3,$4,$5,$6)",
    [tenantId, task, source, usage.inputTokens, usage.outputTokens, costUsd]));
}

/** Provider failures are the user's to fix (bad key, no credit, wrong model), so say so instead of a generic 500. */
export function providerError(r: ResolvedLlm, e: unknown): HttpError {
  const label = r.provider ? AI_PROVIDERS[r.provider].label : "AI";
  return new HttpError(502, `Your ${label} account returned an error: ${(e as Error).message.slice(0, 240)}`, { code: "provider_error" });
}
