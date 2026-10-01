import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

// zod-to-json-schema's generic signature recurses too deeply for some TS configs (e.g. Expo's); we only need the JSON out.
const convert = zodToJsonSchema as unknown as (s: ZodTypeAny, o: { $refStrategy: "none" }) => Record<string, unknown>;

/** JSON Schema (draft-07, inlined refs) for LLM structured output and external tooling. */
export function toJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const { $schema: _omit, ...rest } = convert(schema, { $refStrategy: "none" });
  return rest;
}
