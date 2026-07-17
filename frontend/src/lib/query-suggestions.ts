export type SuggestedQuery = { question: string; description: string };

const numberLike = (value: unknown) => {
  const text = String(value ?? "").trim();
  return text !== "" && Number.isFinite(Number(text.replace(/[$,%\s]/g, "")));
};
const isRate = (column: string) => /(rate|margin|percent|percentage)/i.test(column);

export function generateSuggestedQueries(rows: Record<string, unknown>[]): SuggestedQuery[] {
  const columns = Object.keys(rows[0] || {});
  const numericColumns = columns.filter((column) =>
    rows.slice(0, 50).filter((row) => numberLike(row[column])).length >= Math.max(1, Math.min(rows.length, 50) * 0.6),
  );
  const rankedMetrics = [...numericColumns].sort((a, b) => {
    const score = (column: string) => /(revenue|sales|profit|views|users|events|amount|count)/i.test(column) ? 0 : isRate(column) ? 1 : 2;
    return score(a) - score(b);
  });
  const metric = rankedMetrics[0] || columns[0] || "performance";
  const secondaryMetric = rankedMetrics.find((column) => column !== metric) || metric;
  const dimensions = columns.filter((column) => column !== metric && !numericColumns.includes(column));
  const dimension =
    dimensions.find((column) => /(page|title|product|category|region|segment|country|customer|team)/i.test(column)) ||
    dimensions[0] ||
    "business area";
  const secondDimension = dimensions.find((column) => column !== dimension);
  const dateColumn = columns.find((column) => /(date|month|period|week|year|time)/i.test(column));
  const rateMetric = rankedMetrics.find(isRate);

  const suggestions: SuggestedQuery[] = [
    { question: "What is our overall " + metric + "?", description: "Start with the headline number leadership needs to know." },
    { question: "Which " + dimension + " is driving the most " + metric + "?", description: "Identify the strongest contributor to performance." },
    { question: "What are the top 5 " + dimension + " by " + metric + "?", description: "Focus the team on the highest-impact areas." },
    { question: "Are there unusual " + metric + " values we should investigate?", description: "Surface possible risks, errors, or exceptional opportunities." },
    { question: "What is the average " + metric + "?", description: "Understand the typical result, not only the total." },
  ];

  if (dateColumn) {
    suggestions.push(
      { question: "How has " + metric + " changed over time using " + dateColumn + "?", description: "See whether performance is improving, flat, or declining." },
      { question: "What should we expect for " + metric + " next?", description: "Use the available history to form a directional forecast." },
    );
  } else {
    suggestions.push(
      { question: "Which " + dimension + " should we prioritize based on " + metric + "?", description: "Turn the ranking into a practical leadership priority." },
      { question: "Show the top 10 " + dimension + " by " + metric + ".", description: "Review the broader set of meaningful contributors." },
    );
  }

  if (secondaryMetric !== metric) {
    suggestions.push(
      { question: "Which " + dimension + " is strongest by " + secondaryMetric + "?", description: "Check whether the same areas lead on a second important measure." },
      { question: "Are there unusual " + secondaryMetric + " values?", description: "Look for exceptions in the supporting measure." },
    );
  } else {
    suggestions.push(
      { question: "Show " + metric + " by " + dimension + ".", description: "Compare performance across the available business groups." },
      { question: "Which " + dimension + " has the highest " + metric + "?", description: "Confirm the clearest performance leader." },
    );
  }

  if (rateMetric && rateMetric !== metric) {
    suggestions.push({ question: "Which " + dimension + " has the highest " + rateMetric + "?", description: "Find areas where the quality or conversion signal needs attention." });
  } else if (secondDimension) {
    suggestions.push({ question: "Which " + secondDimension + " contributes most to " + metric + "?", description: "Compare performance through a second business lens." });
  } else {
    suggestions.push({ question: "Show the top 5 " + dimension + " by " + metric + ".", description: "Revisit the highest-impact areas for an executive summary." });
  }

  return suggestions.slice(0, 10);
}
