function parseDelimitedLine(line: string, delimiter: string) {
  const cells: string[] = [], current: string[] = [];
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { current.push('"'); index++; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { cells.push(current.join("").trim()); current.length = 0; }
    else current.push(character);
  }
  cells.push(current.join("").trim());
  return cells;
}
export function parseDataFile(text: string, name: string): Record<string, unknown>[] {
  if (name.toLowerCase().endsWith(".json")) {
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new Error("This JSON file is not valid. Check for a missing comma, quote, or bracket and try again."); }
    if (!Array.isArray(data) || !data.every(item => item && typeof item === "object" && !Array.isArray(item))) throw new Error("JSON must contain a list of records.");
    return data as Record<string, unknown>[];
  }
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const tableLines = lines.filter(line => line.trim() && !line.trim().startsWith("#"));
  const delimiter = [",", "\t", ";"].map(candidate => ({ candidate, score: tableLines.slice(0, 25).filter(line => parseDelimitedLine(line, candidate).length > 1).length })).sort((a, b) => b.score - a.score)[0]?.candidate;
  if (!delimiter) throw new Error("A table with column names could not be found.");
  let best: Record<string, unknown>[] = [];
  for (let index = 0; index < lines.length; index++) {
    if (!lines[index].trim() || lines[index].trim().startsWith("#")) continue;
    const headers = parseDelimitedLine(lines[index], delimiter);
    if (headers.length < 2 || headers.every(header => !header)) continue;
    const rows: Record<string, unknown>[] = [];
    for (const line of lines.slice(index + 1)) {
      if (!line.trim() || line.trim().startsWith("#")) break;
      const values = parseDelimitedLine(line, delimiter);
      if (values.length !== headers.length) break;
      rows.push(Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""])));
    }
    if (rows.length > best.length) best = rows;
  }
  if (!best.length) throw new Error("No usable data rows were found. Ensure the file has a header row and matching columns.");
  return best;
}
