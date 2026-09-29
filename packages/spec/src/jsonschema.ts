import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/** JSON Schema (draft-07, inlined refs) for LLM structured output and external tooling. */
export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const { $schema: _omit, ...rest } = zodToJsonSchema(schema, { $refStrategy: "none" }) as Record<string, unknown>;
  return rest;
}
