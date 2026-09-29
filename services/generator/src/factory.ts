import { AnthropicLlm } from "./anthropic";
import { MockLlm } from "./mock";
import type { LlmClient } from "./llm";

/** Real adapter only when the flag AND the key are set; otherwise the mock, so the app boots with zero keys. */
export function createLlm(env: Record<string, string | undefined> = process.env): LlmClient {
  if (env.APPFORGE_FLAG_REAL_LLM === "true" && env.ANTHROPIC_API_KEY)
    return new AnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL });
  return new MockLlm();
}
