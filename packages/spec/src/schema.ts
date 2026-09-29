import { z } from "zod";
import { LOCALES } from "@appforge/i18n";

export const SPEC_VERSION = 1;

export const idSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,39}$/, "id must be lower-kebab, start with a letter");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be #rrggbb");

export const ThemeSchema = z.object({
  primary: hexColor,
  radius: z.number().min(0).max(32),
  font: z.enum(["modern", "classic", "rounded"]),
});

export const DataModelSchema = z.object({
  id: idSchema,
  fields: z.array(z.object({
    name: idSchema,
    type: z.enum(["text", "number", "boolean", "date", "image", "email", "phone"]),
  })).min(1).max(20),
  /** Sandbox rows shown in previews; production data lives in the backend. */
  seed: z.array(z.record(z.union([z.string(), z.number(), z.boolean()]))).max(20),
});
export type DataModel = z.infer<typeof DataModelSchema>;

/**
 * Builds the full AppSpec schema around a caller-supplied block schema.
 * The module library owns block schemas (packages/modules), so the envelope
 * stays independent of which modules exist.
 */
export function makeAppSpecSchema<B extends z.ZodTypeAny>(block: B) {
  const screen = z.object({
    id: idSchema,
    title: z.string().min(1).max(40),
    icon: z.string().min(1).max(30),
    blocks: z.array(block).max(20),
  });
  return z.object({
    version: z.literal(SPEC_VERSION),
    name: z.string().min(1).max(40),
    tagline: z.string().max(120),
    locale: z.enum(LOCALES),
    theme: ThemeSchema,
    /** Tab bar order; every entry must be a screen id. */
    navigation: z.array(idSchema).min(1).max(5),
    screens: z.array(screen).min(1).max(8),
    dataModels: z.array(DataModelSchema).max(10),
    /** translations[locale][sourceText] = translated text. Source text is in `locale`. */
    translations: z.record(z.enum(LOCALES), z.record(z.string())),
    features: z.object({ payments: z.boolean(), push: z.boolean(), analytics: z.boolean() }),
  });
}
