import { applyPatchOps, diff, type PatchOps } from "./patch";

export interface Revision {
  id: number;
  label: string;
  source: "ai" | "manual" | "system";
  patch: PatchOps;
  inverse: PatchOps;
  at: string;
}

/**
 * Linear revision history with undo/redo. Committing after an undo discards the redo branch.
 * Stores patch + inverse rather than snapshots so history stays small.
 */
export class RevisionLog<T> {
  private revisions: Revision[] = [];
  private cursor = 0; // number of applied revisions
  private nextId = 1;
  constructor(private base: T, private validate: (doc: T) => T = (d) => d) {}

  get current(): T {
    let doc = this.base;
    for (const r of this.revisions.slice(0, this.cursor)) doc = applyPatchOps(doc, r.patch);
    return doc;
  }
  get history(): readonly Revision[] { return this.revisions.slice(0, this.cursor); }
  get canUndo() { return this.cursor > 0; }
  get canRedo() { return this.cursor < this.revisions.length; }

  /** Applies ops to the current doc, validates, and records a revision. Returns the new doc. */
  commit(ops: PatchOps, meta: { label: string; source: Revision["source"] }): T {
    const before = this.current;
    const after = this.validate(applyPatchOps(before, ops));
    const rev: Revision = {
      id: this.nextId++, ...meta, patch: diff(before, after), inverse: diff(after, before), at: new Date().toISOString(),
    };
    this.revisions = [...this.revisions.slice(0, this.cursor), rev];
    this.cursor = this.revisions.length;
    return after;
  }
  undo(): T { if (this.canUndo) this.cursor -= 1; return this.current; }
  redo(): T { if (this.canRedo) this.cursor += 1; return this.current; }
}
