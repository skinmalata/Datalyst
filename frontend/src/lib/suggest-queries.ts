const dateHints = /date|time|month|year|quarter|day|week|period|created|updated|timestamp/i;
const numericHints = /sales|revenue|amount|profit|price|cost|count|total|quantity|orders|views|visits|bounce|rate|score|margin|growth|units/i;
const categoryHints = /region|category|product|segment|channel|type|status|department|team|country|state|city|customer|supplier|brand|class|group/i;

function isDate(col: string) { return dateHints.test(col); }
function isNumeric(val: unknown) { return typeof val === "number" || (typeof val === "string" && val !== "" && !isNaN(Number(val))); }

export function suggestQueries(rows: Record<string, unknown>[]): { question: string; description: string }[] {
  if (!rows.length) return [];
  const columns = Object.keys(rows[0]);
  const dateCol = columns.find(isDate);
  const numericCols = columns.filter(c => {
    const sample = rows.find(r => r[c] !== null && r[c] !== undefined && r[c] !== "");
    return sample && isNumeric(sample[c]) && numericHints.test(c);
  });
  const allNumericCols = columns.filter(c => {
    const sample = rows.find(r => r[c] !== null && r[c] !== undefined && r[c] !== "");
    return sample && isNumeric(sample[c]);
  });
  const catCols = columns.filter(isNumeric).length === 0 ? columns.filter(c => !isDate(c)) : columns.filter(c => !isDate(c) && !allNumericCols.includes(c));
  const topNumeric = numericCols.length ? numericCols : allNumericCols;
  const measure = topNumeric[0] || "value";
  const dimension = catCols[0] || columns.find(c => !isDate(c) && c !== measure) || columns[0];
  const suggestions: { question: string; description: string }[] = [];

  if (dimension && measure) {
    const dimLower = dimension.toLowerCase();
    suggestions.push({
      question: `Which ${dimLower} has the highest ${measure.toLowerCase()}?`,
      description: `Rank your ${dimLower} by ${measure.toLowerCase()} to see top performers.`
    });
  }

  if (dateCol && measure) {
    suggestions.push({
      question: `Show ${measure.toLowerCase()} trend over time`,
      description: `See how ${measure.toLowerCase()} changes across ${dateCol.toLowerCase()}.`
    });
  }

  if (measure) {
    suggestions.push({
      question: `Find outliers in ${measure.toLowerCase()}`,
      description: `Spot unusual ${measure.toLowerCase()} values worth investigating.`
    });
  }

  if (dimension && measure) {
    suggestions.push({
      question: `Compare ${measure.toLowerCase()} across ${dimension.toLowerCase()}`,
      description: `See which ${dimension.toLowerCase()} groups lead or lag.`
    });
  }

  return suggestions.slice(0, 4);
}
