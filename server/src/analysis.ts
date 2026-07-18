type Row = Record<string, unknown>;

export type Filter = {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "gt" | "gte" | "lt" | "lte";
  value: string | number | boolean;
};
export type Plan = {
  operation: "sum" | "average" | "top_values" | "bottom_values" | "trend" | "forecast" | "anomalies";
  field: string;
  timeField?: string;
  groupBy?: string;
  limit?: number;
  filters?: Filter[];
  comparisonFilters?: Filter[];
};

function numeric(value: unknown) {
  const parsed = Number(String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$,%\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
function isRateField(field: string) { return /(rate|margin|percent|percentage)/i.test(field); }
function matches(row: Row, filter: Filter) {
  const source = row[filter.field];
  const sourceNumber = numeric(source), filterNumber = numeric(filter.value);
  if (filter.operator === "contains") return String(source ?? "").toLowerCase().includes(String(filter.value).toLowerCase());
  if (filter.operator === "equals") return String(source ?? "").toLowerCase() === String(filter.value).toLowerCase();
  if (filter.operator === "not_equals") return String(source ?? "").toLowerCase() !== String(filter.value).toLowerCase();
  if (sourceNumber === null || filterNumber === null) return false;
  return filter.operator === "gt" ? sourceNumber > filterNumber : filter.operator === "gte" ? sourceNumber >= filterNumber : filter.operator === "lt" ? sourceNumber < filterNumber : sourceNumber <= filterNumber;
}
function filtered(rows: Row[], filters: Filter[] = []) { return rows.filter(row => filters.every(filter => matches(row, filter))); }
function aggregate(rows: Row[], plan: Plan) {
  const values = rows.map(row => ({ row, value: numeric(row[plan.field]) })).filter((item): item is { row: Row; value: number } => item.value !== null);
  if (plan.operation === "sum") return { value: values.reduce((total, item) => total + item.value, 0), recordsUsed: values.length, method: `Sum of ${plan.field}` };
  if (plan.operation === "average") return { value: values.length ? values.reduce((total, item) => total + item.value, 0) / values.length : 0, recordsUsed: values.length, method: `Average of ${plan.field}` };
  if (plan.operation === "top_values") {
    const groups = new Map<string, number>();
    values.forEach(item => { const key = String(item.row[plan.groupBy!] ?? "Unknown"); groups.set(key, (groups.get(key) || 0) + item.value); });
    return { values: [...groups].sort((a, b) => b[1] - a[1]).slice(0, plan.limit || 5).map(([label, value]) => ({ label, value })), recordsUsed: values.length, method: `Sum of ${plan.field} grouped by ${plan.groupBy}` };
  }
  if (plan.operation === "bottom_values") {
    const groups = new Map<string, number>();
    values.forEach(item => { const key = String(item.row[plan.groupBy!] ?? "Unknown"); groups.set(key, (groups.get(key) || 0) + item.value); });
    return { values: [...groups].sort((a, b) => a[1] - b[1]).slice(0, plan.limit || 5).map(([label, value]) => ({ label, value })), recordsUsed: values.length, method: "Lowest " + plan.field + " grouped by " + plan.groupBy };
  }
  return { rows: values.map(item => item.row), recordsUsed: values.length, method: `Forecast input: ${plan.field}` };
}

export function validatePlan(plan: Plan, columns: string[]) {
  const operations = ["sum", "average", "top_values", "bottom_values", "trend", "forecast", "anomalies"];
  const filters = [...(plan.filters || []), ...(plan.comparisonFilters || [])];
  if (!plan || !operations.includes(plan.operation) || !columns.includes(plan.field) || (plan.timeField && !columns.includes(plan.timeField)) || (plan.groupBy && !columns.includes(plan.groupBy)) || filters.some(filter => !columns.includes(filter.field))) throw new Error("The analysis plan uses a field or operation that is not approved for this dataset.");
  if ((plan.operation === "top_values" || plan.operation === "bottom_values") && !plan.groupBy) throw new Error("A grouped analysis needs a groupBy field.");
  if ((plan.operation === "trend" || plan.operation === "forecast") && !plan.timeField) throw new Error("A trend or forecast analysis needs a time field.");
}

export function executePlan(rows: Row[], plan: Plan) {
  const selected = filtered(rows, plan.filters);
  if (plan.operation === "trend") {
    const buckets = new Map<string, number>();
    let observations = 0;
    selected.forEach(row => {
      const date = new Date(String(row[plan.timeField!] ?? ""));
      const value = numeric(row[plan.field]);
      if (Number.isNaN(date.getTime()) || value === null) return;
      const period = String(date.getUTCFullYear()) + "-" + String(date.getUTCMonth() + 1).padStart(2, "0");
      buckets.set(period, (buckets.get(period) || 0) + value); observations++;
    });
    const values = [...buckets].sort((a,b) => a[0].localeCompare(b[0])).map(([label,value]) => ({label,value}));
    const first = values[0]?.value || 0, last = values.at(-1)?.value || 0;
    const percentChange = first === 0 ? null : Number((((last-first)/Math.abs(first))*100).toFixed(1));
    return { values, recordsUsed:values.length, method:"Monthly trend of "+plan.field, trend:{periods:values.length,first,last,percentChange,observations}, evidence:{recordsInput:rows.length,recordsMatched:observations,filters:plan.filters||[]} };
  }
  if ((plan.operation === "top_values" || plan.operation === "bottom_values") && isRateField(plan.field)) {
    const groups = new Map<string, { total:number; count:number }>();
    selected.forEach(row => {
      const value=numeric(row[plan.field]); if(value===null) return;
      const key=String(row[plan.groupBy!] ?? "Unknown"), current=groups.get(key)||{total:0,count:0};
      current.total+=value; current.count++; groups.set(key,current);
    });
    const values=[...groups].map(([label,group])=>({label,value:group.total/group.count})).sort((a,b)=>plan.operation==="top_values"?b.value-a.value:a.value-b.value).slice(0,plan.limit||5);
    return { values, recordsUsed:selected.length, method:(plan.operation==="top_values"?"Highest average of ":"Lowest average of ")+plan.field+" grouped by "+plan.groupBy, evidence:{recordsInput:rows.length,recordsMatched:selected.length,filters:plan.filters||[],aggregation:"average for rate metric"} };
  }
  if (plan.operation === "anomalies") {
    const values = selected.map((row, index) => ({ row, index, value: numeric(row[plan.field]) })).filter((item): item is { row: Row; index: number; value: number } => item.value !== null);
    const mean = values.reduce((total, item) => total + item.value, 0) / Math.max(values.length, 1);
    const deviation = Math.sqrt(values.reduce((total, item) => total + (item.value - mean) ** 2, 0) / Math.max(values.length, 1));
    const anomalies = values.filter(item => deviation > 0 && Math.abs((item.value - mean) / deviation) >= 2.5).sort((a, b) => Math.abs(b.value - mean) - Math.abs(a.value - mean)).slice(0, plan.limit || 20).map(item => ({ recordIndex: item.index, value: item.value, zScore: Number(((item.value - mean) / deviation).toFixed(2)), row: item.row }));
    return { values: anomalies, recordsUsed: values.length, method: `Z-score anomaly detection for ${plan.field}`, evidence: { recordsInput: rows.length, recordsMatched: selected.length, filters: plan.filters || [], threshold: 2.5 } };
  }
  const result = aggregate(selected, plan);
  const evidence = { recordsInput: rows.length, recordsMatched: selected.length, filters: plan.filters || [] };
  if (!plan.comparisonFilters?.length) return { ...result, evidence };
  const baseline = aggregate(filtered(rows, plan.comparisonFilters), plan);
  if (typeof result.value !== "number" || typeof baseline.value !== "number") throw new Error("Comparisons are available for sum and average analyses.");
  const difference = result.value - baseline.value;
  return { ...result, evidence: { ...evidence, comparisonFilters: plan.comparisonFilters, baselineRecords: baseline.recordsUsed }, comparison: { baseline: baseline.value, difference, percentChange: baseline.value === 0 ? null : (difference / Math.abs(baseline.value)) * 100 } };
}
