"use client";
import type { DatasetProfile } from "@/store/useStore";

export function DatasetReview({ rows, profile }: { rows: Record<string, unknown>[]; profile?: DatasetProfile }) {
  const columns = Object.keys(rows[0] || {});
  if (!columns.length) return null;
  return <details className="rounded-xl border border-border bg-surface p-4">
    <summary className="cursor-pointer font-semibold">Review prepared data</summary>
    <p className="mt-2 text-sm text-text-secondary">This preview is the cleaned dataset used for every calculation. Check the column names and sample values before relying on results.</p>
    {profile ? <div className="mt-3 flex flex-wrap gap-2 text-xs">{profile.fields.map(field => <span key={field.name} className="rounded bg-background px-2 py-1 text-text-secondary">{field.name}: {field.kind} · {field.populated}/{profile.records} filled</span>)}</div> : null}
    <div className="mt-3 overflow-x-auto"><table className="w-full min-w-max text-left text-xs"><thead className="border-b border-border text-text-muted"><tr>{columns.map(column => <th className="px-2 py-2 font-semibold" key={column}>{column}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map((row, index) => <tr className="border-b border-border/50" key={index}>{columns.map(column => <td className="max-w-48 truncate px-2 py-2 text-text-secondary" title={String(row[column] ?? "")} key={column}>{String(row[column] ?? "—")}</td>)}</tr>)}</tbody></table></div>
  </details>;
}
