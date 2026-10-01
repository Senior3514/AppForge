"use client";
import { useCallback, useEffect, useState } from "react";
import { t, type Locale } from "@appforge/i18n";
import type { AppSpec } from "@appforge/modules";
import { api } from "../../lib/api";
import { dateTime } from "../../lib/format";

interface Row { id: string; data: Record<string, unknown>; createdAt: string }

export function DataTab({ appId, spec, locale }: { appId: string; spec: AppSpec; locale: Locale }) {
  const collections = [...new Set(spec.screens.flatMap((s) => s.blocks).flatMap((b) => (b.module === "booking" ? [b.props.collection] : [])))];
  const [active, setActive] = useState(collections[0]);
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!active) return;
    setRows((await api<{ rows: Row[] }>(`/apps/${appId}/data/${active}`)).rows);
  }, [appId, active]);
  useEffect(() => { void load(); }, [load]);

  if (!active) return <p className="text-neutral-600">{t(locale, "data.noForms")}</p>;
  const cols = [...new Set((rows ?? []).flatMap((r) => Object.keys(r.data)))];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {collections.length > 1 && (
          <select aria-label="collection" value={active} onChange={(e) => setActive(e.target.value)} className="rounded border px-2 py-1 text-sm">
            {collections.map((c) => <option key={c}>{c}</option>)}
          </select>
        )}
        <a className="ms-auto rounded-full border border-neutral-300 px-4 py-1.5 text-sm" href={`/api/v1/apps/${appId}/data/${active}?format=csv&limit=500`}>{t(locale, "data.export")}</a>
      </div>
      {rows?.length === 0 && <p className="text-neutral-600">{t(locale, "data.empty")}</p>}
      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-start"><tr>
              <th className="p-2 text-start">{t(locale, "data.received")}</th>{cols.map((c) => <th key={c} className="p-2 text-start">{c}</th>)}<th />
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="whitespace-nowrap p-2">{dateTime(r.createdAt, locale)}</td>
                  {cols.map((c) => <td key={c} className="p-2">{String(r.data[c] ?? "")}</td>)}
                  <td className="p-2"><button className="text-red-700 underline" onClick={async () => { await api(`/apps/${appId}/data/${active}/${r.id}`, { method: "DELETE" }); await load(); }}>{t(locale, "dash.delete")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
