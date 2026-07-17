export type SuggestedQuery = { question: string; description: string };
const numberLike = (value: unknown) => { const text = String(value ?? "").trim(); return text !== "" && Number.isFinite(Number(text.replace(/[$,%\s]/g, ""))); };
export function generateSuggestedQueries(rows: Record<string, unknown>[]): SuggestedQuery[] {
  const columns = Object.keys(rows[0] || {});
  const numericColumns = columns.filter((column) => rows.slice(0, 50).filter((row) => numberLike(row[column])).length >= Math.max(1, Math.min(rows.length, 50) * 0.6));
  const metric = numericColumns.find((column) => /(revenue|sales|amount|profit|views|users|events|count|rate)/i.test(column)) || numericColumns[0] || columns[0] || "value";
  const dimensions = columns.filter((column) => column !== metric && !numericColumns.includes(column));
  const dimension = dimensions.find((column) => /(page|title|product|category|region|segment|country|customer)/i.test(column)) || dimensions[0] || "category";
  const comparisonDimension = dimensions.find((column) => column !== dimension) || dimension;
  const dateColumn = columns.find((column) => /(date|month|period|week|year|time)/i.test(column));
  return [
    { question: "What is the total " + metric + "?", description: "Add up every " + metric + " value in this file." },
    { question: "What is the average " + metric + "?", description: "Find the typical " + metric + " value per record." },
    { question: "Show the top 10 " + dimension + " by " + metric + ".", description: "Rank the strongest " + dimension + " values." },
    { question: "Which " + dimension + " performs best by " + metric + "?", description: "Identify the leading " + dimension + "." },
    { question: "Show " + metric + " by " + dimension + ".", description: "Compare the measure across groups." },
    { question: "Are there unusual " + metric + " values?", description: "Find possible outliers that may need attention." },
    { question: "Show the top 5 " + comparisonDimension + " by " + metric + ".", description: "Focus on the highest-performing groups." },
    { question: "Compare " + metric + " across " + comparisonDimension + ".", description: "See which groups contribute most." },
    dateColumn ? { question: "Show " + metric + " over time using " + dateColumn + ".", description: "See whether the measure rises or falls." } : { question: "What are the highest " + metric + " values?", description: "Inspect the largest values in the dataset." },
    dateColumn ? { question: "Forecast " + metric + " using " + dateColumn + ".", description: "Estimate the next periods from available history." } : { question: "Give me a summary of " + metric + " by " + dimension + ".", description: "Get a clear group-by-group overview." },
  ];
}
