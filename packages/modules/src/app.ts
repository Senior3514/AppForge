import { z } from "zod";
import { makeAppSpecSchema } from "@appforge/spec";
import { MODULES } from "./library";
import { idSchema } from "@appforge/spec";

const blockFor = <M extends (typeof MODULES)[number]>(m: M) =>
  z.object({ id: idSchema, module: z.literal(m.id), props: m.props as M["props"] });

const [first, second, ...rest] = MODULES.map(blockFor);
export const BlockSchema = z.discriminatedUnion("module", [first!, second!, ...rest]);
export const AppSpecSchema = makeAppSpecSchema(BlockSchema);
export type AppSpec = z.infer<typeof AppSpecSchema>;
export type Block = z.infer<typeof BlockSchema>;

/**
 * Full validation: shape (Zod) + cross-references the schema cannot express.
 * Returns human-readable errors suitable for feeding back to the LLM repair loop.
 */
export function validateApp(input: unknown): { ok: true; spec: AppSpec } | { ok: false; errors: string[] } {
  const parsed = AppSpecSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) };
  const spec = parsed.data;
  const errors: string[] = [];
  const dup = (label: string, ids: string[]) => {
    for (const id of new Set(ids.filter((x, i) => ids.indexOf(x) !== i))) errors.push(`duplicate ${label} id "${id}"`);
  };
  dup("screen", spec.screens.map((s) => s.id));
  dup("data model", spec.dataModels.map((d) => d.id));
  dup("block", spec.screens.flatMap((s) => s.blocks.map((b) => b.id)));

  const screens = new Set(spec.screens.map((s) => s.id));
  for (const id of spec.navigation) if (!screens.has(id)) errors.push(`navigation references unknown screen "${id}"`);
  dup("navigation entry", spec.navigation);

  const models = new Map(spec.dataModels.map((d) => [d.id, d]));
  for (const s of spec.screens) for (const b of s.blocks) {
    const def = MODULES.find((m) => m.id === b.module)!;
    for (const c of def.collections(b.props as never))
      if (!models.has(c)) errors.push(`block "${b.id}" (${b.module}) references unknown data model "${c}"`);
    for (const need of def.requires)
      if (!spec.features[need]) errors.push(`block "${b.id}" (${b.module}) requires features.${need} = true`);
    if ("titleField" in b.props) {
      const m = models.get(b.props.collection);
      const fields = new Set(m?.fields.map((f) => f.name));
      for (const f of [b.props.titleField, b.props.subtitleField]) if (f && m && !fields.has(f)) errors.push(`block "${b.id}" uses missing field "${f}" of "${m.id}"`);
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, spec };
}
