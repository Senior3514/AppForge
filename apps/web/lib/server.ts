import { createLlm, type GenerateResult } from "@appforge/generator";

/** One shared instance so the generation cache survives across requests in a server process. */
const g = globalThis as unknown as { __llm?: ReturnType<typeof createLlm>; __cache?: Map<string, GenerateResult> };
export const llm = (g.__llm ??= createLlm());
export const cache = (g.__cache ??= new Map<string, GenerateResult>());
export const json = (body: unknown, status = 200) => Response.json(body, { status });
