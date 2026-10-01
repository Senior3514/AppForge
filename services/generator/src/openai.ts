import type { LlmClient, LlmRequest, LlmResult } from "./llm";

interface Options { apiKey: string; model: string; baseUrl: string; name: string; headers?: Record<string, string>; fetchImpl?: typeof fetch }

/** Chat-completions adapter (OpenRouter, OpenAI and compatible APIs): forces one function call so the reply is schema-shaped JSON. */
export class OpenAiCompatLlm implements LlmClient {
  readonly name: string;
  constructor(private o: Options) { this.name = `${o.name}:${o.model}`; }

  async run(req: LlmRequest): Promise<LlmResult> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.o.baseUrl}/chat/completions`, {
      method: "POST",
      signal: AbortSignal.timeout(120_000),
      headers: { "content-type": "application/json", authorization: `Bearer ${this.o.apiKey}`, ...this.o.headers },
      body: JSON.stringify({
        model: this.o.model,
        max_tokens: 8000,
        messages: [{ role: "system", content: req.system }, { role: "user", content: req.user }],
        tools: [{ type: "function", function: { name: "emit", description: "Return the result as structured JSON.", parameters: req.schema } }],
        tool_choice: { type: "function", function: { name: "emit" } },
      }),
    });
    if (!res.ok) throw new Error(`${this.o.name} API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null; tool_calls?: { function?: { arguments?: string } }[] } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const msg = body.choices?.[0]?.message;
    // Some models ignore tool_choice and answer in prose/JSON; accept a JSON object in the content as a fallback.
    const raw = msg?.tool_calls?.[0]?.function?.arguments ?? stripFence(msg?.content ?? "");
    if (!raw) throw new Error("model returned no structured output");
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error("model returned invalid JSON"); }
    return { json: parsed, usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0 } };
  }
}

const stripFence = (s: string) => s.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
