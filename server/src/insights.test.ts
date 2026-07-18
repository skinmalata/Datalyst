import { describe, it, expect } from "vitest";
import { generateInsights, type Insight } from "./insights.js";
import type { Plan } from "./analysis.js";

function plan(overrides: Partial<Plan> = {}): Plan {
  return { operation: "top_values", field: "revenue", groupBy: "region", ...overrides };
}

function row(region: string, revenue: number): Record<string, unknown> {
  return { region, revenue };
}

describe("generateInsights", () => {
  describe("concentration (non-rate fields)", () => {
    it("warns when top 3 account for >70% of total", () => {
      const rows = [
        row("A", 500), row("A", 500),
        row("B", 300), row("B", 300),
        row("C", 200), row("C", 200),
        row("D", 50), row("D", 50),
        row("E", 50), row("E", 50),
      ];
      const result = {
        values: [
          { label: "A", value: 1000 },
          { label: "B", value: 600 },
          { label: "C", value: 400 },
          { label: "D", value: 100 },
          { label: "E", value: 100 },
        ],
        method: "Sum of revenue grouped by region",
      };
      const insights = generateInsights(rows, plan(), result);
      const warning = insights.find(i => i.title === "High concentration risk");
      expect(warning).toBeDefined();
      expect(warning!.priority).toBe("high");
      // A(1000)+B(600)+C(400) = 2000 / total 2200 = 90.9%
      expect(warning!.detail).toContain("91%");
    });

    it("reports well-diversified when top 3 are <40%", () => {
      const rows = [
        row("A", 100), row("B", 100), row("C", 100),
        row("D", 100), row("E", 100), row("F", 100),
        row("G", 100), row("H", 100),
      ];
      const result = {
        values: [
          { label: "A", value: 100 }, { label: "B", value: 100 },
          { label: "C", value: 100 }, { label: "D", value: 100 },
          { label: "E", value: 100 }, { label: "F", value: 100 },
          { label: "G", value: 100 }, { label: "H", value: 100 },
        ],
        method: "Sum of revenue grouped by region",
      };
      const insights = generateInsights(rows, plan(), result);
      const diversified = insights.find(i => i.title === "Well-diversified distribution");
      expect(diversified).toBeDefined();
      expect(diversified!.detail).toContain("38%");
    });

    it("uses full dataset rows, not truncated result values", () => {
      const rows = [
        row("A", 100), row("B", 100), row("C", 100),
        row("D", 100), row("E", 100),
      ];
      const result = {
        values: [
          { label: "A", value: 100 },
          { label: "B", value: 100 },
        ],
        method: "Sum of revenue grouped by region",
      };
      const insights = generateInsights(rows, plan({ limit: 2 }), result);
      const warning = insights.find(i => i.title === "High concentration risk");
      const diversified = insights.find(i => i.title === "Well-diversified distribution");
      // With full data: top 3 of 5 groups = 60%, neither threshold hit
      expect(warning).toBeUndefined();
      expect(diversified).toBeUndefined();
    });
  });

  describe("bottom-ranking insights", () => {
    it("identifies leader gap correctly for bottom_values", () => {
      const rows = [
        row("A", 10), row("B", 20), row("C", 30),
        row("D", 40), row("E", 300),
      ];
      const result = {
        values: [
          { label: "A", value: 10 },
          { label: "B", value: 20 },
          { label: "C", value: 30 },
          { label: "D", value: 40 },
          { label: "E", value: 300 },
        ],
        method: "Lowest revenue grouped by region",
      };
      const insights = generateInsights(rows, plan(), result);
      // Leader gap should use the actual max (E=300), not the first element (A=10)
      const gap = insights.find(i => i.title === "Significant leader gap");
      expect(gap).toBeDefined();
      expect(gap!.detail).toContain("x the median");
    });

    it("correctly identifies underperforming areas for bottom_values", () => {
      const rows = [
        row("A", 5), row("B", 5), row("C", 5),
        row("D", 100), row("E", 100), row("F", 100),
        row("G", 100), row("H", 100),
      ];
      const result = {
        values: [
          { label: "A", value: 5 },
          { label: "B", value: 5 },
          { label: "C", value: 5 },
        ],
        method: "Lowest revenue grouped by region",
      };
      const insights = generateInsights(rows, plan(), result);
      const underperforming = insights.find(i => i.title === "Underperforming areas need attention");
      expect(underperforming).toBeDefined();
    });
  });

  describe("rate fields", () => {
    it("skips concentration check for rate fields", () => {
      const rows = [
        { region: "A", margin: 0.5 },
        { region: "B", margin: 0.1 },
        { region: "C", margin: 0.05 },
      ];
      const result = {
        values: [
          { label: "A", value: 0.5 },
          { label: "B", value: 0.1 },
          { label: "C", value: 0.05 },
        ],
        method: "Average of margin grouped by region",
      };
      const insights = generateInsights(rows, plan({ field: "margin" }), result);
      const warning = insights.find(i => i.title === "High concentration risk");
      expect(warning).toBeUndefined();
    });

    it("still reports variance for rate fields", () => {
      const rows = [
        { region: "A", margin: 0.5 },
        { region: "B", margin: 0.1 },
        { region: "C", margin: 0.05 },
        { region: "D", margin: 0.4 },
        { region: "E", margin: 0.02 },
      ];
      const result = {
        values: [
          { label: "A", value: 0.5 },
          { label: "B", value: 0.1 },
          { label: "C", value: 0.05 },
          { label: "D", value: 0.4 },
          { label: "E", value: 0.02 },
        ],
        method: "Average of margin grouped by region",
      };
      const insights = generateInsights(rows, plan({ field: "margin" }), result);
      const variance = insights.find(i => i.title === "High variance across groups");
      expect(variance).toBeDefined();
    });
  });

  describe("trend insights", () => {
    it("detects strong upward momentum", () => {
      const result = {
        values: [
          { label: "2024-01", value: 100 },
          { label: "2024-02", value: 120 },
          { label: "2024-03", value: 140 },
          { label: "2024-04", value: 160 },
          { label: "2024-05", value: 180 },
        ],
        trend: { periods: 5, first: 100, last: 180, percentChange: 80, observations: 50 },
        method: "Monthly trend of revenue",
      };
      const insights = generateInsights([], plan({ operation: "trend", timeField: "date" }), result);
      const momentum = insights.find(i => i.title === "Strong upward momentum");
      expect(momentum).toBeDefined();
      expect(momentum!.priority).toBe("high");
    });

    it("detects persistent decline", () => {
      const result = {
        values: [
          { label: "2024-01", value: 200 },
          { label: "2024-02", value: 180 },
          { label: "2024-03", value: 160 },
          { label: "2024-04", value: 140 },
          { label: "2024-05", value: 120 },
        ],
        trend: { periods: 5, first: 200, last: 120, percentChange: -40, observations: 50 },
        method: "Monthly trend of revenue",
      };
      const insights = generateInsights([], plan({ operation: "trend", timeField: "date" }), result);
      const decline = insights.find(i => i.title === "Persistent decline detected");
      expect(decline).toBeDefined();
      expect(decline!.priority).toBe("high");
    });

    it("detects momentum shift", () => {
      const result = {
        values: [
          { label: "2024-01", value: 100 },
          { label: "2024-02", value: 105 },
          { label: "2024-03", value: 110 },
          { label: "2024-04", value: 150 },
          { label: "2024-05", value: 200 },
          { label: "2024-06", value: 260 },
        ],
        trend: { periods: 6, first: 100, last: 260, percentChange: 160, observations: 60 },
        method: "Monthly trend of revenue",
      };
      const insights = generateInsights([], plan({ operation: "trend", timeField: "date" }), result);
      const shift = insights.find(i => i.title === "Momentum shift detected");
      expect(shift).toBeDefined();
    });
  });

  describe("forecast insights", () => {
    it("warns on high MAPE", () => {
      const result = {
        forecast: [100, 110, 120],
        totalForecast: 330,
        validation: { mapePercent: 32.5, holdoutPeriods: 3 },
        method: "Forecast of revenue",
      };
      const insights = generateInsights([], plan({ operation: "forecast", timeField: "date" }), result);
      const warning = insights.find(i => i.title === "Low-confidence forecast");
      expect(warning).toBeDefined();
      expect(warning!.priority).toBe("high");
      expect(warning!.detail).toContain("32.5%");
    });

    it("reports high confidence on low MAPE", () => {
      const result = {
        forecast: [100, 110, 120],
        totalForecast: 330,
        validation: { mapePercent: 5.2, holdoutPeriods: 3 },
        method: "Forecast of revenue",
      };
      const insights = generateInsights([], plan({ operation: "forecast", timeField: "date" }), result);
      const opp = insights.find(i => i.title === "High-confidence forecast");
      expect(opp).toBeDefined();
      expect(opp!.priority).toBe("medium");
    });
  });

  describe("anomaly insights", () => {
    it("warns on widespread anomalies", () => {
      const result = {
        values: [
          { value: 100, zScore: 3.1 },
          { value: 200, zScore: 3.5 },
          { value: 50, zScore: -2.8 },
          { value: 300, zScore: 4.0 },
          { value: 10, zScore: -3.2 },
        ],
        method: "Z-score anomaly detection for revenue",
      };
      const rows = Array.from({ length: 100 }, (_, i) => row(`R${i}`, 100));
      const insights = generateInsights(rows, plan({ operation: "anomalies" }), result);
      const warning = insights.find(i => i.title === "Widespread anomalies");
      expect(warning).toBeDefined();
    });

    it("flags extreme outliers", () => {
      const result = {
        values: [
          { value: 500, zScore: 3.8 },
          { value: 600, zScore: 4.2 },
        ],
        method: "Z-score anomaly detection for revenue",
      };
      const rows = Array.from({ length: 50 }, (_, i) => row(`R${i}`, 100));
      const insights = generateInsights(rows, plan({ operation: "anomalies" }), result);
      const extreme = insights.find(i => i.title === "Extreme outliers detected");
      expect(extreme).toBeDefined();
      expect(extreme!.detail).toContain("2 values are");
    });
  });

  describe("comparison insights", () => {
    it("flags material improvement", () => {
      const result = {
        value: 150,
        comparison: { baseline: 100, difference: 50, percentChange: 50 },
        method: "Sum of revenue",
      };
      const insights = generateInsights([], plan({ operation: "sum" }), result);
      const shift = insights.find(i => i.title === "Material performance shift");
      expect(shift).toBeDefined();
      expect(shift!.type).toBe("opportunity");
      expect(shift!.detail).toContain("improvement");
    });

    it("flags material decline", () => {
      const result = {
        value: 75,
        comparison: { baseline: 100, difference: -25, percentChange: -25 },
        method: "Sum of revenue",
      };
      const insights = generateInsights([], plan({ operation: "sum" }), result);
      const shift = insights.find(i => i.title === "Material performance shift");
      expect(shift).toBeDefined();
      expect(shift!.type).toBe("warning");
      expect(shift!.detail).toContain("decline");
    });

    it("reports no meaningful change for small gaps", () => {
      const result = {
        value: 101,
        comparison: { baseline: 100, difference: 1, percentChange: 1 },
        method: "Sum of revenue",
      };
      const insights = generateInsights([], plan({ operation: "sum" }), result);
      const noChange = insights.find(i => i.title === "No meaningful change");
      expect(noChange).toBeDefined();
      expect(noChange!.priority).toBe("low");
    });
  });

  describe("next steps", () => {
    it("provides actionable next steps for top_values", () => {
      const result = {
        values: [
          { label: "A", value: 100 },
          { label: "B", value: 80 },
          { label: "C", value: 60 },
        ],
        method: "Sum of revenue grouped by region",
      };
      const insights = generateInsights([], plan(), result);
      const next = insights.find(i => i.title === "Recommended next steps");
      expect(next).toBeDefined();
      expect(next!.detail).toContain("Compare the top 3");
    });

    it("provides targeted steps for bottom_values", () => {
      const result = {
        values: [
          { label: "A", value: 10 },
          { label: "B", value: 20 },
          { label: "C", value: 30 },
        ],
        method: "Lowest revenue grouped by region",
      };
      const insights = generateInsights([], plan(), result);
      const next = insights.find(i => i.title === "Recommended next steps");
      expect(next).toBeDefined();
      expect(next!.detail).toContain("bottom-performing");
    });
  });

  describe("fallback insights", () => {
    it("generates fallback for simple sum results", () => {
      const result = { value: 5000, method: "Sum of revenue", evidence: { recordsMatched: 100 } };
      const insights = generateInsights([], plan({ operation: "sum" }), result);
      expect(insights.length).toBeGreaterThan(0);
      const context = insights.find(i => i.title === "Result context");
      expect(context).toBeDefined();
    });
  });

  describe("negative values", () => {
    it("handles mixed positive/negative grouped values", () => {
      const rows = [
        row("A", 100), row("B", -50), row("C", 200),
        row("D", -30), row("E", 150),
      ];
      const result = {
        values: [
          { label: "C", value: 200 },
          { label: "E", value: 150 },
          { label: "A", value: 100 },
          { label: "B", value: -50 },
          { label: "D", value: -30 },
        ],
        method: "Sum of revenue grouped by region",
      };
      const insights = generateInsights(rows, plan(), result);
      expect(insights.length).toBeGreaterThan(0);
      // Should not crash and should produce valid insights
      insights.forEach(i => {
        expect(i.type).toMatch(/^(recommendation|warning|opportunity|context)$/);
        expect(i.priority).toMatch(/^(high|medium|low)$/);
        expect(i.detail.length).toBeGreaterThan(0);
      });
    });
  });
});
