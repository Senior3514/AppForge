import { z } from "zod";
import { validateApp } from "@appforge/modules";
import { GenerationError, iterateApp } from "@appforge/generator";
import { json, llm } from "../../../lib/server";

const Body = z.object({ spec: z.unknown(), message: z.string() });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ error: "Invalid request body" }, 400);
  const current = validateApp(body.data.spec);
  if (!current.ok) return json({ error: "Invalid spec", details: current.errors }, 400);
  try {
    const r = await iterateApp(current.spec, body.data.message, { llm });
    return json({ spec: r.spec, ops: r.ops, changes: r.changes });
  } catch (e) {
    if (e instanceof GenerationError) return json({ error: e.message, details: e.errors }, 422);
    console.error(e);
    return json({ error: "Internal error" }, 500);
  }
}
