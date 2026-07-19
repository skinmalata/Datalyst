window.datalystParseFile = async (file) => {
  const text = await file.text();

  // --- JSON branch ---
  if (file.name.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed)
      ? parsed
      : Object.values(parsed || {})
          .filter(Array.isArray)
          .sort((a, b) => b.length - a.length)[0] || [parsed];

    if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== "object") {
      throw new Error("JSON data needs to contain a list of records.");
    }

    return { rows, tableCount: 1 };
  }

  // --- CSV / TSV helpers ---

  const csvRow = (line, delimiter) => {
    const values = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < line.length; index++) {
      const char = line[index];

      if (char === '"') {
        if (quoted && line[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = !quoted;
        }
      } else if (char === delimiter && !quoted) {
        values.push(value.trim());
        value = "";
      } else {
        value += char;
      }
    }

    values.push(value.trim());
    return values;
  };

  const tidyHeaders = (headers) => {
    const used = new Map();

    return headers.map((header, index) => {
      const base =
        String(header || "")
          .replace(/\s+/g, " ")
          .trim() || `Column ${index + 1}`;
      const count = (used.get(base) || 0) + 1;
      used.set(base, count);
      return count === 1 ? base : `${base} ${count}`;
    });
  };

  const numericValue = (value) =>
    Number(String(value ?? "").replace(/[,$%\s]/g, ""));

  const looksLikeData = (values) => {
    const filled = values.filter((value) => String(value).trim() !== "");
    return (
      filled.length > 0 &&
      filled.filter((value) => Number.isFinite(numericValue(value))).length /
        filled.length >=
        0.5
    );
  };

  // --- Parse lines into tables ---

  const lines = text.split(/\r?\n/);
  const sample = lines
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .slice(0, 30);

  // Auto-detect delimiter from sample
  const delimiter = [",", "\t", ";"].sort(
    (a, b) =>
      sample.reduce(
        (total, line) => total + (line.split(b).length - 1),
        0
      ) -
      sample.reduce(
        (total, line) => total + (line.split(a).length - 1),
        0
      )
  )[0];

  const tables = [];

  for (let index = 0; index < lines.length; ) {
    const line = lines[index].trim();

    if (!line || line.startsWith("#")) {
      index++;
      continue;
    }

    const first = csvRow(lines[index], delimiter);

    if (first.length < 2) {
      index++;
      continue;
    }

    const headerless = looksLikeData(first);
    const headers = tidyHeaders(
      headerless
        ? first.map((_, column) => `Column ${column + 1}`)
        : first
    );
    const rows = [];

    if (!headerless) index++;

    while (index < lines.length) {
      const next = lines[index].trim();

      if (!next || next.startsWith("#")) break;

      const values = csvRow(lines[index], delimiter);

      if (values.length < 2) break;

      const cleaned = values.slice(0, headers.length);

      while (cleaned.length < headers.length) cleaned.push("");

      rows.push(
        Object.fromEntries(
          headers.map((header, column) => [header, cleaned[column]])
        )
      );

      index++;
    }

    if (rows.length) {
      tables.push({ headers, rows });
    } else {
      index++;
    }
  }

  if (!tables.length) {
    throw new Error("We could not find a data table in this file.");
  }

  // Pick the largest table
  const selected = [...tables]
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length ||
        b.headers.length - a.headers.length
    )[0];

  return {
    rows: selected.rows,
    tableCount: tables.length,
    tableName: selected.headers[0],
  };
};
