"use client";
import { api } from "@/lib/api-client";
import { generateSuggestedQueries } from "@/lib/query-suggestions";
import { chartForResult } from "@/lib/result-visualization";
import { useStore } from "@/store/useStore";
import { QueryInput } from "./QueryInput";
import { ChatMessage } from "./ChatMessage";

function formatValue(value: unknown, field = "", method = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value ?? "not available");
  if (/rate|margin|percent/i.test(field) && /average|grouped|trend|forecast/i.test(method)) return (number <= 1 ? number * 100 : number).toFixed(1) + "%";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(number);
}
function executiveAnswer(output: any, field = "") {
  const method = String(output.method || "calculation from the uploaded data"), records = output.evidence?.recordsMatched || output.recordsUsed || 0;
  if (output.forecast) {
    const total = Number.isFinite(Number(output.totalForecast)) ? output.totalForecast : output.forecast.reduce((sum: number, value: number) => sum + Number(value || 0), 0);
    return "**Outlook:** Based on our available history, the projected total is **" + formatValue(total, field, method) + "**.\n\n- Method: " + method + "\n- Validation error: " + output.validation?.mapePercent + "% MAPE across " + output.validation?.holdoutPeriods + " held-out periods\n- Treat this as a directional estimate, not a guarantee.";
  }
  if (output.trend) {
    const change = output.trend.percentChange === null ? "not available" : formatValue(output.trend.percentChange, "percent", "average");
    return "**Trend:** Our " + field + " moved from **" + formatValue(output.trend.first, field, method) + "** to **" + formatValue(output.trend.last, field, method) + "** across " + output.trend.periods + " observed periods.\n\n- Change: " + change + "\n- Evidence: " + records + " matched records\n- Method: " + method;
  }
  if (Array.isArray(output.values)) {
    const first = output.values[0];
    if (!first) return "No matching values were found. We checked " + records + " records using " + method + ".";
    const label = first.label || "the leading record", value = formatValue(first.value, field, method);
    const lead = /lowest|bottom|weakest/i.test(method) ? "lowest-performing" : "leading";
    return "**Key finding:** Our " + lead + " result is **" + label + "** at **" + value + "**.\n\n- Method: " + method + "\n- Evidence: " + records + " matched records\n- Review the chart for the full set of contributors.";
  }
  if (output.comparison) return "**Result:** " + formatValue(output.value, field, method) + "\n\n- Change from baseline: " + formatValue(output.comparison.percentChange, "percent", "average") + "\n- Evidence: " + records + " matched records\n- Method: " + method;
  return "**Result:** " + formatValue(output.value, field, method) + "\n\n- Evidence: " + records + " matched records\n- Method: " + method;
}

export function ChatInterface() {
  const { datasetId, rows, profile, preparation, messages, add, setLoading, loading } = useStore();
  const questions = generateSuggestedQueries(rows);
  const ask = async (question: string) => {
    add({ id: crypto.randomUUID(), role: "user", content: question });
    setLoading(true);
    try {
      const plan = await api<any>("/api/analyses/plan", { method: "POST", body: JSON.stringify({ datasetId, question }) });
      const result = await api<any>("/api/analyses", { method: "POST", body: JSON.stringify({ datasetId, question, plan }) });
      const output = result.result, chart = chartForResult(output);
      add({ id: crypto.randomUUID(), role: "assistant", content: executiveAnswer(output, plan.field), ...chart });
    } catch (error) {
      add({ id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Analysis could not be completed." });
    } finally { setLoading(false); }
  };
  return <div className="mx-auto flex max-w-4xl flex-col gap-5">
    {preparation ? <section className="rounded-xl border border-border bg-surface p-4"><p className="font-semibold">Analyst preparation complete</p><p className="mt-1 text-sm text-text-secondary">Prepared {preparation.outputRows} of {preparation.inputRows} rows across {preparation.columns} columns.</p><ul className="mt-2 list-inside list-disc text-sm text-text-secondary">{preparation.transformations.map(change => <li key={change}>{change}</li>)}</ul></section> : null}
    {profile ? <section className="rounded-xl border border-border bg-surface p-4"><p className="font-semibold">Data readiness: {profile.completeness}% complete</p><p className="mt-1 text-sm text-text-secondary">{profile.records} records · {profile.columns} columns · {profile.duplicateRows} duplicate rows found</p>{profile.warnings.map(warning => <p className="mt-2 text-sm text-amber-300" key={warning}>Note: {warning}</p>)}</section> : null}
    <div><p className="mb-1 text-sm font-semibold text-text-secondary">Recommended leadership questions</p><p className="mb-3 text-sm text-text-muted">Ten questions tailored to the measures and business dimensions in your uploaded data.</p><div className="grid gap-2 sm:grid-cols-2">{questions.map(({ question, description }) => <button key={question} onClick={() => ask(question)} className="rounded-lg border border-border bg-surface p-4 text-left"><b>{question}</b><span className="mt-1 block text-sm text-text-muted">{description}</span></button>)}</div></div>
    {messages.map((message) => <ChatMessage key={message.id} role={message.role} content={message.content} values={message.values} chartType={message.chartType} />)}
    {loading ? <p className="text-text-muted">Checking your data…</p> : null}
    <QueryInput disabled={!datasetId || loading} onSubmit={ask} />
  </div>;
}
