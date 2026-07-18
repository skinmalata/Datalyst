import { prepareDataset } from "@/lib/data-preparation";

test("safely prepares common messy business values and reports the changes", () => {
  const result = prepareDataset([{ " Sales ": " $1,200 ", Region: " West ", Notes: "N/A" }, { " Sales ": "(300)", Region: "East", Notes: "-" }, { " Sales ": "", Region: "", Notes: "" }]);
  expect(result.rows).toHaveLength(2);
  expect(result.rows[0]).toMatchObject({ Sales: "1200", Region: "West", Notes: "" });
  expect(result.rows[1]).toMatchObject({ Sales: "-300", Region: "East" });
  expect(result.report.transformations.join(" ")).toContain("Standardized number formatting");
});
