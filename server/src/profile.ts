type Row = Record<string, unknown>;

export type DatasetProfile = {
  records: number;
  columns: number;
  completeness: number;
  duplicateRows: number;
  fields: Array<{ name: string; kind: "number" | "date" | "category" | "text"; populated: number; distinct: number; numeric?: { min: number; max: number; average: number } }>;
  warnings: string[];
};

function asNumber(value: unknown) {
  const number = Number(String(value ?? "").trim().replace(/[$,%\s,]/g, ""));
  return Number.isFinite(number) ? number : null;
}
function populated(value: unknown) { return value !== null && value !== undefined && String(value).trim() !== ""; }
function dateLike(value: unknown) {
  const text = String(value ?? "").trim();
  return /[-/]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(text) && !Number.isNaN(new Date(text).getTime());
}

export function profileDataset(rows: Row[]): DatasetProfile {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const totalCells = rows.length * columns.length;
  const filledCells = rows.reduce((count, row) => count + columns.filter(column => populated(row[column])).length, 0);
  const duplicates = new Set<string>();
  let duplicateRows = 0;
  rows.forEach(row => { const key = JSON.stringify(columns.map(column => row[column] ?? null)); if (duplicates.has(key)) duplicateRows++; else duplicates.add(key); });
  const fields = columns.map(name => {
    const values = rows.map(row => row[name]).filter(populated);
    const numeric = values.map(asNumber).filter((value): value is number => value !== null);
    const dates = values.filter(dateLike);
    const distinct = new Set(values.map(value => String(value).trim().toLowerCase())).size;
    const numberMajority = values.length > 0 && numeric.length / values.length >= 0.8;
    const dateMajority = values.length > 0 && dates.length / values.length >= 0.8;
    const kind = numberMajority ? "number" : dateMajority ? "date" : distinct <= Math.min(30, Math.max(10, rows.length * 0.5)) ? "category" : "text";
    const field: DatasetProfile["fields"][number] = { name, kind, populated: values.length, distinct };
    if (numberMajority) field.numeric = { min: Math.min(...numeric), max: Math.max(...numeric), average: Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(2)) };
    return field;
  });
  const warnings: string[] = [];
  const completeness = totalCells ? Math.round((filledCells / totalCells) * 100) : 0;
  if (completeness < 95) warnings.push(`${100 - completeness}% of cells are blank. Treat results using incomplete fields with care.`);
  if (duplicateRows) warnings.push(`${duplicateRows} duplicate row${duplicateRows === 1 ? "" : "s"} detected. Totals may be overstated until duplicates are reviewed.`);
  if (!fields.some(field => field.kind === "number")) warnings.push("No reliably numeric measure was detected. Datalyst can describe the data, but cannot calculate business totals yet.");
  if (!fields.some(field => field.kind === "date")) warnings.push("No reliable date field was detected, so trend and forecast questions may not be available.");
  return { records: rows.length, columns: columns.length, completeness, duplicateRows, fields, warnings };
}
