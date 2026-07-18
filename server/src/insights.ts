import type { Plan } from "./analysis.js";

type Row = Record<string, unknown>;

export type Insight = {
  type: "recommendation" | "warning" | "opportunity" | "context";
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

function numeric(value: unknown) {
  const parsed = Number(String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isRateField(field: string) { return /(rate|margin|percent|percentage)/i.test(field); }

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(values: number[]) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

function coefficientOfVariation(values: number[]) {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return 0;
  return (standardDeviation(values) / Math.abs(mean)) * 100;
}

function reaggregate(rows: Row[], field: string, groupBy: string): { label: string; value: number }[] {
  const groups = new Map<string, { total: number; count: number }>();
  rows.forEach(row => {
    const v = numeric(row[field]);
    if (v === null) return;
    const key = String(row[groupBy] ?? "Unknown");
    const entry = groups.get(key) || { total: 0, count: 0 };
    entry.total += v;
    entry.count++;
    groups.set(key, entry);
  });
  return [...groups].map(([label, g]) => ({ label, value: g.total })).sort((a, b) => b.value - a.value);
}

function reaggregateAverages(rows: Row[], field: string, groupBy: string): { label: string; value: number }[] {
  const groups = new Map<string, { total: number; count: number }>();
  rows.forEach(row => {
    const v = numeric(row[field]);
    if (v === null) return;
    const key = String(row[groupBy] ?? "Unknown");
    const entry = groups.get(key) || { total: 0, count: 0 };
    entry.total += v;
    entry.count++;
    groups.set(key, entry);
  });
  return [...groups].map(([label, g]) => ({ label, value: g.total / g.count })).sort((a, b) => b.value - a.value);
}

export function generateInsights(rows: Row[], plan: Plan, result: any): Insight[] {
  const insights: Insight[] = [];
  const field = plan.field;
  const groupBy = plan.groupBy || "";
  const method = String(result.method || "");
  const isGrouped = Array.isArray(result.values) && result.values.length >= 2 && groupBy;
  const isTrend = !!result.trend;
  const isForecast = !!result.forecast;
  const isAnomaly = /anomaly|outlier/i.test(method);
  const isComparison = !!result.comparison;
  const isBottom = /lowest|bottom|weakest/i.test(method);
  const rateField = isRateField(field);

  if (isGrouped) {
    const fullValues = rateField
      ? reaggregateAverages(rows, field, groupBy)
      : reaggregate(rows, field, groupBy);

    if (fullValues.length >= 2) {
      const allGroupValues = fullValues.map(v => v.value);
      const total = allGroupValues.reduce((s, v) => s + v, 0);

      if (!rateField && total > 0) {
        const top3Total = allGroupValues.slice(0, 3).reduce((s, v) => s + v, 0);
        const concentration = (top3Total / total) * 100;

        if (concentration >= 70) {
          insights.push({
            type: "warning",
            title: "High concentration risk",
            detail: `The top 3 ${groupBy} account for ${concentration.toFixed(0)}% of total ${field}. Your performance is heavily dependent on a small number of areas. A disruption to any one of them would materially impact your overall results.`,
            priority: "high",
          });
        } else if (concentration <= 40) {
          insights.push({
            type: "context",
            title: "Well-diversified distribution",
            detail: `The top 3 ${groupBy} account for only ${concentration.toFixed(0)}% of total ${field}, indicating a healthy spread of performance across your ${groupBy}.`,
            priority: "low",
          });
        }
      }

      const med = median(allGroupValues);
      const sortedForRanking = isBottom ? [...allGroupValues].sort((a, b) => a - b) : allGroupValues;
      const bestValue = sortedForRanking[sortedForRanking.length - 1] ?? 0;
      const worstValue = sortedForRanking[0] ?? 0;
      const ratio = med > 0 ? bestValue / med : 0;

      if (ratio >= 3) {
        insights.push({
          type: "opportunity",
          title: "Significant leader gap",
          detail: `The top ${groupBy} is ${ratio.toFixed(1)}x the median. This suggests best practices from the leader could be replicated in underperforming areas to lift overall ${field}.`,
          priority: "high",
        });
      }

      if (allGroupValues.length >= 5) {
        const sortedAsc = [...allGroupValues].sort((a, b) => a - b);
        const bottomThree = sortedAsc.slice(0, 3);
        const bottomAvg = bottomThree.reduce((s, v) => s + v, 0) / bottomThree.length;
        const overallAvg = rateField
          ? allGroupValues.reduce((s, v) => s + v, 0) / allGroupValues.length
          : total / allGroupValues.length;

        if (overallAvg > 0 && bottomAvg < overallAvg * 0.3) {
          insights.push({
            type: "recommendation",
            title: "Underperforming areas need attention",
            detail: `The bottom 3 ${groupBy} average ${rateField ? bottomAvg.toFixed(1) + "%" : bottomAvg.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${field}, which is less than 30% of the overall average. Investigate whether these areas can be improved or if resources should be reallocated.`,
            priority: "high",
          });
        }
      }

      const cv = coefficientOfVariation(allGroupValues);
      if (cv > 50) {
        insights.push({
          type: "context",
          title: "High variance across groups",
          detail: `The coefficient of variation is ${cv.toFixed(0)}%, meaning ${groupBy} performance varies widely. This may indicate inconsistent execution, market differences, or data quality issues.`,
          priority: "medium",
        });
      }
    }
  }

  if (isTrend && result.values.length >= 3) {
    const values = result.values.map((v: any) => Number(v.value)).filter((v: number) => Number.isFinite(v));
    const changes: number[] = [];
    for (let i = 1; i < values.length; i++) changes.push(values[i] - values[i - 1]);
    const positive = changes.filter(c => c > 0).length;
    const consistency = (positive / changes.length) * 100;
    const cv = coefficientOfVariation(values);

    if (consistency >= 75) {
      insights.push({
        type: "opportunity",
        title: "Strong upward momentum",
        detail: `${consistency.toFixed(0)}% of periods showed growth in ${field}. This consistent trajectory supports increasing investment or setting more ambitious targets.`,
        priority: "high",
      });
    } else if (consistency <= 25) {
      insights.push({
        type: "warning",
        title: "Persistent decline detected",
        detail: `${(100 - consistency).toFixed(0)}% of periods showed a decrease in ${field}. This is not a one-time dip — investigate root causes before the trend becomes harder to reverse.`,
        priority: "high",
      });
    } else {
      insights.push({
        type: "context",
        title: "Mixed momentum",
        detail: `${field} shows ${positive} up periods and ${changes.length - positive} down periods across ${values.length} months. The trend is not clearly directional — look for seasonal patterns or external factors.`,
        priority: "medium",
      });
    }

    if (cv > 30) {
      insights.push({
        type: "context",
        title: "Volatile trend history",
        detail: `Month-to-month variation is ${cv.toFixed(0)}% of the mean. Forecasts based on this history will have wider confidence intervals — treat projections as directional, not precise.`,
        priority: "medium",
      });
    }

    if (values.length >= 4) {
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((s: number, v: number) => s + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s: number, v: number) => s + v, 0) / secondHalf.length;
      if (firstAvg > 0) {
        const halfChange = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
        if (Math.abs(halfChange) >= 15) {
          insights.push({
            type: "recommendation",
            title: "Momentum shift detected",
            detail: `The second half of the history averages ${halfChange > 0 ? "+" : ""}${halfChange.toFixed(1)}% compared to the first half. ${halfChange > 0 ? "Recent acceleration suggests the trend is strengthening." : "Recent deceleration warrants investigation into what changed."}`,
            priority: "high",
          });
        }
      }
    }
  }

  if (isForecast) {
    const total = Number.isFinite(Number(result.totalForecast))
      ? result.totalForecast
      : (result.forecast || []).reduce((s: number, v: number) => s + Number(v || 0), 0);
    const mape = result.validation?.mapePercent;
    if (mape !== undefined && mape !== null) {
      if (mape <= 10) {
        insights.push({
          type: "opportunity",
          title: "High-confidence forecast",
          detail: `The model's validation error is ${mape.toFixed(1)}% MAPE, indicating strong predictive accuracy. You can use this forecast for planning with reasonable confidence.`,
          priority: "medium",
        });
      } else if (mape >= 25) {
        insights.push({
          type: "warning",
          title: "Low-confidence forecast",
          detail: `The validation error is ${mape.toFixed(1)}% MAPE, meaning the forecast has significant uncertainty. Use this as a directional guide only — do not commit resources based on these numbers alone.`,
          priority: "high",
        });
      }
    }
    if (total > 0) {
      insights.push({
        type: "recommendation",
        title: "Planning implication",
        detail: `The projected total of ${rateField ? total.toFixed(1) + "%" : total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${field} should be stress-tested against your targets. Consider scenario planning at -10% and +10% to prepare for variance.`,
        priority: "medium",
      });
    }
  }

  if (isAnomaly && Array.isArray(result.values) && result.values.length > 0) {
    const anomalyCount = result.values.length;
    const anomalyTotal = result.values.reduce((s: number, v: any) => s + Math.abs(Number(v.value) || 0), 0);
    const allValues = rows.map(r => numeric(r[field])).filter((v): v is number => v !== null);
    const allTotal = allValues.reduce((s, v) => s + Math.abs(v), 0);
    const impact = allTotal > 0 ? ((anomalyTotal / allTotal) * 100).toFixed(1) : "0";

    if (anomalyCount >= 5) {
      insights.push({
        type: "warning",
        title: "Widespread anomalies",
        detail: `${anomalyCount} unusual values detected, representing ${impact}% of the total ${field}. This volume suggests either systemic issues (data quality, process failures) or a genuinely volatile metric that needs tighter monitoring.`,
        priority: "high",
      });
    } else {
      insights.push({
        type: "recommendation",
        title: "Targeted investigation needed",
        detail: `${anomalyCount} outlier${anomalyCount === 1 ? "" : "s"} found with ${impact}% total impact. Each should be investigated individually — they may represent data entry errors, fraud signals, or exceptional opportunities worth replicating.`,
        priority: "high",
      });
    }

    const highZScores = result.values.filter((v: any) => Math.abs(v.zScore) >= 3);
    if (highZScores.length > 0) {
      insights.push({
        type: "warning",
        title: "Extreme outliers detected",
        detail: `${highZScores.length} value${highZScores.length === 1 ? " is" : "s are"} more than 3 standard deviations from the mean. These are statistically extreme and should be validated for data integrity before any business action is taken.`,
        priority: "high",
      });
    }
  }

  if (isComparison) {
    const pct = result.comparison.percentChange;
    const gap = Math.abs(pct || 0);
    if (gap >= 25) {
      insights.push({
        type: pct > 0 ? "opportunity" : "warning",
        title: "Material performance shift",
        detail: `The ${pct > 0 ? "improvement" : "decline"} of ${gap.toFixed(1)}% versus baseline is a notable change. ${pct > 0 ? "This validates your current approach — consider doubling down." : "This requires immediate root cause analysis to prevent further erosion."}`,
        priority: "high",
      });
    } else if (gap <= 3) {
      insights.push({
        type: "context",
        title: "No meaningful change",
        detail: `The ${gap.toFixed(1)}% difference from baseline is within normal variation. There is no evidence of a material shift in performance.`,
        priority: "low",
      });
    }
  }

  if (isGrouped && result.values.length >= 3 && !isAnomaly) {
    insights.push({
      type: "recommendation",
      title: "Recommended next steps",
      detail: getActionableNextSteps(plan, result),
      priority: "medium",
    });
  }

  if (insights.length === 0) {
    return generateFallbackInsights(plan, result);
  }

  return insights.slice(0, 6);
}

function getActionableNextSteps(plan: Plan, result: any): string {
  const field = plan.field;
  const groupBy = plan.groupBy || "";
  const method = String(result.method || "");
  const isBottom = /lowest|bottom|weakest/i.test(method);

  if (isBottom) {
    return `Review the bottom-performing ${groupBy} to determine which ones can be improved with targeted investment and which should be deprioritized. Set specific recovery targets for each and track progress monthly.`;
  }
  if (isRateField(field)) {
    return `Identify the ${groupBy} with the best ${field} and study what they do differently. Document best practices and create a playbook for underperforming areas to replicate.`;
  }
  return `Compare the top 3 ${groupBy} against each other to identify what drives their performance. Then assess whether the bottom performers have structural barriers or simply need the same approach applied.`;
}

function generateFallbackInsights(plan: Plan, result: any): Insight[] {
  const insights: Insight[] = [];
  const field = plan.field;
  const method = String(result.method || "");

  if (typeof result.value === "number") {
    insights.push({
      type: "context",
      title: "Result context",
      detail: `The ${method.toLowerCase()} of ${field} is ${isRateField(field) ? result.value.toFixed(1) + "%" : result.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}. ${(result.evidence?.recordsMatched || 0)} records contributed to this result.`,
      priority: "low",
    });
  }

  if (plan.operation === "sum" || plan.operation === "average") {
    insights.push({
      type: "recommendation",
      title: "Suggested next step",
      detail: `Ask "Which ${plan.groupBy || "area"} is driving this ${field}?" to understand the composition behind this number, or "Is our ${field} improving over time?" to see the trend.`,
      priority: "medium",
    });
  }

  return insights;
}
