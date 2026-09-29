import jsonpatch, { type Operation } from "fast-json-patch";

export type PatchOps = Operation[];

/** Applies an RFC 6902 patch to a deep copy; throws on invalid pointers/tests. Never mutates the input. */
export function applyPatchOps<T>(doc: T, ops: PatchOps): T {
  const copy = structuredClone(doc);
  return jsonpatch.applyPatch(copy, ops, /* validate */ true, /* mutate */ true).newDocument as T;
}

export const diff = (from: unknown, to: unknown): PatchOps => jsonpatch.compare(from as object, to as object);

/** Readable one-line summaries of ops for the "what changed" diff in the chat. */
export function describeOps(ops: PatchOps): string[] {
  return ops.map((o) => {
    const where = o.path.split("/").slice(1).join(" › ") || "app";
    return o.op === "add" ? `Added ${where}` : o.op === "remove" ? `Removed ${where}` : o.op === "replace" ? `Changed ${where}` : `${o.op} ${where}`;
  });
}
