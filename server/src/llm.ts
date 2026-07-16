import { z } from "zod";
const filter = z.object({field:z.string(),operator:z.enum(["equals","not_equals","contains","gt","gte","lt","lte"]),value:z.union([z.string(),z.number(),z.boolean()])});
export const llmPlan = z.object({ operation:z.enum(["sum","average","top_values","forecast","anomalies"]), field:z.string(), timeField:z.string().optional(), groupBy:z.string().optional(), limit:z.number().int().min(1).max(100).optional(), filters:z.array(filter).max(10).optional(), comparisonFilters:z.array(filter).min(1).max(10).optional(), explanation:z.string().max(500) });
export async function makeSafePlan(question:string, columns:string[], metrics:string[]) {
  // Common analytics exports use these column names. Planning these questions locally
  // gives a useful, repeatable answer even when the optional LLM is unavailable.
  const lowerQuestion=question.toLowerCase();
  const pageColumn=columns.find(column=>/(page|title|screen)/i.test(column));
  const requestedMetric=lowerQuestion.includes("bounce") ? /bounce.?rate/i : lowerQuestion.includes("active user")||lowerQuestion.includes("visitor")||lowerQuestion.includes("audience") ? /active.?users?/i : lowerQuestion.includes("event") ? /event.?count/i : /(views?|traffic|visits?)/i;
  const metricColumn=columns.find(column=>requestedMetric.test(column));
  if(pageColumn&&metricColumn&&/(page|content|article|screen|traffic|perform)/i.test(lowerQuestion)) return llmPlan.parse({operation:"top_values",field:metricColumn,groupBy:pageColumn,limit:10,explanation:`Rank ${pageColumn} by ${metricColumn}.`});
  const endpoint=process.env.LLM_API_URL, key=process.env.LLM_API_KEY, model=process.env.LLM_MODEL;
  if(!endpoint||!key||!model) throw new Error("LLM is not configured. Set LLM_API_URL, LLM_API_KEY, and LLM_MODEL on the server.");
  const prompt=`You are a data-analysis planner. Return JSON only. You may select exactly one operation from sum, average, top_values, forecast, anomalies. You may use only these source fields: ${JSON.stringify(columns)}. Approved metric names: ${JSON.stringify(metrics)}. Filters may only use a listed source field and one of equals, not_equals, contains, gt, gte, lt, lte. comparisonFilters describes a baseline for sum or average only. Never produce SQL, Python, a file path, or an instruction to access data outside this list. Question: ${question}`;
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${key}`},body:JSON.stringify({model,temperature:0,messages:[{role:"system",content:"Return a safe, minimal JSON analysis plan."},{role:"user",content:prompt}],response_format:{type:"json_object"}})});
  if(!response.ok) throw new Error("The analysis planner is temporarily unavailable.");
  const body=await response.json() as {choices?:Array<{message?:{content?:string}}>};;
  return llmPlan.parse(JSON.parse(body.choices?.[0]?.message?.content || "{}"));
}
