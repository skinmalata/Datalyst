import type { Message } from "@/store/useStore";

export function chartForResult(output: any): Pick<Message, "values" | "chartType"> {
  if (Array.isArray(output.forecast) && output.forecast.length) {
    return { chartType: "line", values: output.forecast.map((value: number, index: number) => ({ label: "Forecast " + (index + 1), value })) };
  }
  if (Array.isArray(output.values) && output.values.length) {
    const anomaly = /anomaly|outlier/i.test(String(output.method || ""));
    return {
      chartType: anomaly ? "scatter" : /trend/i.test(String(output.method || "")) ? "line" : "bar",
      values: output.values.map((item: any, index: number) => ({ label: String(item.label || "Record " + ((item.recordIndex ?? index) + 1)), value: Number(item.value), zScore: anomaly ? Number(item.zScore) : undefined })),
    };
  }
  if (output.comparison && Number.isFinite(Number(output.value)) && Number.isFinite(Number(output.comparison.baseline))) {
    return { chartType: "bar", values: [{ label: "Current", value: Number(output.value) }, { label: "Baseline", value: Number(output.comparison.baseline) }] };
  }
  return {};
}
