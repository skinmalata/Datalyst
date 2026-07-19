type Row = Record<string, unknown>;

export type ReportSection = {
  title: string;
  content: string;
  type: "kpi" | "table" | "text" | "recommendation" | "warning" | "finding";
};

export type AnalysisReport = {
  title: string;
  summary: string;
  sections: ReportSection[];
  kpis: Array<{ label: string; value: string; change?: string; positive?: boolean }>;
  tables: Array<{ title: string; headers: string[]; rows: string[][] }>;
  recommendations: string[];
  warnings: string[];
};

function num(value: unknown): number | null {
  const parsed = Number(String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value: number): string {
  if (Math.abs(value) >= 1_000_000) return "$" + (value / 1_000_000).toFixed(2) + "M";
  if (Math.abs(value) >= 1_000) return "$" + (value / 1_000).toFixed(1) + "K";
  return "$" + value.toFixed(0);
}

function pct(value: number): string {
  return (value * 100).toFixed(1) + "%";
}

function find(columns: string[], patterns: RegExp): string | undefined {
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

export function generateAnalysisReport(rows: Row[], columns: string[]): AnalysisReport {
  const metric = find(columns, /total.?price|revenue|sales|amount|value|revenue/i)
    || columns.find(c => rows.some(r => num(r[c]) !== null));
  const dateField = find(columns, /date|order.?date|month|period|timestamp/i);
  const regionField = find(columns, /region|country|market|territory|area|zone/i);
  const productField = find(columns, /product|category|item|sku|line|type/i);
  const returnField = find(columns, /returned|return.?flag|is.?return/i);
  const discountField = find(columns, /discount/i);
  const paymentField = find(columns, /payment|pay.?method|tender/i);
  const customerTypeField = find(columns, /customer.?type|segment|client.?type/i);
  const quantityField = find(columns, /quantity|qty|units?/i);
  const storeField = find(columns, /store|location|shop|outlet|branch/i);
  const salespersonField = find(columns, /salesperson|rep|agent|associate|employee|staff/i);
  const shippingField = find(columns, /shipping|delivery.?cost|freight/i);

  if (!metric) {
    return {
      title: "Data Analysis Report",
      summary: "No numeric measure detected. Add a sales, revenue, or amount column for analysis.",
      sections: [],
      kpis: [],
      tables: [],
      recommendations: [],
      warnings: ["No numeric measure detected in the dataset."],
    };
  }

  const values = rows.map(r => num(r[metric])).filter((v): v is number => v !== null);
  const total = values.reduce((s, v) => s + v, 0);
  const avg = values.length ? total / values.length : 0;
  const med = median(values);
  const std = stdDev(values);

  const kpis: AnalysisReport["kpis"] = [
    { label: "TOTAL " + metric.toUpperCase(), value: fmt(total) },
    { label: "ORDERS", value: values.length.toLocaleString() },
    { label: "AVG ORDER VALUE", value: fmt(avg) },
    { label: "MEDIAN ORDER", value: fmt(med) },
  ];

  if (quantityField) {
    const qtyValues = rows.map(r => num(r[quantityField])).filter((v): v is number => v !== null);
    kpis.push({ label: "TOTAL " + quantityField.toUpperCase(), value: qtyValues.reduce((s, v) => s + v, 0).toLocaleString() });
  }

  const sections: ReportSection[] = [];
  const tables: AnalysisReport["tables"] = [];
  const recommendations: string[] = [];
  const warnings: string[] = [];

  sections.push({
    title: "Executive Summary",
    content: `**${fmt(total)}** in ${metric} across **${values.length.toLocaleString()}** records with an average order value of **${fmt(avg)}**.`,
    type: "text",
  });

  // ── Regional Analysis ──
  if (regionField) {
    const groups = groupBy(rows, metric, regionField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count,
      aov: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;
      kpis.push({ label: "TOP " + regionField.toUpperCase(), value: leader.label, change: (leader.share * 100).toFixed(1) + "% share" });

      sections.push({
        title: "Regional Performance",
        content: `**${leader.label}** leads with **${fmt(leader.revenue)}** (${(leader.share * 100).toFixed(1)}% share) and the highest AOV of **${fmt(leader.aov)}**. **${weakest.label}** trails at **${fmt(weakest.revenue)}** (${(weakest.share * 100).toFixed(1)}%).`,
        type: "finding",
      });

      tables.push({
        title: "Revenue by " + regionField,
        headers: [regionField, "Revenue", "Share", "Orders", "AOV"],
        rows: ranking.map(r => [r.label, fmt(r.revenue), (r.share * 100).toFixed(1) + "%", r.count.toLocaleString(), fmt(r.aov)]),
      });

      if (returnField) {
        const rr = groupReturnRate(rows, returnField, regionField);
        if (rr.length) {
          sections.push({
            title: "Regional Return Rates",
            content: rr.map(r => `**${r.label}**: ${(r.rate * 100).toFixed(1)}% return rate (${r.count} orders)`).join("; ") + ".",
            type: "finding",
          });
          tables.push({
            title: "Return Rate by " + regionField,
            headers: [regionField, "Return Rate", "Orders"],
            rows: rr.map(r => [r.label, (r.rate * 100).toFixed(1) + "%", r.count.toLocaleString()]),
          });
          const worstRR = rr[0];
          if (worstRR.rate > 0.2) {
            warnings.push(`${worstRR.label} has a ${(worstRR.rate * 100).toFixed(1)}% return rate — investigate fulfillment and product quality.`);
          }
        }
      }

      const leaderPractices = `Replicate ${leader.label}'s approach (highest AOV: ${fmt(leader.aov)}) across underperforming ${regionField}s.`;
      recommendations.push(leaderPractices);
    }
  }

  // ── Product Analysis ──
  if (productField) {
    const groups = groupBy(rows, metric, productField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count,
      aov: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;

      sections.push({
        title: "Product Performance",
        content: `**${leader.label}** is the top product at **${fmt(leader.revenue)}** (${(leader.share * 100).toFixed(1)}%). **${weakest.label}** generates the least at **${fmt(weakest.revenue)}** (${(weakest.share * 100).toFixed(1)}%).`,
        type: "finding",
      });

      tables.push({
        title: "Revenue by " + productField,
        headers: [productField, "Revenue", "Share", "Orders", "AOV"],
        rows: ranking.map(r => [r.label, fmt(r.revenue), (r.share * 100).toFixed(1) + "%", r.count.toLocaleString(), fmt(r.aov)]),
      });

      if (returnField) {
        const rr = groupReturnRate(rows, returnField, productField);
        if (rr.length) {
          tables.push({
            title: "Return Rate by " + productField,
            headers: [productField, "Return Rate", "Orders"],
            rows: rr.map(r => [r.label, (r.rate * 100).toFixed(1) + "%", r.count.toLocaleString()]),
          });
          const worstProduct = rr[0];
          if (worstProduct.rate > 0.2) {
            warnings.push(`${worstProduct.label} has a ${(worstProduct.rate * 100).toFixed(1)}% return rate — check product quality or descriptions.`);
            recommendations.push(`Investigate root causes for ${worstProduct.label} returns (quality, sizing, description accuracy).`);
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
      label, revenue: g.total, orders: g.count,
    }));

    if (series.length >= 3) {
      const revenues = series.map(s => s.revenue);
      const changes: number[] = [];
      for (let i = 1; i < revenues.length; i++) changes.push(revenues[i] - revenues[i - 1]);
      const positive = changes.filter(c => c > 0).length;
      const consistency = (positive / changes.length) * 100;

      const firstHalf = revenues.slice(0, Math.floor(revenues.length / 2));
      const secondHalf = revenues.slice(Math.floor(revenues.length / 2));
      const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
      const halfChange = firstAvg > 0 ? ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100 : 0;

      let trendDesc: string;
      if (consistency >= 75) {
        trendDesc = `Strong upward momentum — ${consistency.toFixed(0)}% of periods showed growth.`;
        recommendations.push("Increase investment in this trajectory; set ambitious but achievable targets.");
      } else if (consistency <= 25) {
        trendDesc = `Persistent decline — ${(100 - consistency).toFixed(0)}% of periods showed decrease.`;
        warnings.push("Revenue trend is persistently declining. Investigate root causes before the trend solidifies.");
        recommendations.push("Conduct a root-cause analysis on the declining periods; identify what changed.");
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

      tables.push({
        title: "Monthly " + metric,
        headers: ["Month", "Revenue", "Orders"],
        rows: series.slice(-12).map(s => [s.label, fmt(s.revenue), s.count.toLocaleString()]),
      });
    }

    // Year-over-year
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
  }

  // ── Discount Analysis ──
  if (discountField) {
    const discValues = rows.map(r => num(r[discountField])).filter((v): v is number => v !== null);
    if (discValues.length) {
      const avgDisc = discValues.reduce((s, v) => s + v, 0) / discValues.length;
      const discounted = discValues.filter(v => v > 0).length;
      const discRate = discounted / discValues.length;

      kpis.push({ label: "AVG DISCOUNT", value: (avgDisc <= 1 ? avgDisc * 100 : avgDisc).toFixed(1) + "%" });

      if (discRate > 0.5) {
        warnings.push(`${(discRate * 100).toFixed(0)}% of orders have discounts. Verify discounts are driving profitable growth, not just volume.`);
        recommendations.push("Run controlled promotion tests; measure impact on net revenue and returns, not just order count.");
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
            orders: g.total,
            returnRate: g.total ? ((g.returned / g.total) * 100).toFixed(1) + "%" : "0%",
          }))
          .sort((a, b) => a.discount.localeCompare(b.discount));

        if (discReturnTable.length > 1) {
          tables.push({
            title: "Discount vs Return Rate",
            headers: ["Discount", "Orders", "Return Rate"],
            rows: discReturnTable.map(r => [r.discount, r.orders.toLocaleString(), r.returnRate]),
          });
        }
      }
    }
  }

  // ── Return Analysis ──
  if (returnField) {
    const overallRR = returnRate(rows, returnField);
    kpis.push({ label: "RETURN RATE", value: pct(overallRR), positive: overallRR < 0.15 });

    if (overallRR > 0.2) {
      warnings.push(`Overall return rate of ${(overallRR * 100).toFixed(1)}% is above industry norms (8-15%). This is a major margin leak.`);
      recommendations.push("Prioritize a return-reduction initiative: audit return reasons, refund values, and root causes by product and region.");
    }
  }

  // ── Payment Method Analysis ──
  if (paymentField) {
    const groups = groupBy(rows, metric, paymentField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count, aov: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      tables.push({
        title: "Revenue by " + paymentField,
        headers: [paymentField, "Revenue", "Orders", "AOV"],
        rows: ranking.map(r => [r.label, fmt(r.revenue), r.count.toLocaleString(), fmt(r.aov)]),
      });

      if (returnField) {
        const rr = groupReturnRate(rows, returnField, paymentField);
        if (rr.length && rr[0].rate > 0.25) {
          warnings.push(`${rr[0].label} has a ${(rr[0].rate * 100).toFixed(1)}% return rate — consider incentives for lower-return payment methods.`);
        }
      }
    }
  }

  // ── Customer Type Analysis ──
  if (customerTypeField) {
    const groups = groupBy(rows, metric, customerTypeField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count, aov: g.count ? g.total / g.count : 0,
      share: total ? g.total / total : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      sections.push({
        title: "Customer Segment Analysis",
        content: ranking.map(r => `**${r.label}**: ${fmt(r.revenue)} (${(r.share * 100).toFixed(1)}%), ${r.count.toLocaleString()} orders, ${fmt(r.aov)} AOV`).join("; ") + ".",
        type: "finding",
      });
    }
  }

  // ── Store/Location Analysis ──
  if (storeField) {
    const groups = groupBy(rows, metric, storeField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count, aov: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      tables.push({
        title: "Revenue by " + storeField,
        headers: [storeField, "Revenue", "Orders", "AOV"],
        rows: ranking.map(r => [r.label, fmt(r.revenue), r.count.toLocaleString(), fmt(r.aov)]),
      });
    }
  }

  // ── Salesperson Analysis ──
  if (salespersonField) {
    const groups = groupBy(rows, metric, salespersonField);
    const ranking = [...groups].map(([label, g]) => ({
      label, revenue: g.total, orders: g.count, aov: g.count ? g.total / g.count : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    if (ranking.length >= 2) {
      const leader = ranking[0];
      const weakest = ranking.at(-1)!;
      kpis.push({ label: "TOP " + salespersonField.toUpperCase(), value: leader.label, change: fmt(leader.revenue) });
      sections.push({
        title: "Salesperson Performance",
        content: `**${leader.label}** leads with **${fmt(leader.revenue)}** across ${leader.count} orders (${fmt(leader.aov)} AOV). **${weakest.label}** trails at **${fmt(weakest.revenue)}**.`,
        type: "finding",
      });
      recommendations.push(`Study ${leader.label}'s sales practices and create a playbook for the team.`);
    }
  }

  // ── Shipping Cost Analysis ──
  if (shippingField) {
    const shipValues = rows.map(r => num(r[shippingField])).filter((v): v is number => v !== null);
    if (shipValues.length) {
      const totalShip = shipValues.reduce((s, v) => s + v, 0);
      const avgShip = totalShip / shipValues.length;
      kpis.push({ label: "AVG SHIPPING", value: "$" + avgShip.toFixed(2) });
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
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = stdDev(values);
    const upper = mean + 2 * sd;
    const anomalies = values.filter(v => v > upper);
    if (anomalies.length > 0) {
      sections.push({
        title: "Anomaly Detection",
        content: `${anomalies.length} anomalous order${anomalies.length === 1 ? "" : "s"} detected (>${fmt(upper)}). These represent unusual transactions that may indicate bulk orders, data errors, or exceptional opportunities.`,
        type: "warning",
      });
      recommendations.push("Flag high-value orders at checkout for review; investigate if anomalies represent data errors or genuine large orders.");
    }
  }

  // ── Concentration Risk ──
  if (regionField || productField) {
    const dim = regionField || productField!;
    const groups = groupBy(rows, metric, dim);
    const sorted = [...groups].map(([, g]) => g.total).sort((a, b) => b - a);
    const top3 = sorted.slice(0, 3).reduce((s, v) => s + v, 0);
    const top3Pct = total ? top3 / total : 0;

    if (top3Pct >= 0.7) {
      warnings.push(`Top 3 ${dim}s account for ${(top3Pct * 100).toFixed(0)}% of revenue — high concentration risk.`);
      recommendations.push(`Diversify revenue across ${dim}s to reduce dependency on top performers.`);
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
      tables.push({
        title: "Top " + regionField + " x " + productField + " Combinations",
        headers: ["Combination", "Revenue", "Orders"],
        rows: topCombos.map(([key, g]) => [key, fmt(g.total), g.count.toLocaleString()]),
      });
    }
  }

  // ── Financial Impact Estimates ──
  if (returnField && values.length > 0) {
    const overallRR = returnRate(rows, returnField);
    if (overallRR > 0.15) {
      const savedIfImproved = total * (overallRR - 0.15);
      sections.push({
        title: "Financial Impact Estimate",
        content: `Reducing returns from ${(overallRR * 100).toFixed(1)}% to 15% could recover approximately **${fmt(savedIfImproved)}** in annual revenue.`,
        type: "recommendation",
      });
    }
  }

  // ── Final Recommendations ──
  if (recommendations.length === 0) {
    recommendations.push("Upload a dataset with region, product, and date fields for richer analysis.");
  }

  const summary = sections.find(s => s.title === "Executive Summary")?.content || "";

  return {
    title: "Comprehensive Data Analysis Report",
    summary,
    sections,
    kpis,
    tables,
    recommendations: recommendations.slice(0, 8),
    warnings,
  };
}
