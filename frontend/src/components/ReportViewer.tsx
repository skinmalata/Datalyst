"use client";
import { useState, useEffect, useMemo } from "react";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api-client";
import {
  ReportBarChart, ReportHorizontalBar, ReportLineChart,
  ReportDonut, ReportMultiLine, ReportRadar,
  KpiCard, HeatmapTable, InsightCard,
} from "./ReportCharts";

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

function parseMoney(s: string): number {
  const clean = s.replace(/[$,%]/g, "").trim();
  if (clean.endsWith("M")) return parseFloat(clean) * 1_000_000;
  if (clean.endsWith("K")) return parseFloat(clean) * 1_000;
  return parseFloat(clean) || 0;
}

function parsePct(s: string): number {
  return parseFloat(s.replace("%", "")) || 0;
}

function tableHasRevenue(tbl: Table): boolean {
  return tbl.headers.some(h => /revenue|total|amount|sales/i.test(h));
}

function tableIsMonthly(tbl: Table): boolean {
  return /monthly|trend|over time/i.test(tbl.title);
}

function tableIsShare(tbl: Table): boolean {
  return /share|composition|breakdown/i.test(tbl.title);
}

// Convert a "Revenue by X" table into bar chart data
function tableToBarData(tbl: Table): { label: string; value: number }[] {
  const labelIdx = 0;
  const valueIdx = tbl.headers.findIndex(h => /revenue|total|amount|sales|value/i.test(h));
  if (valueIdx === -1) return [];
  return tbl.rows.map(r => ({ label: r[labelIdx], value: parseMoney(r[valueIdx]) })).filter(d => d.value > 0);
}

// Convert monthly table into line chart data
function tableToLineData(tbl: Table): { label: string; value: number }[] {
  const labelIdx = 0;
  const valueIdx = tbl.headers.findIndex(h => /revenue|total|amount|sales|value/i.test(h));
  if (valueIdx === -1) return [];
  return tbl.rows.map(r => ({ label: r[labelIdx], value: parseMoney(r[valueIdx]) })).filter(d => d.value > 0);
}

// Extract share/donut data from a table with Share column
function tableToDonutData(tbl: Table): { label: string; value: number }[] {
  const labelIdx = 0;
  const shareIdx = tbl.headers.findIndex(h => /share/i.test(h));
  const valueIdx = tbl.headers.findIndex(h => /revenue|total|amount|sales|value/i.test(h));
  if (shareIdx !== -1) {
    return tbl.rows.slice(0, 8).map(r => ({ label: r[labelIdx], value: parsePct(r[shareIdx]) })).filter(d => d.value > 0);
  }
  if (valueIdx !== -1) {
    return tbl.rows.slice(0, 8).map(r => ({ label: r[labelIdx], value: parseMoney(r[valueIdx]) })).filter(d => d.value > 0);
  }
  return [];
}

type Props = { open: boolean; onClose: () => void };

export function ReportViewer({ open, onClose }: Props) {
  const { datasetId, rows } = useStore();
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

  // Pre-compute chart data from tables
  const charts = useMemo(() => {
    if (!report) return { bar: [], donut: [], line: [], tablesWithoutChart: [] };

    const bar: { title: string; data: { label: string; value: number }[] }[] = [];
    const donut: { title: string; data: { label: string; value: number }[] }[] = [];
    const line: { title: string; data: { label: string; value: number }[] }[] = [];
    const tablesWithoutChart: Table[] = [];

    report.tables.forEach(tbl => {
      if (tableIsMonthly(tbl)) {
        const d = tableToLineData(tbl);
        if (d.length >= 2) { line.push({ title: tbl.title, data: d }); return; }
      }
      if (tableIsShare(tbl) || tableHasRevenue(tbl)) {
        const d = tableToBarData(tbl);
        if (d.length >= 2) {
          if (d.length <= 6) { donut.push({ title: tbl.title.replace("Revenue by", "Share:"), data: tableToDonutData(tbl) }); }
          bar.push({ title: tbl.title, data: d });
          return;
        }
      }
      // Fallback: try to extract bar data from any table with a numeric column
      const d = tableToBarData(tbl);
      if (d.length >= 2 && d.length <= 10) { bar.push({ title: tbl.title, data: d }); return; }
      tablesWithoutChart.push(tbl);
    });

    return { bar, donut, line, tablesWithoutChart };
  }, [report]);

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
      <button onClick={close} className="fixed right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-xl text-text-secondary hover:text-white">×</button>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {loading ? (
          <div className="flex flex-col items-center py-20">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-border border-t-primary" />
            <p className="text-sm text-text-muted">Analyzing your data across all dimensions...</p>
          </div>
        ) : report ? (
          <div className="space-y-8">
            {/* ── Report Header ── */}
            <div>
              <p className="mb-2 text-xs font-bold tracking-widest text-primary">ANALYSIS REPORT</p>
              <h2 className="mb-3 text-2xl font-bold">{report.title}</h2>
              <p className="text-sm leading-relaxed text-text-secondary">{report.summary}</p>
              <p className="mt-2 font-mono text-xs text-text-muted">{rows.length.toLocaleString()} records · {Object.keys(rows[0] || {}).length} fields</p>
            </div>

            {/* ── KPI Grid ── */}
            {report.kpis.length > 0 && (
              <div>
                <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">KEY METRICS</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {report.kpis.map(kpi => (
                    <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} change={kpi.change} positive={kpi.positive} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Warnings ── */}
            {report.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
                <p className="mb-3 text-sm font-semibold text-amber-300">⚠ Risks to Investigate</p>
                <div className="space-y-2">
                  {report.warnings.map((w, i) => (
                    <InsightCard key={i} icon="⚠" title="Risk" detail={w} color="amber" />
                  ))}
                </div>
              </div>
            )}

            {/* ── Charts: Line (trends) ── */}
            {charts.line.map((c, i) => (
              <ReportLineChart key={`line-${i}`} data={c.data} title={c.title} />
            ))}

            {/* ── Charts: Bar + Donut side by side ── */}
            {charts.bar.length > 0 && charts.donut.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <ReportBarChart data={charts.bar[0].data} title={charts.bar[0].title} />
                </div>
                <div className="lg:col-span-2">
                  <ReportDonut data={charts.donut[0].data} title={charts.donut[0].title} />
                </div>
              </div>
            ) : (
              charts.bar.map((c, i) => (
                <ReportBarChart key={`bar-${i}`} data={c.data} title={c.title} />
              ))
            )}

            {/* ── Additional bar charts ── */}
            {charts.bar.slice(1).map((c, i) => (
              <ReportBarChart key={`bar-extra-${i}`} data={c.data} title={c.title} />
            ))}

            {/* ── Sections ── */}
            {report.sections.filter(s => s.title !== "Executive Summary").map((sec, i) => {
              const color = sec.type === "recommendation" ? "green" : sec.type === "warning" ? "amber" : sec.type === "finding" ? undefined : undefined;
              const icon = sec.type === "recommendation" ? "→" : sec.type === "warning" ? "⚠" : sec.type === "finding" ? "✦" : "·";
              return (
                <InsightCard key={i} icon={icon} title={sec.title} detail={fmtMd(sec.content)} color={color} />
              );
            })}

            {/* ── Remaining tables (no matching chart) ── */}
            {charts.tablesWithoutChart.map((tbl, i) => (
              <div key={`tbl-${i}`}>
                <h3 className="mb-2 font-mono text-xs tracking-wider text-text-muted">{tbl.title}</h3>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {tbl.headers.map(h => (
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

            {/* ── Recommendations ── */}
            {report.recommendations.length > 0 && (
              <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-5">
                <p className="mb-4 text-sm font-semibold text-green-400">→ Prioritized Recommendations</p>
                <div className="space-y-2">
                  {report.recommendations.map((r, i) => (
                    <InsightCard key={i} icon={String(i + 1)} title={`Action ${i + 1}`} detail={r} color="green" />
                  ))}
                </div>
              </div>
            )}

            {/* ── Footer ── */}
            <div className="border-t border-border pt-4 text-xs text-text-muted italic">
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
