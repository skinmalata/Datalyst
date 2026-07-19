"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { useStore } from "@/store/useStore";
import { api } from "@/lib/api-client";
import {
  ReportBarChart, ReportHorizontalBar, ReportLineChart,
  ReportDonut, ReportMultiLine, ReportRadar,
  KpiCard, HeatmapTable, InsightCard, ForecastChart,
} from "./ReportCharts";

type Kpi = { label: string; value: string; change?: string; positive?: boolean };
type Section = { title: string; type: string; content: string };
type Table = { title: string; headers: string[]; rows: string[][] };
type ForecastPoint = { label: string; actual: number | null; forecast: number | null; isProjected: boolean };
type Report = {
  title: string;
  summary: string;
  kpis: Kpi[];
  sections: Section[];
  tables: Table[];
  forecast: ForecastPoint[];
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

function tableToBarData(tbl: Table): { label: string; value: number }[] {
  const labelIdx = 0;
  const valueIdx = tbl.headers.findIndex(h => /revenue|total|amount|sales|value/i.test(h));
  if (valueIdx === -1) return [];
  return tbl.rows.map(r => ({ label: r[labelIdx], value: parseMoney(r[valueIdx]) })).filter(d => d.value > 0);
}

function tableToLineData(tbl: Table): { label: string; value: number }[] {
  return tableToBarData(tbl);
}

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

// ── HTML Report Export ──────────────────────────────────────────────────

function downloadReportHtml(report: Report, rowCount: number, colCount: number) {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const md = (s: string) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const css = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; color: #1a1a2e; line-height: 1.6; padding: 2rem; max-width: 960px; margin: 0 auto; }
    .eyebrow { font-size: 0.65rem; letter-spacing: 0.12em; color: #7982ff; font-weight: 700; text-transform: uppercase; margin-bottom: 0.5rem; }
    h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem; }
    h2 { font-size: 1.1rem; font-weight: 700; margin: 2rem 0 0.75rem; color: #1a1a2e; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.4rem; }
    h3 { font-size: 0.95rem; font-weight: 600; margin: 1.5rem 0 0.5rem; }
    .meta { font-size: 0.8rem; color: #64748b; margin-bottom: 1.5rem; }
    .summary { font-size: 0.95rem; color: #475569; margin-bottom: 2rem; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; text-align: center; }
    .kpi small { display: block; font-size: 0.65rem; letter-spacing: 0.08em; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 0.3rem; }
    .kpi strong { display: block; font-size: 1.3rem; font-weight: 700; }
    .kpi .change { display: block; font-size: 0.75rem; color: #64748b; margin-top: 0.15rem; }
    .warnings { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .warnings h3 { color: #b45309; margin-top: 0; }
    .warning-item { font-size: 0.88rem; color: #92400e; padding: 0.4rem 0; border-bottom: 1px solid #fde68a; }
    .warning-item:last-child { border-bottom: none; }
    .section { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .section.finding { border-left: 3px solid #7982ff; }
    .section.recommendation { border-left: 3px solid #10b981; }
    .section.warning { border-left: 3px solid #f59e0b; }
    .section-content { font-size: 0.9rem; color: #475569; }
    .section-content strong { color: #1a1a2e; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 1.5rem; }
    th { text-align: left; padding: 0.6rem 0.75rem; border-bottom: 2px solid #e2e8f0; font-size: 0.7rem; letter-spacing: 0.06em; text-transform: uppercase; color: #64748b; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f1f5f9; }
    tbody tr:first-child td { font-weight: 600; }
    tbody tr:hover { background: #f1f5f9; }
    .recs { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
    .recs h3 { color: #166534; margin-top: 0; }
    .recs ol { padding-left: 1.25rem; }
    .recs li { font-size: 0.88rem; color: #475569; margin-bottom: 0.4rem; }
    .footer { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #94a3b8; font-style: italic; }
    @media print { body { padding: 0; } }
  `;

  let body = "";
  body += `<p class="eyebrow">ANALYSIS REPORT</p>\n`;
  body += `<h1>${esc(report.title)}</h1>\n`;
  body += `<p class="summary">${md(report.summary)}</p>\n`;
  body += `<p class="meta">${rowCount.toLocaleString()} records · ${colCount} fields · Generated ${now}</p>\n`;

  if (report.kpis.length) {
    body += `<h2>Key Metrics</h2>\n<div class="kpis">`;
    report.kpis.forEach(k => {
      body += `<div class="kpi"><small>${esc(k.label)}</small><strong>${esc(k.value)}</strong>`;
      if (k.change) body += `<span class="change">${esc(k.change)}</span>`;
      body += `</div>`;
    });
    body += `</div>\n`;
  }

  if (report.warnings.length) {
    body += `<div class="warnings"><h3>⚠ Risks to Investigate</h3>`;
    report.warnings.forEach(w => { body += `<div class="warning-item">${md(w)}</div>`; });
    body += `</div>\n`;
  }

  report.sections.forEach(sec => {
    if (sec.title === "Executive Summary") return;
    if (sec.title === "Forecast") {
      body += `<div class="section recommendation"><h3>📈 ${esc(sec.title)}</h3><div class="section-content">${md(sec.content)}</div></div>\n`;
      return;
    }
    const icon = sec.type === "recommendation" ? "→" : sec.type === "warning" ? "⚠" : sec.type === "finding" ? "✦" : "·";
    body += `<div class="section ${sec.type}"><h3>${icon} ${esc(sec.title)}</h3><div class="section-content">${md(sec.content)}</div></div>\n`;
  });

  report.forecast?.forEach(tbl => {
    if (tbl.actual === null) return;
  });

  report.tables.forEach(tbl => {
    if (tbl.title.startsWith("Forecast:")) {
      body += `<h3>📈 ${esc(tbl.title)}</h3>\n<table><thead><tr>`;
      tbl.headers.forEach(h => { body += `<th>${esc(h)}</th>`; });
      body += `</tr></thead><tbody>`;
      tbl.rows.forEach(row => {
        body += `<tr>`;
        row.forEach((c, ci) => {
          const isProjected = row.at(-1) === "Projected";
          const style = isProjected ? ' style="background:#fef3c7;font-weight:600;"' : ci === 0 ? ' style="font-weight:600;"' : '';
          body += `<td${style}>${esc(c)}</td>`;
        });
        body += `</tr>`;
      });
      body += `</tbody></table>\n`;
      return;
    }
    body += `<h3>${esc(tbl.title)}</h3>\n<table><thead><tr>`;
    tbl.headers.forEach(h => { body += `<th>${esc(h)}</th>`; });
    body += `</tr></thead><tbody>`;
    tbl.rows.forEach(row => {
      body += `<tr>`;
      row.forEach(c => { body += `<td>${esc(c)}</td>`; });
      body += `</tr>`;
    });
    body += `</tbody></table>\n`;
  });

  if (report.recommendations.length) {
    body += `<div class="recs"><h3>→ Prioritized Recommendations</h3><ol>`;
    report.recommendations.forEach(r => { body += `<li>${md(r)}</li>`; });
    body += `</ol></div>\n`;
  }

  body += `<div class="footer">Decision note: This report is based on recorded values in the uploaded dataset. Add cost, margin, and refund amounts to evaluate profitability rather than revenue alone.</div>\n`;

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(report.title)} — Datalyst</title><style>${css}</style></head><body>${body}</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `datalyst-report-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type Props = { open: boolean; onClose: () => void; filter?: { field: string; value: string } };

export function ReportViewer({ open, onClose, filter }: Props) {
  const { datasetId, rows } = useStore();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => setVisible(true), 50);
      fetchReport();
    } else {
      setVisible(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchReport = async () => {
    if (!datasetId) { setError("No dataset loaded. Upload data first."); return; }
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const suffix = filter ? `?filterField=${encodeURIComponent(filter.field)}&filterValue=${encodeURIComponent(filter.value)}` : "";
      const data = await api<Report>(`/api/datasets/${datasetId}/report${suffix}`);
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!report) return;
    downloadReportHtml(report, rows.length, Object.keys(rows[0] || {}).length);
  };

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
      const d = tableToBarData(tbl);
      if (d.length >= 2 && d.length <= 10) { bar.push({ title: tbl.title, data: d }); return; }
      tablesWithoutChart.push(tbl);
    });

    return { bar, donut, line, tablesWithoutChart };
  }, [report]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div className="fixed right-6 top-6 z-50 flex items-center gap-2">
        {report && (
          <button
            onClick={handleDownload}
            className="flex h-10 items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-sm font-semibold text-primary hover:bg-primary/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Download
          </button>
        )}
        <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-xl text-text-secondary hover:text-white">×</button>
      </div>

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

            {/* ── Forecast Chart ── */}
            {report.forecast.length > 0 && (
              <ForecastChart data={report.forecast} title="Forecast & Projection" />
            )}

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

            {/* ── Remaining tables ── */}
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
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={fetchReport} className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20">Retry</button>
              <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-surface">Close</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
