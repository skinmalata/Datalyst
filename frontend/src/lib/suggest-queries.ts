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

  const pool: { question: string; description: string }[] = [];

  if (c1) {
    pool.push({ question: `Which ${c1l} has the highest ${m1l}?`, description: `Rank your ${c1l} by ${m1l} to see top performers.` });
    pool.push({ question: `Which ${c1l} has the lowest ${m1l}?`, description: `Find underperforming ${c1l} that need attention.` });
  }

  if (d1) {
    pool.push({ question: `Show ${m1l} trend over time`, description: `See how ${m1l} changes across ${d1.toLowerCase()}.` });
  }

  pool.push({ question: `Find outliers in ${m1l}`, description: `Spot unusual ${m1l} values worth investigating.` });

  if (c1) {
    pool.push({ question: `Compare ${m1l} across ${c1l}`, description: `See which ${c1l} groups lead or lag.` });
  }

  pool.push({ question: `What is the average ${m1l}?`, description: `Get a summary of the typical ${m1l} across all records.` });

  if (m2) {
    const m2l = m2.toLowerCase();
    pool.push({ question: `How does ${m1l} relate to ${m2l}?`, description: `Compare the two numeric measures side by side.` });
  }

  if (d1 && c1) {
    pool.push({ question: `Show ${m1l} by ${c1l} over time`, description: `Track how each ${c1l} performs across ${d1.toLowerCase()}.` });
  }

  if (c2) {
    const c2l = c2.toLowerCase();
    pool.push({ question: `Compare ${m1l} by ${c1l} and ${c2l}`, description: `Cross-analyze two dimensions to find patterns.` });
  }

  pool.push({ question: `What does the data distribution of ${m1l} look like?`, description: `Understand the spread and concentration of ${m1l} values.` });

  if (pool.length < 10) {
    pool.push({ question: `Show the top 10 records by ${m1l}`, description: `List the highest ${m1l} entries in the dataset.` });
  }

  return pool.slice(0, 10);
}
