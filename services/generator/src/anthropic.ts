import type { LlmClient, LlmRequest, LlmResult } from "./llm";

interface Options { apiKey: string; model?: string; baseUrl?: string; fetchImpl?: typeof fetch }

/** Real adapter: forces a single tool call so the response is JSON matching the schema. */
export class AnthropicLlm implements LlmClient {
  readonly name = "anthropic";
  constructor(private o: Options) {}

  async run(req: LlmRequest): Promise<LlmResult> {
    const f = this.o.fetchImpl ?? fetch;
    const res = await f(`${this.o.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": this.o.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: this.o.model ?? "claude-sonnet-5-5",
        max_tokens: 8000,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        tools: [{ name: "emit", description: "Return the result as structured JSON.", input_schema: req.schema }],
        tool_choice: { type: "tool", name: "emit" },
      }),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const body = (await res.json()) as {
      content: { type: string; input?: unknown }[]; usage: { input_tokens: number; output_tokens: number };
    };
    const call = body.content.find((c) => c.type === "tool_use");
    if (!call) throw new Error("model returned no tool call");
    return { json: call.input, usage: { inputTokens: body.usage.input_tokens, outputTokens: body.usage.output_tokens } };
  }
}
