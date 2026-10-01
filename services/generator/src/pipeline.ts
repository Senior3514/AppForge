import { z } from "zod";
import { createHash } from "node:crypto";
import { AppSpecSchema, validateApp, type AppSpec } from "@appforge/modules";
import { applyPatchOps, describeOps, toJsonSchema, type PatchOps } from "@appforge/spec";
import { LOCALES, type Locale } from "@appforge/i18n";
import type { LlmClient, LlmUsage } from "./llm";
import { GENERATE_SYSTEM, PATCH_SYSTEM, wrapUntrusted } from "./prompts";

export const MAX_REPAIRS = 3;
export const MAX_PROMPT_CHARS = 4000;

export type Step = "understand" | "modules" | "theme" | "content" | "assemble";
export interface GenerateOptions {
  llm: LlmClient;
  locale?: Locale;
  onStep?: (s: Step) => void;
  cache?: Map<string, GenerateResult>;
  /** USD per million tokens; defaults are placeholders, set them from your provider's price list. */
  price?: { inputPerM: number; outputPerM: number };
}
export interface GenerateResult { spec: AppSpec; usage: LlmUsage; costUsd: number; repairs: number; cached: boolean }
export interface IterateResult { spec: AppSpec; ops: PatchOps; changes: string[]; usage: LlmUsage; costUsd: number; repairs: number }

export class GenerationError extends Error {
  constructor(message: string, readonly errors: string[] = []) { super(message); }
}

/** Strips control characters, trims and length-limits user text. Rejects empty input. */
export function sanitizePrompt(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const clean = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (!clean) throw new GenerationError("Please describe the app you want.");
  if (clean.length > MAX_PROMPT_CHARS) throw new GenerationError(`Description is too long (max ${MAX_PROMPT_CHARS} characters).`);
  return clean;
}

/** Hebrew script → Hebrew; anything else → English. The caller can always pass a locale explicitly. */
export function detectLocale(text: string): Locale {
  return /[\u0590-\u05FF]/.test(text) ? "he" : "en";
}

const PatchSchema = z.object({ ops: z.array(z.object({ op: z.enum(["add", "remove", "replace"]), path: z.string(), value: z.unknown().optional() })).max(40) });
const PATCH_JSON_SCHEMA = toJsonSchema(PatchSchema);
const SPEC_JSON_SCHEMA = toJsonSchema(AppSpecSchema);

const add = (a: LlmUsage, b: LlmUsage): LlmUsage => ({ inputTokens: a.inputTokens + b.inputTokens, outputTokens: a.outputTokens + b.outputTokens });
const cost = (u: LlmUsage, p = { inputPerM: 3, outputPerM: 15 }) => (u.inputTokens * p.inputPerM + u.outputTokens * p.outputPerM) / 1e6;

export async function generateApp(rawPrompt: string, o: GenerateOptions): Promise<GenerateResult> {
  const prompt = sanitizePrompt(rawPrompt);
  const locale = o.locale ?? detectLocale(prompt);
  const key = createHash("sha256").update(`${o.llm.name}|${locale}|${prompt}`).digest("hex");
  const hit = o.cache?.get(key);
  if (hit) return { ...hit, cached: true };

  o.onStep?.("understand"); o.onStep?.("modules"); o.onStep?.("theme");
  let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
  let errors: string[] | undefined;
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
    if (attempt === 0) o.onStep?.("content");
    const res = await o.llm.run({
      task: "generate", system: GENERATE_SYSTEM, schema: SPEC_JSON_SCHEMA,
      user: wrapUntrusted(prompt, `Target locale: ${locale}`, errors),
      meta: { prompt, locale, previousErrors: errors },
    });
    usage = add(usage, res.usage);
    const v = validateApp(res.json);
    if (v.ok) {
      o.onStep?.("assemble");
      const out: GenerateResult = { spec: v.spec, usage, costUsd: cost(usage, o.price), repairs: attempt, cached: false };
      o.cache?.set(key, out);
      return out;
    }
    errors = v.errors;
  }
  throw new GenerationError(`Could not produce a valid app after ${MAX_REPAIRS} repair attempts.`, errors);
}

export async function iterateApp(current: AppSpec, rawInstruction: string, o: GenerateOptions): Promise<IterateResult> {
  const instruction = sanitizePrompt(rawInstruction);
  let usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
  let errors: string[] | undefined;
  for (let attempt = 0; attempt <= MAX_REPAIRS; attempt++) {
    const res = await o.llm.run({
      task: "patch", system: PATCH_SYSTEM, schema: PATCH_JSON_SCHEMA,
      user: wrapUntrusted(instruction, `Current AppSpec:\n${JSON.stringify(current)}`, errors),
      meta: { prompt: instruction, locale: current.locale, spec: current, previousErrors: errors },
    });
    usage = add(usage, res.usage);
    const parsed = PatchSchema.safeParse(res.json);
    if (!parsed.success) { errors = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`); continue; }
    const ops = parsed.data.ops as PatchOps;
    try {
      const v = validateApp(applyPatchOps(current, ops));
      if (v.ok) return { spec: v.spec, ops, changes: describeOps(ops), usage, costUsd: cost(usage, o.price), repairs: attempt };
      errors = v.errors;
    } catch (e) { errors = [`patch could not be applied: ${(e as Error).message}`]; }
  }
  throw new GenerationError(`Could not apply that change after ${MAX_REPAIRS} repair attempts.`, errors);
}

export { LOCALES };
