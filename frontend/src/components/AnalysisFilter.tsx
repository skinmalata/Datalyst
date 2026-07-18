"use client";
import { useMemo, useState } from "react";

export type ManualFilter = { field: string; operator: "equals"; value: string };

export function AnalysisFilter({ rows, value, onChange }: { rows: Record<string, unknown>[]; value?: ManualFilter; onChange: (filter?: ManualFilter) => void }) {
  const fields = useMemo(() => Object.keys(rows[0] || {}).filter(field => {
    const unique = new Set(rows.map(row => String(row[field] ?? "")).filter(Boolean));
    return unique.size > 1 && unique.size <= 30;
  }), [rows]);
  const [field, setField] = useState(value?.field || "");
  const choices = useMemo(() => Array.from(new Set(rows.map(row => String(row[field] ?? "")).filter(Boolean))).slice(0, 30), [rows, field]);
  const [selected, setSelected] = useState(value?.value || "");
  if (!fields.length) return null;
  const apply = () => selected && field ? onChange({ field, operator: "equals", value: selected }) : onChange(undefined);
  return <section className="rounded-xl border border-border bg-surface p-4"><div className="flex flex-wrap items-end gap-3"><div><p className="text-sm font-semibold">Analyze a specific slice</p><p className="mt-1 text-xs text-text-muted">Optional: filter every question by one business dimension.</p></div><label className="ml-auto text-xs text-text-secondary">Field<select value={field} onChange={event => { setField(event.target.value); setSelected(""); }} className="mt-1 block rounded border border-border bg-background p-2 text-sm text-white"><option value="">Choose a field</option>{fields.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label className="text-xs text-text-secondary">Value<select value={selected} disabled={!field} onChange={event => setSelected(event.target.value)} className="mt-1 block rounded border border-border bg-background p-2 text-sm text-white disabled:opacity-50"><option value="">Choose a value</option>{choices.map(item => <option key={item} value={item}>{item}</option>)}</select></label><button onClick={apply} className="rounded bg-primary px-3 py-2 text-sm font-semibold">{selected ? "Apply filter" : "Clear filter"}</button></div>{value ? <p className="mt-3 text-sm text-primary">Active filter: {value.field} = {value.value}</p> : null}</section>;
}
