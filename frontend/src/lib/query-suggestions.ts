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
    { question: "How are we performing overall on " + metric + "?", description: "Start with the headline result for our business." },
    { question: "Which " + dimension + " is driving our " + metric + "?", description: "See what is contributing most to our performance." },
    { question: "What are our top 5 " + dimension + " by " + metric + "?", description: "Focus our team on the highest-impact areas." },
    { question: "Where are we seeing unusual " + metric + " values?", description: "Surface risks, errors, or exceptional opportunities we should investigate." },
    { question: "What does a typical " + metric + " look like for us?", description: "Understand normal performance, not only the total." },
  ];

  if (dateColumn) {
    suggestions.push(
      { question: "Is our " + metric + " improving or declining over time?", description: "See whether we are moving in the right direction." },
      { question: "What should we expect for our " + metric + " next?", description: "Use our available history to form a directional forecast." },
    );
  } else {
    suggestions.push(
      { question: "Which " + dimension + " should we prioritize based on " + metric + "?", description: "Turn our ranking into a practical leadership priority." },
      { question: "Which 10 " + dimension + " matter most to our " + metric + "?", description: "Review the broader set of meaningful contributors." },
    );
  }

  if (secondaryMetric !== metric) {
    suggestions.push(
      { question: "Which " + dimension + " is strongest for our " + secondaryMetric + "?", description: "Check whether the same areas lead on a second important measure." },
      { question: "Where are we seeing unusual " + secondaryMetric + " values?", description: "Look for exceptions in a supporting measure." },
    );
  } else {
    suggestions.push(
      { question: "How does our " + metric + " compare across " + dimension + "?", description: "Compare performance across our available business groups." },
      { question: "Which " + dimension + " is our clear " + metric + " leader?", description: "Confirm the strongest area for our business." },
    );
  }

  if (rateMetric && rateMetric !== metric) {
    suggestions.push({ question: "Which " + dimension + " has the highest " + rateMetric + " in our business?", description: "Find areas where our quality or conversion signal needs attention." });
  } else if (secondDimension) {
    suggestions.push({ question: "Which " + secondDimension + " contributes most to our " + metric + "?", description: "Compare our performance through a second business lens." });
  } else {
    suggestions.push({ question: "Which top 5 " + dimension + " should we watch most closely?", description: "Revisit our highest-impact areas for an executive summary." });
  }

  return suggestions.slice(0, 10);
}
