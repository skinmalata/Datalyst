type Row = Record<string, unknown>;

export type ReportSection = {
  title: string;
  content: string;
  type: "kpi" | "table" | "text" | "recommendation" | "warning" | "finding";
};

export type ForecastPoint = {
  label: string;
  actual: number | null;
  forecast: number | null;
  isProjected: boolean;
};

export type AnalysisReport = {
  title: string;
  summary: string;
  sections: ReportSection[];
  kpis: Array<{ label: string; value: string; change?: string; positive?: boolean }>;
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
  forecast: ForecastPoint[];
  recommendations: string[];
  warnings: string[];
};

type DatasetType = "ecommerce" | "analytics" | "financial" | "hr" | "general";

type Profile = {
  type: DatasetType;
  recordLabel: string;
  metricLabel: string;
  valuePrefix: string;
  isMonetary: boolean;
  fmt: (v: number) => string;
};

function num(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtGeneric(v: number): string {
  if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(2) + "M";
  if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

function fmtMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return "$" + (v / 1_000_000).toFixed(2) + "M";
  if (Math.abs(v) >= 1_000) return "$" + (v / 1_000).toFixed(1) + "K";
  return "$" + v.toFixed(0);
}

function pct(v: number): string {
  return (v * 100).toFixed(1) + "%";
}

function find(columns: string[], patterns: RegExp[]): string | undefined {
  return columns.find(c => patterns.some(p => p.test(c)));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r2: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]; sxx += i * i; sxy += i * values[i];
  }
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const intercept = (sy - slope * sx) / n;
  const mean = sy / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * i;
    ssTot += (values[i] - mean) ** 2;
    ssRes += (values[i] - predicted) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  return { slope, intercept, r2 };
}

function forecastNextMonths(series: { label: string; total: number }[], count: number): ForecastPoint[] {
  const values = series.map(s => s.total);
  const { slope, intercept, r2 } = linearRegression(values);

  const projected: ForecastPoint[] = series.map((s, i) => ({
    label: s.label,
    actual: s.total,
    forecast: Math.round(intercept + slope * i),
    isProjected: false,
  }));

  const lastLabel = series.at(-1)?.label || "";
  const [yearStr, monthStr] = lastLabel.split("-");
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10);

  for (let i = 1; i <= count; i++) {
    month++;
    if (month > 12) { month = 1; year++; }
    const idx = values.length + i - 1;
    projected.push({
      label: year + "-" + String(month).padStart(2, "0"),
      actual: null,
      forecast: Math.round(intercept + slope * idx),
      isProjected: true,
    });
  }

  return projected;
}

function groupBy(rows: Row[], field: string, dimension: string): Map<string, { total: number; count: number; values: number[] }> {
  const groups = new Map<string, { total: number; count: number; values: number[] }>();
  rows.forEach(row => {
    const v = num(row[field]);
    if (v === null) return;
    const key = String(row[dimension] ?? "Unknown");
    const entry = groups.get(key) || { total: 0, count: 0, values: [] };
    entry.total += v;
    entry.count++;
    entry.values.push(v);
    groups.set(key, entry);
  });
  return groups;
}

function detectDatasetType(columns: string[], rows: Row[]): DatasetType {
  const lower = columns.map(c => c.toLowerCase());

  function countHits(patterns: RegExp[]): number {
    return lower.filter(c => patterns.some(p => p.test(c))).length;
  }

  const ecommerceHits = countHits([/order|revenue|sales|cart|checkout|purchase|discount|return|shipping|invoice|customer.?type|payment/i]);
  const analyticsHits = countHits([/page.?view|views?|session|bounce|click|impression|visit|duration|traffic|source|medium|campaign|conversion.?rate|exit|entrance/i]);
  const financialHits = countHits([/balance|debit|credit|account|ledger|expense|profit|loss|equity|liability|asset|tax|interest.?rate|dividend/i]);
  const hrHits = countHits([/employee|salary|department|hire.?date|termination|performance|headcount|attrition|tenure|payroll|bonus|benefit/i]);

  const types: [DatasetType, number][] = [
    ["ecommerce", ecommerceHits],
    ["analytics", analyticsHits],
    ["financial", financialHits],
    ["hr", hrHits],
  ];

  const sorted = types.sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] >= 2) return sorted[0][0];

  if (analyticsHits >= 1) return "analytics";

  return "general";
}

function buildProfile(type: DatasetType, metricField: string): Profile {
  switch (type) {
    case "ecommerce":
      return {
        type,
        recordLabel: "Orders",
        metricLabel: metricField || "Revenue",
        valuePrefix: "",
        isMonetary: true,
        fmt: fmtMoney,
      };
    case "analytics":
      return {
        type,
        recordLabel: "Records",
        metricLabel: metricField || "Events",
        valuePrefix: "",
        isMonetary: false,
        fmt: fmtGeneric,
      };
    case "financial":
      return {
        type,
        recordLabel: "Transactions",
        metricLabel: metricField || "Value",
        valuePrefix: "",
        isMonetary: true,
        fmt: fmtMoney,
      };
    case "hr":
      return {
        type,
        recordLabel: "Employees",
        metricLabel: metricField || "Measure",
        valuePrefix: "",
        isMonetary: false,
        fmt: fmtGeneric,
      };
    default:
      return {
        type,
        recordLabel: "Records",
        metricLabel: metricField || "Value",
        valuePrefix: "",
        isMonetary: false,
        fmt: fmtGeneric,
      };
  }
}

export function generateAnalysisReport(rows: Row[], columns: string[]): AnalysisReport {
  const datasetType = detectDatasetType(columns, rows);

  const metric = find(columns, [/total.?price|revenue|sales|amount|value|views?|visits?|sessions?|events?|balance|expense|salary|payroll/i])
    || columns.find(c => rows.some(r => num(r[c]) !== null));
  const dateField = find(columns, [/date|order.?date|month|period|timestamp/i]);
  const regionField = find(columns, [/region|country|market|territory|area|zone/i]);
  const productField = find(columns, [/product|category|item|sku|line|type/i]);
  const returnField = find(columns, [/returned|return.?flag|is.?return|refund/i]);
  const discountField = find(columns, [/discount/i]);
  const paymentField = find(columns, [/payment|pay.?method|tender/i]);
  const customerTypeField = find(columns, [/customer.?type|segment|client.?type/i]);
  const quantityField = find(columns, [/quantity|qty|units?/i]);
  const storeField = find(columns, [/store|location|shop|outlet|branch/i]);
  const salespersonField = find(columns, [/salesperson|rep|agent|associate|employee|staff/i]);
  const shippingField = find(columns, [/shipping|delivery.?cost|freight/i]);

  if (!metric) {
    return {
      title: "Data Analysis Report",
      summary: "No numeric measure detected in the dataset.",
      sections: [],
      kpis: [],
      tables: [],
      forecast: [],
      recommendations: [],
      warnings: ["No numeric measure found. Upload a dataset with at least one numeric column."],
    };
  }

  const prof = buildProfile(datasetType, metric);

  const values = rows.map(r => num(r[metric])).filter((v): v is number => v !== null);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;
  const med = median(values);
  const zeroCount = values.filter(value => value === 0).length;

  const metricLabel = prof.isMonetary ? "Total " + metric : "Total " + metric;
  const avgLabel = prof.isMonetary ? "Avg " + metric : "Mean " + metric;
  const medianLabel = prof.isMonetary ? "Median " + metric : "Median " + metric;

  const kpis: AnalysisReport["kpis"] = [
    { label: metricLabel.toUpperCase(), value: prof.fmt(total) },
    { label: prof.recordLabel.toUpperCase(), value: values.length.toLocaleString() },
    { label: avgLabel.toUpperCase(), value: prof.fmt(avg) },
    { label: medianLabel.toUpperCase(), value: prof.fmt(med) },
  ];

  if (quantityField) {
    const qtyValues = rows.map(r => num(r[quantityField])).filter((v): v is number => v !== null);
    kpis.push({ label: "TOTAL " + quantityField.toUpperCase(), value: qtyValues.reduce((s, v) => s + v, 0).toLocaleString() });
  }

  const sections: ReportSection[] = [];
  const tables: AnalysisReport["tables"] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];
  // Every action is paired with an observed fact. This prevents the report from
  // presenting generic advice as if it were a conclusion from the dataset.
  const recommend = (action: string, evidence: string) => {
    recommendations.push(`${action} Evidence: ${evidence}.`);
  };
  let forecastData: ForecastPoint[] = [];

  const summaryParts: string[] = [];
  summaryParts.push(`**${prof.fmt(total)}** in ${metric} across **${values.length.toLocaleString()}** ${prof.recordLabel.toLowerCase()}`);
  summaryParts.push(`with an average of **${prof.fmt(avg)}** per record`);
  const summarySentence = summaryParts.join(" ") + ".";

  sections.push({
    title: "Executive Summary",
    content: summarySentence,
    type: "text",
  });
  if (datasetType === "analytics" && zeroCount) {
    const zeroShare = zeroCount / values.length;
    sections.push({ title: "Data quality and distribution", content: `**${pct(zeroShare)}** of records have zero ${metric}. This makes the mean (${prof.fmt(avg)}) a less representative benchmark than the median (${prof.fmt(med)}). Confirm whether zeros mean no activity, missing tracking, or intentionally included inactive records.`, type: "warning" });
    if (zeroShare >= 0.5) warnings.push(`More than half of records have zero ${metric}. Segment zero-activity records before using averages to assess performance.`);
  }

  // ── Regional / Dimension Analysis ──
  const groupDimension = regionField || productField;
  if (groupDimension) {
    const groups = groupBy(rows, metric, groupDimension);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count,
      avg: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;

      kpis.push({
        label: "TOP " + groupDimension.toUpperCase(),
        value: leader.label,
        change: (leader.share * 100).toFixed(1) + "% share",
      });

      const sectionTitle = regionField ? groupDimension + " Performance" : "Category Performance";
      sections.push({
        title: sectionTitle,
        content: `**${leader.label}** leads with **${prof.fmt(leader.total)}** (${(leader.share * 100).toFixed(1)}% share). **${weakest.label}** trails at **${prof.fmt(weakest.total)}** (${(weakest.share * 100).toFixed(1)}%).`,
        type: "finding",
      });

      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: metric + " by " + groupDimension,
        headers: [groupDimension, metric, "Share", recordWord, prof.isMonetary ? "Avg" : "Mean"],
        rows: ranking.map(r => [r.label, prof.fmt(r.total), (r.share * 100).toFixed(1) + "%", r.count.toLocaleString(), prof.fmt(r.avg)]),
      });

      recommend(
        `Review ${weakest.label} and test one targeted improvement before scaling it`,
        `${leader.label} contributes ${prof.fmt(leader.total)} while ${weakest.label} contributes ${prof.fmt(weakest.total)}`,
      );

      if (returnField && datasetType === "ecommerce") {
        const rr = groupReturnRate(rows, returnField, groupDimension);
        if (rr.length) {
          tables.push({
            title: "Return Rate by " + groupDimension,
            headers: [groupDimension, "Return Rate", recordWord],
            rows: rr.map(r => [r.label, (r.rate * 100).toFixed(1) + "%", r.count.toLocaleString()]),
          });
          const worstRR = rr[0];
          if (worstRR.rate > 0.2) {
            warnings.push(`${worstRR.label} has a ${(worstRR.rate * 100).toFixed(1)}% return rate — investigate fulfillment and product quality.`);
          }
        }
      }
    }
  }

  // ── Product / Category Analysis (if both region and product exist) ──
  if (regionField && productField) {
    const groups = groupBy(rows, metric, productField);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count,
      avg: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;

      sections.push({
        title: "Product Performance",
        content: `**${leader.label}** is the top product at **${prof.fmt(leader.total)}** (${(leader.share * 100).toFixed(1)}%). **${weakest.label}** generates the least at **${prof.fmt(weakest.total)}** (${(weakest.share * 100).toFixed(1)}%).`,
        type: "finding",
      });

      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: metric + " by " + productField,
        headers: [productField, metric, "Share", recordWord, prof.isMonetary ? "Avg" : "Mean"],
        rows: ranking.map(r => [r.label, prof.fmt(r.total), (r.share * 100).toFixed(1) + "%", r.count.toLocaleString(), prof.fmt(r.avg)]),
      });

      if (returnField && datasetType === "ecommerce") {
        const rr = groupReturnRate(rows, returnField, productField);
        if (rr.length) {
          tables.push({
            title: "Return Rate by " + productField,
            headers: [productField, "Return Rate", recordWord],
            rows: rr.map(r => [r.label, (r.rate * 100).toFixed(1) + "%", r.count.toLocaleString()]),
          });
          const worstProduct = rr[0];
          if (worstProduct.rate > 0.2) {
            warnings.push(`${worstProduct.label} has a ${(worstProduct.rate * 100).toFixed(1)}% return rate — check product quality or descriptions.`);
            recommend(`Investigate root causes for ${worstProduct.label} returns before expanding it`, `${worstProduct.label} has a ${(worstProduct.rate * 100).toFixed(1)}% recorded return rate across ${worstProduct.count} records`);
          }
        }
      }
    }
  }

  // ── Time Series Analysis ──
  if (dateField) {
    const buckets = new Map<string, { total: number; count: number }>();
    rows.forEach(row => {
      const d = new Date(String(row[dateField] ?? ""));
      const v = num(row[metric]);
      if (Number.isNaN(d.getTime()) || v === null) return;
      const key = d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
      const entry = buckets.get(key) || { total: 0, count: 0 };
      entry.total += v;
      entry.count++;
      buckets.set(key, entry);
    });

    const series = [...buckets].sort((a, b) => a[0].localeCompare(b[0])).map(([label, g]) => ({
      label, total: g.total, count: g.count,
    }));

    if (series.length >= 3) {
      const totals = series.map(s => s.total);
      const changes: number[] = [];
      for (let i = 1; i < totals.length; i++) changes.push(totals[i] - totals[i - 1]);
      const positive = changes.filter(c => c > 0).length;
      const consistency = (positive / changes.length) * 100;

      const firstHalf = totals.slice(0, Math.floor(totals.length / 2));
      const secondHalf = totals.slice(Math.floor(totals.length / 2));
      const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const halfChange = firstAvg > 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;

      const metricWord = prof.isMonetary ? "Revenue" : metric;

      let trendDesc: string;
      if (consistency >= 75) {
        trendDesc = `Strong upward momentum — ${consistency.toFixed(0)}% of periods showed growth.`;
        recommend("Set the next-period target above the recent baseline, then monitor it weekly", `${positive} of ${changes.length} observed period-to-period changes were positive`);
      } else if (consistency <= 25) {
        trendDesc = `Persistent decline — ${(100 - consistency).toFixed(0)}% of periods showed decrease.`;
        warnings.push(`Trend is persistently declining. Investigate root causes before the trend solidifies.`);
        recommend("Run a root-cause review of the declining periods before committing more budget", `${changes.length - positive} of ${changes.length} observed period-to-period changes were negative`);
      } else {
        trendDesc = `Mixed momentum — ${positive} up periods and ${changes.length - positive} down periods.`;
      }

      if (Math.abs(halfChange) >= 15) {
        trendDesc += ` Second-half average is ${halfChange > 0 ? "+" : ""}${halfChange.toFixed(1)}% vs first half.`;
      }

      sections.push({
        title: "Trend Analysis",
        content: trendDesc,
        type: "finding",
      });

      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: "Monthly " + metric,
        headers: ["Month", metric, recordWord],
        rows: series.slice(-12).map(s => [s.label, prof.fmt(s.total), s.count.toLocaleString()]),
      });
    }

    const yearBuckets = new Map<number, number>();
    rows.forEach(row => {
      const d = new Date(String(row[dateField] ?? ""));
      const v = num(row[metric]);
      if (Number.isNaN(d.getTime()) || v === null) return;
      const year = d.getUTCFullYear();
      yearBuckets.set(year, (yearBuckets.get(year) || 0) + v);
    });
    const years = [...yearBuckets].sort((a, b) => a[0] - b[0]);
    if (years.length >= 2) {
      const yoyGrowth = ((years[1][1] - years[0][1]) / years[0][1]) * 100;
      kpis.push({ label: "YOY GROWTH", value: yoyGrowth.toFixed(1) + "%", positive: yoyGrowth > 0 });
    }

    // ── Forecast ──
    if (series.length >= 3) {
      const forecastCount = Math.min(6, Math.max(3, Math.floor(series.length / 3)));
      forecastData = forecastNextMonths(series, forecastCount);

      const { slope, r2 } = linearRegression(series.map(s => s.total));
      const lastActual = series.at(-1)!.total;
      const nextForecast = forecastData.find(f => f.isProjected);
      const projectedValue = nextForecast?.forecast ?? 0;
      const monthlyGrowthRate = lastActual > 0 ? ((projectedValue - lastActual) / lastActual) * 100 : 0;

      const forecastConfidence = r2 >= 0.7 ? "high" : r2 >= 0.4 ? "moderate" : "low";

      kpis.push({
        label: "NEXT PERIOD FORECAST",
        value: prof.fmt(projectedValue),
        change: (monthlyGrowthRate >= 0 ? "+" : "") + monthlyGrowthRate.toFixed(1) + "% vs current",
        positive: monthlyGrowthRate > 0,
      });

      const slopeDir = slope > 0 ? "upward" : slope < 0 ? "downward" : "flat";
      const forecastDesc = `Linear regression on ${series.length} months of data shows a ${slopeDir} trend (R² = ${r2.toFixed(2)}, ${forecastConfidence} confidence). Projected next-period ${metric}: **${prof.fmt(projectedValue)}** (${monthlyGrowthRate >= 0 ? "+" : ""}${monthlyGrowthRate.toFixed(1)}% vs current).`;
      sections.push({ title: "Forecast", content: forecastDesc, type: "recommendation" });

      tables.push({
        title: "Forecast: " + metric,
        headers: ["Month", "Actual", "Forecast", "Status"],
        rows: forecastData.map(f => [
          f.label,
          f.actual !== null ? prof.fmt(f.actual) : "—",
          f.forecast !== null ? prof.fmt(f.forecast) : "—",
          f.isProjected ? "Projected" : "Actual",
        ]),
      });

      if (slope < 0) {
        warnings.push(`Forecast projects continued decline. Without intervention, ${metric.toLowerCase()} could fall to ${prof.fmt(projectedValue)} next period.`);
        recommend(`Review the latest decline and assign owners to its likely drivers before the next period closes`, `the linear projection is ${prof.fmt(projectedValue)} next period, ${Math.abs(monthlyGrowthRate).toFixed(1)}% below the latest actual`);
      } else if (slope > 0 && r2 >= 0.5) {
        recommend(`Use the projected trajectory as a planning baseline and test which activities can be safely scaled`, `the ${series.length}-month trend is upward with R² = ${r2.toFixed(2)} and projects ${prof.fmt(projectedValue)} next period`);
      }

      if (forecastConfidence === "low") {
        warnings.push(`Forecast confidence is low (R² = ${r2.toFixed(2)}). High volatility means projections should be treated as directional, not precise.`);
      }
    }
  }

  // ── Discount Analysis (ecommerce only) ──
  if (discountField && datasetType === "ecommerce") {
    const discValues = rows.map(r => num(r[discountField])).filter((v): v is number => v !== null);
    if (discValues.length) {
      const avgDisc = discValues.reduce((s, v) => s + v, 0) / discValues.length;
      const discounted = discValues.filter(v => v > 0).length;
      const discRate = discounted / discValues.length;

      kpis.push({ label: "AVG DISCOUNT", value: (avgDisc <= 1 ? avgDisc * 100 : avgDisc).toFixed(1) + "%" });

      if (discRate > 0.5) {
        warnings.push(`${(discRate * 100).toFixed(0)}% of records have discounts. Verify discounts are driving profitable growth, not just volume.`);
        recommend("Run a controlled promotion test and judge it on net performance rather than volume alone", `${(discRate * 100).toFixed(0)}% of records include a discount and the average recorded discount is ${(avgDisc <= 1 ? avgDisc * 100 : avgDisc).toFixed(1)}%`);
      }

      if (returnField) {
        const discGroups = new Map<number, { total: number; returned: number }>();
        rows.forEach(row => {
          const d = num(row[discountField]);
          const r = num(row[returnField]);
          if (d === null || r === null) return;
          const entry = discGroups.get(d) || { total: 0, returned: 0 };
          entry.total++;
          if (r > 0) entry.returned++;
          discGroups.set(d, entry);
        });
        const discReturnTable = [...discGroups]
          .map(([d, g]) => ({
            discount: (d * 100).toFixed(0) + "%",
            records: g.total,
            returnRate: g.total ? ((g.returned / g.total) * 100).toFixed(1) + "%" : "0%",
          }))
          .sort((a, b) => a.discount.localeCompare(b.discount));

        if (discReturnTable.length > 1) {
          tables.push({
            title: "Discount vs Return Rate",
            headers: ["Discount", prof.recordLabel, "Return Rate"],
            rows: discReturnTable.map(r => [r.discount, r.records.toLocaleString(), r.returnRate]),
          });
        }
      }
    }
  }

  // ── Return Analysis (ecommerce only) ──
  if (returnField && datasetType === "ecommerce") {
    const overallRR = returnRate(rows, returnField);
    kpis.push({ label: "RETURN RATE", value: pct(overallRR), positive: overallRR < 0.15 });

    if (overallRR > 0.2) {
      warnings.push(`Overall return rate is ${(overallRR * 100).toFixed(1)}%. Review return reasons and refund value before treating gross sales as net performance.`);
      recommend("Prioritize a return-reduction review by product and region before evaluating gross performance", `the overall recorded return rate is ${(overallRR * 100).toFixed(1)}%`);
    }
  }

  // ── Payment Method Analysis (ecommerce only) ──
  if (paymentField && datasetType === "ecommerce") {
    const groups = groupBy(rows, metric, paymentField);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count, avg: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: "Revenue by " + paymentField,
        headers: [paymentField, metric, recordWord, prof.isMonetary ? "Avg" : "Mean"],
        rows: ranking.map(r => [r.label, prof.fmt(r.total), r.count.toLocaleString(), prof.fmt(r.avg)]),
      });

      if (returnField) {
        const rr = groupReturnRate(rows, returnField, paymentField);
        if (rr.length && rr[0].rate > 0.25) {
          warnings.push(`${rr[0].label} has a ${(rr[0].rate * 100).toFixed(1)}% return rate — consider incentives for lower-return payment methods.`);
        }
      }
    }
  }

  // ── Customer / Segment Analysis ──
  if (customerTypeField) {
    const groups = groupBy(rows, metric, customerTypeField);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count, avg: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const recordWord = prof.recordLabel.toLowerCase();
      sections.push({
        title: "Segment Analysis",
        content: ranking.map(r => `**${r.label}**: ${prof.fmt(r.total)} (${(r.share * 100).toFixed(1)}%), ${r.count.toLocaleString()} ${recordWord}`).join("; ") + ".",
        type: "finding",
      });
    }
  }

  // ── Store / Location Analysis ──
  if (storeField && !regionField) {
    const groups = groupBy(rows, metric, storeField);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count, avg: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: metric + " by " + storeField,
        headers: [storeField, metric, recordWord, prof.isMonetary ? "Avg" : "Mean"],
        rows: ranking.map(r => [r.label, prof.fmt(r.total), r.count.toLocaleString(), prof.fmt(r.avg)]),
      });
    }
  }

  // ── Salesperson / Agent Analysis ──
  if (salespersonField) {
    const groups = groupBy(rows, metric, salespersonField);
    const ranking = [...groups].map(([label, g]) => ({
      label, total: g.total, count: g.count, avg: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.total - a.total);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;
      const recordWord = prof.recordLabel.toLowerCase();
      kpis.push({ label: "TOP " + salespersonField.toUpperCase(), value: leader.label, change: prof.fmt(leader.total) });
      sections.push({
        title: "Performance Breakdown",
        content: `**${leader.label}** leads with **${prof.fmt(leader.total)}** across ${leader.count} ${recordWord}. **${weakest.label}** trails at **${prof.fmt(weakest.total)}**.`,
        type: "finding",
      });
      recommend(`Document ${leader.label}'s repeatable practices and test them with the lowest-performing peers`, `${leader.label} leads at ${prof.fmt(leader.total)} while ${weakest.label} records ${prof.fmt(weakest.total)}`);
    }
  }

  // ── Shipping Cost Analysis (ecommerce only) ──
  if (shippingField && datasetType === "ecommerce") {
    const shipValues = rows.map(r => num(r[shippingField])).filter((v): v is number => v !== null);
    if (shipValues.length) {
      const totalShip = shipValues.reduce((s, v) => s + v, 0);
      const avgShip = totalShip / shipValues.length;
      kpis.push({ label: "AVG SHIPPING", value: fmtMoney(avgShip) });
      if (total > 0) {
        const shipPct = (totalShip / total) * 100;
        if (shipPct > 2) {
          warnings.push(`Shipping costs are ${shipPct.toFixed(1)}% of revenue — optimize logistics or renegotiate carrier rates.`);
        }
      }
    }
  }

  // ── Anomaly Detection ──
  if (values.length >= 8) {
    const mean = total / values.length;
    const sd = stdDev(values);
    const upper = mean + 2 * sd;
    const anomalies = values.filter(v => v > upper);
    if (anomalies.length > 0) {
      const title = datasetType === "analytics" ? "High-activity records" : "Anomaly Detection";
      const content = datasetType === "analytics" ? `${anomalies.length} record${anomalies.length === 1 ? "" : "s"} exceeded ${prof.fmt(upper)} ${metric}. These are high-activity records, not automatically errors; inspect their source, page, campaign, or time period before acting.` : `${anomalies.length} unusual ${prof.recordLabel.toLowerCase()} detected (>${prof.fmt(upper)}). Validate whether they are data errors or exceptional cases.`;
      sections.push({ title, content, type: "warning" });
      recommend(datasetType === "analytics" ? `Inspect the ${anomalies.length} high-activity record${anomalies.length === 1 ? "" : "s"} with source and date context before calling it growth` : `Validate the ${anomalies.length} outlier${anomalies.length === 1 ? "" : "s"} before using it in decisions`, `${anomalies.length} recorded value${anomalies.length === 1 ? "" : "s"} exceed the statistical threshold of ${prof.fmt(upper)}`);
    }
  }

  // ── Concentration Risk ──
  if (groupDimension) {
    const groups = groupBy(rows, metric, groupDimension);
    const sorted = [...groups].map(([, g]) => g.total).sort((a, b) => b - a);
    const top3 = sorted.slice(0, 3).reduce((s, v) => s + v, 0);
    const top3Pct = total ? top3 / total : 0;

    if (top3Pct >= 0.7) {
      warnings.push(`Top 3 ${groupDimension}s account for ${(top3Pct * 100).toFixed(0)}% of ${metric.toLowerCase()} — high concentration risk.`);
      recommend(`Create a plan to reduce dependency on the largest ${groupDimension}s`, `the top three ${groupDimension}s account for ${(top3Pct * 100).toFixed(0)}% of recorded ${metric.toLowerCase()}`);
    }
  }

  // ── Cross-Dimensional Insights ──
  if (regionField && productField) {
    const combos = new Map<string, { total: number; count: number }>();
    rows.forEach(row => {
      const v = num(row[metric]);
      if (v === null) return;
      const r = String(row[regionField] ?? "?");
      const p = String(row[productField] ?? "?");
      const key = r + " | " + p;
      const entry = combos.get(key) || { total: 0, count: 0 };
      entry.total += v;
      entry.count++;
      combos.set(key, entry);
    });
    const topCombos = [...combos].sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    if (topCombos.length) {
      const recordWord = prof.recordLabel.toLowerCase();
      tables.push({
        title: "Top " + regionField + " x " + productField + " Combinations",
        headers: ["Combination", metric, recordWord],
        rows: topCombos.map(([key, g]) => [key, prof.fmt(g.total), g.count.toLocaleString()]),
      });
    }
  }

  // ── Dataset Type Recommendations ──
  if (datasetType === "analytics") {
    const sourceField = find(columns, [/source|medium|channel|campaign/i]);
    const conversionField = find(columns, [/conversion|goal|signup|purchase/i]);
    if (sourceField) recommend(`Compare ${metric} by ${sourceField} before reallocating effort`, `the uploaded data includes ${sourceField} but the current report has not attributed activity to it`);
    else recommend(`Add a source, channel, page, or campaign field before attributing ${metric} changes`, `the uploaded data has no source, channel, page, or campaign field`);
    if (conversionField) recommend(`Compare ${metric} with ${conversionField} to separate high activity from high-value outcomes`, `the uploaded data includes both ${metric} and ${conversionField}`);
    else recommend(`Add a conversion or outcome field before treating ${metric} as business impact`, `the uploaded data records ${metric} but contains no conversion or outcome field`);
  } else if (datasetType === "ecommerce") {
    if (!recommendations.length) {
      recommend("Add region, product, and date fields for more actionable segmentation", "the current dataset does not contain enough of these dimensions to identify where performance changes");
    }
  } else if (datasetType === "hr") {
    if (!recommendations.length) {
      recommend("Add or analyze attrition by department and tenure before setting retention actions", "the current report did not find sufficient attrition evidence to identify a retention driver");
    }
    recommend("Compare compensation across departments before drawing conclusions about internal equity", "the dataset is classified as HR data and includes employee-related measures");
  } else if (datasetType === "financial") {
    if (!recommendations.length) {
      recommend("Track period-over-period changes before committing to a financial direction", "the dataset is classified as financial data but does not provide enough dated observations for a trend");
    }
    recommend("Compare actuals against budget or target before treating performance as favourable or unfavourable", "the uploaded data contains financial measures but no budget comparison was identified");
  } else {
    if (!recommendations.length) {
      recommend("Add region, category, or date fields for more specific actions", `the uploaded data has ${columns.length} fields but lacks enough dimensions for a reliable segment comparison`);
    }
  }

  // ── Final Recommendations ──
  if (recommendations.length === 0) {
    recommend("Add a business dimension such as region, category, or date before making operational changes", `the uploaded data does not contain a segment or time field that can explain variation in ${metric}`);
  }

  const summary = sections.find(s => s.title === "Executive Summary")?.content || "";

  return {
    title: "Comprehensive Data Analysis Report",
    summary,
    sections,
    kpis,
    tables,
    forecast: forecastData,
    recommendations: recommendations.slice(0, 8),
    warnings,
  };
}

function returnRate(rows: Row[], returnField: string): number {
  const flags = rows.map(r => num(r[returnField])).filter((v): v is number => v !== null);
  if (!flags.length) return 0;
  return flags.filter(v => v > 0).length / flags.length;
}

function groupReturnRate(rows: Row[], returnField: string, dimension: string): { label: string; rate: number; count: number }[] {
  const groups = new Map<string, { returned: number; total: number }>();
  rows.forEach(row => {
    const r = num(row[returnField]);
    if (r === null) return;
    const key = String(row[dimension] ?? "Unknown");
    const entry = groups.get(key) || { returned: 0, total: 0 };
    entry.total++;
    if (r > 0) entry.returned++;
    groups.set(key, entry);
  });
  return [...groups]
    .map(([label, g]) => ({ label, rate: g.total ? g.returned / g.total : 0, count: g.total }))
    .sort((a, b) => b.rate - a.rate);
}
