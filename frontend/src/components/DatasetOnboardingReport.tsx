"use client";
import type { DatasetProfile } from "@/store/useStore";
import { generateSuggestedQueries } from "@/lib/query-suggestions";

function dateCoverage(rows: Record<string, unknown>[], field?: string) {
  if (!field) return null;
  const dates = rows.map(row => new Date(String(row[field] ?? ""))).filter(date => !Number.isNaN(date.getTime())).sort((a, b) => a.getTime() - b.getTime());
  if (!dates.length) return null;
  const format = new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" });
  return `${format.format(dates[0])} to ${format.format(dates[dates.length - 1])}`;
}

export function DatasetOnboardingReport({ rows, profile, onAsk }: { rows: Record<string, unknown>[]; profile?: DatasetProfile; onAsk: (question: string) => void }) {
  if (!profile) return null;
  const measures = profile.fields.filter(field => field.kind === "number");
  const dimensions = profile.fields.filter(field => field.kind === "category");
  const dateField = profile.fields.find(field => field.kind === "date");
  const coverage = dateCoverage(rows, dateField?.name);
  const questions = generateSuggestedQueries(rows).slice(0, 3);
  const readiness = profile.completeness >= 95 && !profile.duplicateRows ? "Ready for analysis" : "Review before relying on results";
  return <section className="rounded-2xl border border-primary/40 bg-surface p-5"><p className="text-xs font-semibold uppercase tracking-widest text-primary">Dataset onboarding report</p><h2 className="mt-2 text-xl font-bold">{readiness}</h2><p className="mt-2 text-sm text-text-secondary">This dataset has {profile.records.toLocaleString()} records and {profile.columns} fields. Datalyst found {measures.length} usable measure{measures.length === 1 ? "" : "s"}, {dimensions.length} business dimension{dimensions.length === 1 ? "" : "s"}, and {dateField ? "a time field" : "no reliable time field"}.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-text-muted">MEASURES AVAILABLE</p><p className="mt-1 text-sm text-white">{measures.length ? measures.map(field => field.name).join(", ") : "No reliable numeric measures detected"}</p></div><div className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-text-muted">BUSINESS DIMENSIONS</p><p className="mt-1 text-sm text-white">{dimensions.length ? dimensions.map(field => field.name).join(", ") : "No compact category fields detected"}</p></div><div className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-text-muted">TIME COVERAGE</p><p className="mt-1 text-sm text-white">{coverage || "Not available — trend and forecast analysis will be limited"}</p></div><div className="rounded-lg bg-background p-3"><p className="text-xs font-semibold text-text-muted">DATA QUALITY</p><p className="mt-1 text-sm text-white">{profile.completeness}% complete · {profile.duplicateRows} duplicate rows</p></div></div>{profile.warnings.length ? <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3"><p className="text-sm font-semibold text-amber-300">Analyst attention needed</p>{profile.warnings.map(warning => <p key={warning} className="mt-1 text-sm text-text-secondary">• {warning}</p>)}</div> : null}<div className="mt-4"><p className="text-sm font-semibold">Recommended starting questions</p><div className="mt-2 flex flex-wrap gap-2">{questions.map(item => <button key={item.question} onClick={() => onAsk(item.question)} className="rounded border border-border px-3 py-2 text-left text-sm text-text-secondary hover:border-primary hover:text-white">{item.question}</button>)}</div></div></section>;
}
