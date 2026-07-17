const dateHints = /date|time|month|year|quarter|day|week|period|created|updated|timestamp/i;

function isDate(col: string) { return dateHints.test(col); }
function isNumericVal(val: unknown) { return typeof val === "number" || (typeof val === "string" && val !== "" && !isNaN(Number(val))); }

function numericCols(rows: Record<string, unknown>[], columns: string[]) {
  return columns.filter(c => rows.some(r => r[c] !== null && r[c] !== undefined && r[c] !== "" && isNumericVal(r[c])));
}

function categoricalCols(rows: Record<string, unknown>[], columns: string[], exclude: string[]) {
  return columns.filter(c => !exclude.includes(c) && !isDate(c) && rows.some(r => {
    const v = r[c];
    return v !== null && v !== undefined && v !== "" && !isNumericVal(v);
  }));
}

function countUnique(rows: Record<string, unknown>[], col: string): number {
  return new Set(rows.map(r => String(r[col] ?? ""))).size;
}

export function suggestQueries(rows: Record<string, unknown>[]): { question: string; description: string }[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const nums = numericCols(rows, columns);
  const dates = columns.filter(isDate);
  const cats = categoricalCols(rows, columns, [...nums, ...dates]);
  const m1 = nums[0] || "value";
  const m2 = nums[1];
  const c1 = cats[0] || columns.find(c => !isDate(c) && !nums.includes(c));
  const c2 = cats[1];
  const d1 = dates[0];
  const m1l = m1.toLowerCase();
  const c1l = c1 ? c1.toLowerCase() : "";
  const c1Count = c1 ? countUnique(rows, c1) : 0;
  const recordCount = rows.length;

  const pool: { question: string; description: string }[] = [];

  if (c1) {
    pool.push({
      question: `What are the top ${c1l} by ${m1l}?`,
      description: `See which of the ${c1Count} ${c1l} groups contribute the most ${m1l}. Shows the top performers ranked from highest to lowest.`
    });
    pool.push({
      question: `Which ${c1l} has the lowest ${m1l}?`,
      description: `Identify ${c1l} groups that are underperforming so you know where to focus improvement efforts.`
    });
    pool.push({
      question: `How is ${m1l} distributed across ${c1l}?`,
      description: `Compare ${m1l} for every ${c1l} group side by side. Helps spot which groups lead and which fall behind.`
    });
  }

  if (d1) {
    pool.push({
      question: `Show ${m1l} trend over ${d1.toLowerCase()}`,
      description: `Track how ${m1l} changes across ${d1.toLowerCase()}. Reveals whether numbers are growing, declining, or staying flat.`
    });
  }

  pool.push({
    question: `Find unusual ${m1l} values`,
    description: `Detect ${m1l} entries that are significantly higher or lower than normal. These outliers may indicate errors, opportunities, or problems.`
  });

  pool.push({
    question: `What is the total and average ${m1l}?`,
    description: `Get a quick summary: the overall ${m1l} across all ${recordCount} records, plus the typical value per record.`
  });

  if (m2) {
    const m2l = m2.toLowerCase();
    pool.push({
      question: `Compare ${m1l} vs ${m2l}`,
      description: `See how your two key measures relate to each other. Helps understand if high ${m1l} also means high ${m2l}.`
    });
  }

  if (d1 && c1) {
    pool.push({
      question: `Show ${m1l} by ${c1l} over ${d1.toLowerCase()}`,
      description: `Track each ${c1l} group's ${m1l} over time. See which groups are growing and which are shrinking.`
    });
  }

  if (c2) {
    const c2l = c2.toLowerCase();
    pool.push({
      question: `Compare ${m1l} across ${c1l} and ${c2l}`,
      description: `Break down ${m1l} by two dimensions at once. Reveals hidden patterns like which ${c2l} within each ${c1l} performs best.`
    });
  }

  pool.push({
    question: `Show the distribution of ${m1l}`,
    description: `Understand how ${m1l} values are spread out. See if most records cluster around one value or vary widely.`
  });

  if (pool.length < 10) {
    pool.push({
      question: `What are the top 10 records by ${m1l}?`,
      description: `List the 10 highest ${m1l} entries with all their details. Great for spotting the biggest contributors.`
    });
  }

  return pool.slice(0, 10);
}
