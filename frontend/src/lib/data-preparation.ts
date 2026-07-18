export type PreparationReport = {
  inputRows: number;
  outputRows: number;
  columns: number;
  transformations: string[];
  warnings: string[];
};

const emptyMarkers = new Set(["", "-", "—", "–", "n/a", "na", "null", "none", "unknown"]);
const isBlank = (value: unknown) => value === null || value === undefined || emptyMarkers.has(String(value).trim().toLowerCase());
const numericValue = (value: unknown) => {
  const text = String(value ?? "").trim().replace(/^\((.*)\)$/, "-$1").replace(/[$£€,%\s,]/g, "");
  return text !== "" && Number.isFinite(Number(text));
};
const cleanHeader = (name: string, index: number, used: Set<string>) => {
  const base = name.trim().replace(/\s+/g, " ") || `Column ${index + 1}`;
  let next = base, suffix = 2;
  while (used.has(next.toLowerCase())) next = `${base} ${suffix++}`;
  used.add(next.toLowerCase());
  return next;
};

export function prepareDataset(input: Record<string, unknown>[]) {
  const nonEmptyRows = input.filter(row => Object.values(row).some(value => !isBlank(value)));
  const sourceColumns = Array.from(new Set(nonEmptyRows.flatMap(row => Object.keys(row))));
  const used = new Set<string>();
  const columns = sourceColumns.map((name, index) => ({ source: name, target: cleanHeader(name, index, used) }));
  let trimmed = 0, nulls = 0, numeric = 0;
  const rows = nonEmptyRows.map(row => Object.fromEntries(columns.map(({ source, target }) => {
    const original = row[source];
    if (isBlank(original)) { if (original !== "") nulls++; return [target, ""]; }
    const value = typeof original === "string" ? original.trim() : original;
    if (value !== original) trimmed++;
    return [target, value];
  })));
  columns.forEach(({ target }) => {
    const values = rows.map(row => row[target]).filter(value => !isBlank(value));
    if (!values.length || values.filter(numericValue).length / values.length < 0.8) return;
    rows.forEach(row => {
      const value = row[target];
      if (!isBlank(value) && typeof value === "string" && numericValue(value)) {
        const normalized = value.replace(/^\((.*)\)$/, "-$1").replace(/[$£€,%\s,]/g, "");
        if (normalized !== value) { row[target] = normalized; numeric++; }
      }
    });
  });
  const transformations: string[] = [];
  if (input.length !== nonEmptyRows.length) transformations.push(`Removed ${input.length - nonEmptyRows.length} fully empty row${input.length - nonEmptyRows.length === 1 ? "" : "s"}.`);
  if (trimmed) transformations.push(`Trimmed extra spaces from ${trimmed} cell${trimmed === 1 ? "" : "s"}.`);
  if (nulls) transformations.push(`Standardized ${nulls} blank or placeholder value${nulls === 1 ? "" : "s"}.`);
  if (numeric) transformations.push(`Standardized number formatting in ${numeric} cell${numeric === 1 ? "" : "s"} (currency symbols, commas, and brackets).`);
  if (columns.some(({ source, target }) => source !== target)) transformations.push("Cleaned column names and made duplicate names unique.");
  if (!transformations.length) transformations.push("No safe automatic changes were needed.");
  const warnings: string[] = [];
  if (!rows.length) warnings.push("The file has no usable data rows after preparation.");
  if (!columns.length) warnings.push("No columns were detected.");
  return { rows, report: { inputRows: input.length, outputRows: rows.length, columns: columns.length, transformations, warnings } satisfies PreparationReport };
}
