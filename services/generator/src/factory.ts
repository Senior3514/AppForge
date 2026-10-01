import { OpenAiCompatLlm } from "./openai";
import { AnthropicLlm } from "./anthropic";
import { MockLlm } from "./mock";
import type { LlmClient } from "./llm";

/** Real adapter only when the flag AND the key are set; otherwise the mock, so the app boots with zero keys. */
export function createLlm(env: Record<string, string | undefined> = process.env): LlmClient {
  if (env.APPFORGE_FLAG_REAL_LLM === "true" && env.ANTHROPIC_API_KEY)
    return new AnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
  return new MockLlm();
}

/** Providers a user may bring their own key for. Base URLs are fixed on purpose: a user-supplied URL would be an SSRF vector. */
export const AI_PROVIDERS = {
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "anthropic/claude-sonnet-4.5" },
  anthropic: { label: "Anthropic", baseUrl: "https://api.anthropic.com", defaultModel: "claude-sonnet-5-5" },
  openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o" },
} as const;
export type AiProvider = keyof typeof AI_PROVIDERS;
export const isAiProvider = (v: string): v is AiProvider => Object.hasOwn(AI_PROVIDERS, v);

export function createUserLlm(provider: AiProvider, model: string, apiKey: string, fetchImpl?: typeof fetch): LlmClient {
  const p = AI_PROVIDERS[provider];
  if (provider === "anthropic") return new AnthropicLlm({ apiKey, model, baseUrl: p.baseUrl, fetchImpl });
  return new OpenAiCompatLlm({ apiKey, model, baseUrl: p.baseUrl, name: provider, fetchImpl, headers: provider === "openrouter" ? { "x-title": "AppForge" } : undefined });
}
