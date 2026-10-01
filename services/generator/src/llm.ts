import type { AppSpec } from "@appforge/modules";
import type { Locale } from "@appforge/i18n";

export interface LlmRequest {
  task: "generate" | "patch";
  system: string;
  /** User text, already wrapped as untrusted data by the pipeline. */
  user: string;
  /** JSON Schema the response must satisfy (root must be an object). */
  schema: Record<string, unknown>;
  /** Structured context for adapters that do not read prose (the mock). */
  meta: { prompt: string; locale: Locale; spec?: AppSpec; previousErrors?: string[] };
}
export interface LlmUsage { inputTokens: number; outputTokens: number }
export interface LlmResult { json: unknown; usage: LlmUsage }

export interface LlmClient { readonly name: string; run(req: LlmRequest): Promise<LlmResult> }
