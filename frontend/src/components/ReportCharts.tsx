"use client";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Legend,
} from "recharts";

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#3B82F6", "#22D3EE"];

type ChartData = { label: string; value: number; [key: string]: unknown };

// ── Shared tooltip style ──────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: { background: "#111d31", border: "1px solid #283952", borderRadius: 8, fontSize: 12, color: "#e1e9f4" },
  itemStyle: { color: "#e1e9f4" },
  labelStyle: { color: "#c2cfe0", marginBottom: 4 },
};

// ── Bar Chart ─────────────────────────────────────────────────────────────
export function ReportBarChart({ data, title, color }: { data: ChartData[]; title?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis dataKey="label" stroke="#c2cfe0" tick={{ fontSize: 11 }} interval={0} angle={data.length > 6 ? -35 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
          <YAxis stroke="#c2cfe0" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => ["$" + v.toLocaleString(), "Revenue"]} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={color || COLORS[0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────
export function ReportHorizontalBar({ data, title }: { data: ChartData[]; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <XAxis type="number" stroke="#c2cfe0" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v} />
          <YAxis type="category" dataKey="label" stroke="#c2cfe0" tick={{ fontSize: 11 }} width={120} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => ["$" + v.toLocaleString(), "Revenue"]} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Line Chart (trend) ────────────────────────────────────────────────────
export function ReportLineChart({ data, title, color }: { data: ChartData[]; title?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color || COLORS[0]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color || COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke="#c2cfe0" tick={{ fontSize: 11 }} />
          <YAxis stroke="#c2cfe0" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v} />
          <Tooltip {...tooltipStyle} formatter={(v: number) => ["$" + v.toLocaleString(), "Revenue"]} />
          <Area type="monotone" dataKey="value" stroke={color || COLORS[0]} fill="url(#areaGrad)" strokeWidth={2.5} dot={{ fill: color || COLORS[0], r: 3 }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Donut / Pie Chart ─────────────────────────────────────────────────────
export function ReportDonut({ data, title, innerLabel }: { data: ChartData[]; title?: string; innerLabel?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <div className="flex items-center gap-4">
        <ResponsiveContainer width="50%" height={220}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip {...tooltipStyle} formatter={(v: number) => ["$" + v.toLocaleString()]} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="flex-1 text-text-secondary truncate">{d.label}</span>
              <span className="font-mono text-xs text-text-muted">{total > 0 ? ((d.value / total) * 100).toFixed(1) : 0}%</span>
            </div>
          ))}
          {innerLabel && <p className="mt-2 text-center text-lg font-bold">{innerLabel}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Multi-Line Chart ──────────────────────────────────────────────────────
export function ReportMultiLine({ series, title }: { series: { name: string; data: ChartData[] }[]; title?: string }) {
  const labels = Array.from(new Set(series.flatMap(s => s.data.map(d => d.label)))).sort();
  const merged = labels.map(l => {
    const row: Record<string, unknown> = { label: l };
    series.forEach(s => { const match = s.data.find(d => d.label === l); row[s.name] = match?.value ?? 0; });
    return row;
  });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={merged} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <XAxis dataKey="label" stroke="#c2cfe0" tick={{ fontSize: 11 }} />
          <YAxis stroke="#c2cfe0" tick={{ fontSize: 11 }} tickFormatter={(v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v} />
          <Tooltip {...tooltipStyle} />
          <Legend />
          {series.map((s, i) => (
            <Line key={s.name} type="monotone" dataKey={s.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 2 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Radar Chart ───────────────────────────────────────────────────────────
export function ReportRadar({ data, title }: { data: ChartData[]; title?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="#283952" />
          <PolarAngleAxis dataKey="label" tick={{ fill: "#c2cfe0", fontSize: 11 }} />
          <PolarRadiusAxis tick={{ fill: "#6b7280", fontSize: 10 }} />
          <Radar name="Value" dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.25} strokeWidth={2} />
          <Tooltip {...tooltipStyle} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPI Card with progress bar ────────────────────────────────────────────
export function KpiCard({ label, value, change, positive, barPct }: {
  label: string; value: string; change?: string; positive?: boolean; barPct?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="mb-2 text-[10px] font-bold tracking-wider text-text-muted uppercase">{label}</p>
      <p className={`text-xl font-bold ${positive === true ? "text-green-400" : positive === false ? "text-red-400" : "text-white"}`}>
        {value}
      </p>
      {change && <p className="mt-1 text-xs text-text-muted">{change}</p>}
      {barPct != null && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, Math.max(0, barPct))}%`,
              background: positive === false ? "#EF4444" : positive === true ? "#10B981" : COLORS[0],
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Heatmap-style table ───────────────────────────────────────────────────
export function HeatmapTable({ data, title }: { data: { label: string; values: { metric: string; value: number }[] }[]; title?: string }) {
  const allMetrics = Array.from(new Set(data.flatMap(d => d.values.map(v => v.metric))));
  const maxVal = Math.max(...data.flatMap(d => d.values.map(v => v.value)), 1);

  const heatColor = (v: number) => {
    const intensity = v / maxVal;
    if (intensity > 0.75) return "rgba(99,102,241,0.35)";
    if (intensity > 0.5) return "rgba(99,102,241,0.2)";
    if (intensity > 0.25) return "rgba(99,102,241,0.1)";
    return "transparent";
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      {title && <p className="mb-3 text-xs font-bold tracking-wider text-text-muted">{title}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-[10px] font-bold tracking-wider text-text-muted uppercase" />
              {allMetrics.map(m => (
                <th key={m} className="px-3 py-2 text-center text-[10px] font-bold tracking-wider text-text-muted uppercase">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.label} className="border-b border-border/50">
                <td className={`px-3 py-2 whitespace-nowrap ${i === 0 ? "font-semibold text-white" : "text-text-secondary"}`}>{row.label}</td>
                {allMetrics.map(m => {
                  const match = row.values.find(v => v.metric === m);
                  const val = match?.value ?? 0;
                  return (
                    <td key={m} className="px-3 py-2 text-center font-mono text-xs" style={{ background: heatColor(val) }}>
                      {val >= 1e6 ? "$" + (val / 1e6).toFixed(1) + "M" : val >= 1e3 ? "$" + (val / 1e3).toFixed(0) + "K" : "$" + val.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Insight callout card ──────────────────────────────────────────────────
export function InsightCard({ icon, title, detail, color }: { icon: string; title: string; detail: string; color?: string }) {
  const borderColor = color === "green" ? "border-l-green-400" : color === "amber" ? "border-l-amber-400" : color === "red" ? "border-l-red-400" : "border-l-primary";
  const iconBg = color === "green" ? "bg-green-400/10 text-green-400" : color === "amber" ? "bg-amber-400/10 text-amber-400" : color === "red" ? "bg-red-400/10 text-red-400" : "bg-primary/10 text-primary";
  return (
    <div className={`flex gap-3 rounded-xl border border-border border-l-4 ${borderColor} bg-surface p-4`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${iconBg}`}>{icon}</span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-text-secondary">{detail}</p>
      </div>
    </div>
  );
}
