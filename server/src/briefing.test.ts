import { describe, expect, it } from "vitest";
import { buildBriefing } from "./briefing.js";

describe("buildBriefing", () => {
  it("creates a grounded executive briefing from business fields", () => {
    const rows = [{ Region: "North", Product: "Laptop", TotalPrice: 1000, Returned: 0, Discount: 0.05 }, { Region: "South", Product: "Chair", TotalPrice: 200, Returned: 1, Discount: 0.15 }];
    const briefing = buildBriefing(rows, Object.keys(rows[0])).briefing;
    expect(briefing).toContain("Executive briefing");
    expect(briefing).toContain("North");
    expect(briefing).toContain("return rate");
    expect(briefing).toContain("Prioritized recommendations");
  });
});
