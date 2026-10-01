"use client";
import { t, type Locale } from "@appforge/i18n";
import { dateTime } from "../lib/format";
import type { AppView } from "../lib/types";

/** Every change, AI or manual, is a revision. "Go back to here" replays undo/redo up to that point. */
export function HistoryPanel({ app, locale, jump, busy }: { app: AppView; locale: Locale; jump: (seq: number) => void; busy: boolean }) {
  const cursor = app.history.filter((h) => h.applied).length;
  return (
    <ol className="space-y-2 text-sm" aria-label={t(locale, "studio.history")}>
      {[...app.history].reverse().map((h) => (
        <li key={h.seq} className={`rounded-xl border p-3 ${h.applied ? "border-neutral-200" : "border-dashed border-neutral-300 opacity-60"}`}>
          <p className="font-medium">{h.label}</p>
          <p className="text-xs text-neutral-600">{t(locale, h.source === "ai" ? "studio.ai" : "studio.manual")} · {dateTime(h.at, locale)}</p>
          {h.seq !== cursor && <button disabled={busy} onClick={() => jump(h.seq)} className="mt-1 text-xs underline disabled:opacity-50">{t(locale, "studio.restore")}</button>}
        </li>
      ))}
      {app.history.length === 0 && <li className="text-neutral-600">—</li>}
    </ol>
  );
}
