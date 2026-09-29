import { z } from "zod";
import { GenerationError, generateApp } from "@appforge/generator";
import { LOCALES } from "@appforge/i18n";
import { cache, json, llm } from "../../../lib/server";

const Body = z.object({ prompt: z.string(), locale: z.enum(LOCALES).optional() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid request body" }, 400);
  try {
    const r = await generateApp(body.data.prompt, { llm, locale: body.data.locale, cache });
    return json({ spec: r.spec, costUsd: r.costUsd, cached: r.cached });
  } catch (e) {
    if (e instanceof GenerationError) return json({ error: e.message, details: e.errors }, 422);
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
}
