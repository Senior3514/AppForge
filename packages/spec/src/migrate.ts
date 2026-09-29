import { SPEC_VERSION } from "./schema";

export type Migration = (spec: Record<string, unknown>) => Record<string, unknown>;
/** migrations[n] upgrades a version-n document to version n+1. */
export type MigrationTable = Record<number, Migration>;

export const MIGRATIONS: MigrationTable = {};

export function migrateSpec(raw: unknown, migrations: MigrationTable = MIGRATIONS, target = SPEC_VERSION): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null) throw new Error("spec must be an object");
  let doc = raw as Record<string, unknown>;
  let v = doc.version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) throw new Error("spec.version must be a positive integer");
  if (v > target) throw new Error(`spec version ${v} is newer than supported ${target}`);
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new Error(`no migration from version ${v}`);
    doc = { ...step(doc), version: v + 1 };
    v += 1;
  }
  return doc;
}
