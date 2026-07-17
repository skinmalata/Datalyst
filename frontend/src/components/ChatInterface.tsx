"use client";
import { api } from "@/lib/api-client";
import { useStore } from "@/store/useStore";
import { suggestQueries } from "@/lib/suggest-queries";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { QueryInput } from "./QueryInput";
import { ChartViewer } from "./ChartViewer";

function formatNum(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
}

function formatResult(output: any, question: string): string {
  const evidence = output.evidence || {};
  const recordsInput = evidence.recordsInput || 0;
  const recordsMatched = evidence.recordsMatched || recordsInput;
  const method = output.method || "";
  const parts: string[] = [];

  if (output.values?.length) {
    if (output.anomalies || output.values[0]?.zScore !== undefined) {
      const count = output.values.length;
      parts.push(`I found **${count} unusual ${count === 1 ? "value" : "values"}** in your data.`);
      parts.push("");
      output.values.slice(0, 5).forEach((a: any, i: number) => {
        const label = a.label || a.row ? Object.entries(a.row || {}).map(([k, v]) => `${k}: ${v}`).join(", ") : `Record ${a.recordIndex + 1}`;
        parts.push(`${i + 1}. **${formatNum(a.value)}** (${a.zScore > 0 ? "high" : "low"} outlier — ${Math.abs(a.zScore)}× from average) — ${label}`);
      });
      if (output.values.length > 5) parts.push(`\n...and ${output.values.length - 5} more.`);
    } else {
      const total = output.values.reduce((s: number, v: any) => s + v.value, 0);
      const top = output.values[0];
      const pct = total > 0 ? ((top.value / total) * 100).toFixed(1) : "—";
      parts.push(`Here are the **top ${output.values.length} results**, ranked from highest to lowest.`);
      parts.push("");
      output.values.forEach((v: any, i: number) => {
        const share = total > 0 ? ((v.value / total) * 100).toFixed(1) : "—";
        parts.push(`${i + 1}. **${v.label}** — ${formatNum(v.value)} (${share}% of total)`);
      });
      parts.push("");
      parts.push(`Together, these ${output.values.length} groups account for **100%** of the total ${formatNum(total)}.`);
    }
  } else if (output.value !== undefined) {
    const val = output.value;
    parts.push(`The **${output.operation === "average" ? "average" : "total"}** is **${formatNum(val)}**.`);
    if (output.comparison) {
      const { baseline, difference, percentChange } = output.comparison;
      const direction = difference > 0 ? "higher" : "lower";
      parts.push(`\nFor comparison, the baseline is **${formatNum(baseline)}**. This result is **${formatNum(Math.abs(difference))} ${direction}** (${percentChange !== null ? (percentChange > 0 ? "+" : "") + percentChange.toFixed(1) + "%" : "N/A"}).`);
    }
  } else {
    parts.push(`Analysis complete. See the chart below for details.`);
  }

  if (recordsInput > 0) {
    parts.push("");
    parts.push(`---`);
    const filterNote = evidence.filters?.length ? ` After applying your filters, ${recordsMatched} of ${recordsInput} records matched.` : ` Based on ${recordsMatched} records in your dataset.`;
    parts.push(`*${filterNote} Method: ${method}.*`);
  }

  return parts.join("\n");
}

export function ChatInterface() {
  const { datasetId, rows, messages, add, setLoading, loading } = useStore();
  const questions = suggestQueries(rows);

  const ask = async (question: string) => {
    add({ id: crypto.randomUUID(), role: "user", content: question });
    setLoading(true);
    try {
      const plan = await api<any>("/api/analyses/plan", { method: "POST", body: JSON.stringify({ datasetId, question }) });
      const result = await api<any>("/api/analyses", { method: "POST", body: JSON.stringify({ datasetId, question, plan }) });
      const output = result.result;
      const values = output.values || [];
      add({
        id: crypto.randomUUID(),
        role: "assistant",
        content: formatResult({ ...output, values, operation: plan.operation }, question),
        values: values.length && !values[0]?.zScore ? values : undefined,
      });
    } catch (error) {
      add({ id: crypto.randomUUID(), role: "assistant", content: error instanceof Error ? error.message : "Analysis could not be completed." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {questions.map(({ question, description }) => (
          <button key={question} onClick={() => ask(question)} className="rounded-lg border border-border bg-surface p-4 text-left">
            <b>{question}</b>
            <span className="mt-1 block text-sm text-text-muted">{description}</span>
          </button>
        ))}
      </div>
      {messages.map(message => (
        <article key={message.id} className={message.role === "user" ? "ml-12 rounded-xl bg-primary p-4" : "mr-12 rounded-xl bg-surface p-4"}>
          {message.role === "assistant"
            ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            : <p>{message.content}</p>
          }
          {message.values?.length ? <ChartViewer data={message.values} /> : null}
        </article>
      ))}
      {loading ? <p className="text-text-muted">Analyzing your data…</p> : null}
      <QueryInput disabled={!datasetId || loading} onSubmit={ask} />
    </div>
  );
}
