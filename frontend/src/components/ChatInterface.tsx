"use client";
import { api } from "@/lib/api-client";
import { generateSuggestedQueries } from "@/lib/query-suggestions";
import { chartForResult } from "@/lib/result-visualization";
import { useStore } from "@/store/useStore";
import { QueryInput } from "./QueryInput";
import { ChartViewer } from "./ChartViewer";

function formatValue(value: unknown, method = "") {
  const number=Number(value);
  if(!Number.isFinite(number)) return String(value ?? "not available");
  if(/rate|margin|percent/i.test(method)) return (number<=1?number*100:number).toFixed(1)+"%";
  return new Intl.NumberFormat(undefined,{maximumFractionDigits:2}).format(number);
}
function executiveAnswer(output: any) {
  const method=String(output.method||"calculation from the uploaded data"), records=output.evidence?.recordsMatched||output.recordsUsed||0;
  if(output.forecast) return "Based on our available history, the projected total is "+formatValue(output.totalForecast,method)+". Method: "+method+". Validation error: "+output.validation?.mapePercent+"% MAPE across "+output.validation?.holdoutPeriods+" held-out periods. Treat this as a directional estimate, not a guarantee.";
  if(Array.isArray(output.values)) {
    const first=output.values[0];
    if(!first) return "No matching values were found. We checked "+records+" records using "+method+".";
    const label=first.label||"the leading record", value=formatValue(first.value,method);
    return "Our leading result is "+label+" at "+value+". This ranking uses "+method+" across "+records+" matched records. Review the chart for the full set of contributors.";
  }
  if(output.comparison) return "Our result is "+formatValue(output.value,method)+", a "+formatValue(output.comparison.percentChange,"percent")+" change from the selected baseline. We used "+records+" matched records and "+method+".";
  return "Our result is "+formatValue(output.value,method)+". We used "+records+" matched records and "+method+".";
}

export function ChatInterface() {
  const { datasetId, rows, messages, add, setLoading, loading } = useStore();
  const questions = generateSuggestedQueries(rows);
  const ask = async (question: string) => {
    add({ id: crypto.randomUUID(), role: "user", content: question });
    setLoading(true);
    try {
      const plan = await api<any>("/api/analyses/plan", { method: "POST", body: JSON.stringify({ datasetId, question }) });
      const result = await api<any>("/api/analyses", { method: "POST", body: JSON.stringify({ datasetId, question, plan }) });
      const output = result.result, chart = chartForResult(output);
      add({ id: crypto.randomUUID(), role: "assistant", content: executiveAnswer(output), ...chart });
    } catch (error) {
      add({ id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Analysis could not be completed." });
    } finally { setLoading(false); }
  };
  return <div className="mx-auto flex max-w-4xl flex-col gap-5"><div><p className="mb-1 text-sm font-semibold text-text-secondary">Recommended leadership questions</p><p className="mb-3 text-sm text-text-muted">Ten questions tailored to the measures and business dimensions in your uploaded data.</p><div className="grid gap-2 sm:grid-cols-2">{questions.map(({ question, description }) => <button key={question} onClick={() => ask(question)} className="rounded-lg border border-border bg-surface p-4 text-left"><b>{question}</b><span className="mt-1 block text-sm text-text-muted">{description}</span></button>)}</div></div>{messages.map((message) => <article key={message.id} className={message.role === "user" ? "ml-12 rounded-xl bg-primary p-4" : "mr-12 rounded-xl bg-surface p-4"}><p>{message.content}</p>{message.values?.length ? <div className="mt-4"><ChartViewer data={message.values} type={message.chartType} /></div> : null}</article>)}{loading ? <p className="text-text-muted">Checking your data…</p> : null}<QueryInput disabled={!datasetId || loading} onSubmit={ask} /></div>;
}
