"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api-client";

type Kpi = { label: string; value: string; change?: string; positive?: boolean };
type Section = { title: string; type: string; content: string };
type Table = { title: string; headers: string[]; rows: string[][] };
type Report = {
  title: string;
  summary: string;
  kpis: Kpi[];
  sections: Section[];
  tables: Table[];
  recommendations: string[];
  warnings: string[];
};

function fmtMd(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
}

type Props = { open: boolean; onClose: () => void };

export function ReportViewer({ open, onClose }: Props) {
  const { datasetId, rows, profile } = useStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => setVisible(true), 50);
      fetchReport();
    } else {
      setVisible(false);
    }
  }, [open]);

  const fetchReport = async () => {
    if (!datasetId) return;
    setLoading(true);
    try {
      const data = await api<Report>(`/api/datasets/${datasetId}/report`);
      setReport(data);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 300);
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Close button */}
      <button
        onClick={close}
        className="fixed right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-xl text-text-secondary hover:text-white"
      >
        ×
      </button>

      <div className="mx-auto max-w-4xl px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-3 border-border border-t-primary" />
            <p className="text-sm text-text-muted">Analyzing your data across all dimensions...</p>
          </div>
        ) : report ? (
          <div>
            {/* Header */}
            <div className="mb-8">
              <p className="mb-2 text-xs font-bold tracking-widest text-primary">ANALYSIS REPORT</p>
              <h2 className="mb-3 text-2xl font-bold">{report.title}</h2>
              <p className="text-sm leading-relaxed text-text-secondary">{report.summary}</p>
              <p className="mt-2 font-mono text-xs text-text-muted">
                {rows.length.toLocaleString()} records · {Object.keys(rows[0] || {}).length} fields
              </p>
            </div>

            {/* KPIs */}
            {report.kpis.length > 0 && (
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {report.kpis.map((kpi) => (
                  <div key={kpi.label} className="rounded-xl border border-border bg-surface p-4 text-center">
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-text-muted">{kpi.label}</p>
                    <p className={`text-xl font-bold ${kpi.positive === true ? "text-green-400" : kpi.positive === false ? "text-red-400" : "text-white"}`}>
                      {kpi.value}
                    </p>
                    {kpi.change && <p className="mt-1 text-xs text-text-muted">{kpi.change}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Warnings */}
            {report.warnings.length > 0 && (
              <div className="mb-8 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-amber-300">⚠ Risks to Investigate</h3>
                {report.warnings.map((w, i) => (
                  <p key={i} className="mb-2 text-sm leading-relaxed text-text-secondary last:mb-0">{w}</p>
                ))}
              </div>
            )}

            {/* Sections */}
            {report.sections.map((sec, i) => {
              if (sec.title === "Executive Summary") return null;
              const icon = sec.type === "recommendation" ? "→" : sec.type === "warning" ? "⚠" : sec.type === "finding" ? "✦" : "·";
              const borderColor = sec.type === "recommendation" ? "border-l-green-400" : sec.type === "warning" ? "border-l-amber-400" : "border-l-primary";
              return (
                <div key={i} className={`mb-5 rounded-xl border border-border border-l-4 ${borderColor} bg-surface p-4`}>
                  <h3 className="mb-2 text-sm font-semibold">{icon} {sec.title}</h3>
                  <div className="text-sm leading-relaxed text-text-secondary" dangerouslySetInnerHTML={{ __html: fmtMd(sec.content) }} />
                </div>
              );
            })}

            {/* Tables */}
            {report.tables.map((tbl, i) => (
              <div key={i} className="mb-6">
                <h3 className="mb-2 font-mono text-xs tracking-wider text-text-muted">{tbl.title}</h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {tbl.headers.map((h) => (
                          <th key={h} className="px-4 py-2 text-left font-mono text-[10px] tracking-wider text-text-muted uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tbl.rows.map((row, ri) => (
                        <tr key={ri} className={`border-b border-border/50 ${ri === 0 ? "font-semibold text-white" : "text-text-secondary"}`}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-2 whitespace-nowrap">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div className="mb-6 rounded-xl border border-green-400/20 bg-green-400/5 p-4">
                <h3 className="mb-3 text-sm font-semibold text-green-400">→ Prioritized Recommendations</h3>
                <ol className="list-decimal space-y-2 pl-5">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="text-sm leading-relaxed text-text-secondary">{r}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 border-t border-border pt-4 text-xs text-text-muted italic">
              Decision note: This report is based on recorded values in the uploaded dataset. Add cost, margin, and refund amounts to evaluate profitability rather than revenue alone.
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-text-muted">
            <p>Could not generate a report from this data.</p>
            <button onClick={close} className="mt-4 rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
