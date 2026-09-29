import type { z } from "zod";

/**
 * Data contract for a module. Renderers (React Native, web preview, admin editor) and
 * backend handlers are attached in later phases; they key off `id` and validated `props`.
 */
export interface ModuleDef<S extends z.ZodTypeAny = z.ZodTypeAny, I extends string = string> {
  id: I;
  title: string;
  description: string;
  props: S;
  defaults: z.infer<S>;
  /** Data model ids the module reads or writes; validated against AppSpec.dataModels. */
  collections(props: z.infer<S>): string[];
  /** Platform features the module needs switched on in AppSpec.features. */
  requires: ReadonlyArray<"payments" | "push">;
}

export const defineModule = <I extends string, S extends z.ZodTypeAny>(def: ModuleDef<S, I>): ModuleDef<S, I> => def;
