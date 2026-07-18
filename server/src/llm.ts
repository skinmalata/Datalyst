import { z } from "zod";

const filter = z.object({ field:z.string(), operator:z.enum(["equals","not_equals","contains","gt","gte","lt","lte"]), value:z.union([z.string(),z.number(),z.boolean()]) });
export const llmPlan = z.object({ operation:z.enum(["sum","average","top_values","bottom_values","trend","forecast","anomalies"]), field:z.string(), timeField:z.string().optional(), groupBy:z.string().optional(), limit:z.number().int().min(1).max(100).optional(), filters:z.array(filter).max(10).optional(), comparisonFilters:z.array(filter).min(1).max(10).optional(), explanation:z.string().max(500) });

function fieldForQuestion(question:string, columns:string[]) {
  const lower=question.toLowerCase();
  const preferred=columns.find(column=>lower.includes(column.toLowerCase()));
  if(preferred&&/(revenue|sales|amount|profit|views|users|events|count|rate|margin|percent|quantity|units)/i.test(preferred)) return preferred;
  const terms=[["bounce",/bounce.?rate/i],["active user",/active.?users?/i],["visitor",/active.?users?/i],["event",/event.?count/i],["traffic",/(views?|visits?)/i],["view",/(views?|visits?)/i],["revenue",/(revenue|sales|amount)/i],["sales",/(revenue|sales|amount)/i],["profit",/profit/i]];
  const match=terms.find(([term])=>lower.includes(term as string));
  if(match) return columns.find(column=>(match[1] as RegExp).test(column));
  return columns.find(column=>/(revenue|sales|amount|profit|views|users|events|count|rate)/i.test(column));
}
function dimensionForQuestion(question:string, columns:string[], metric:string) {
  const lower=question.toLowerCase();
  return columns.find(column=>column!==metric&&lower.includes(column.toLowerCase())) ||
    columns.find(column=>column!==metric&&/(page|title|screen|product|category|region|segment|country|customer|team)/i.test(column));
}
function timeForQuestion(columns:string[]) { return columns.find(column=>/(date|month|period|week|year|time)/i.test(column)); }

function deterministicPlan(question:string, columns:string[]) {
  const lower=question.toLowerCase(), field=fieldForQuestion(question,columns);
  if(!field) return null;
  const groupBy=dimensionForQuestion(question,columns,field), timeField=timeForQuestion(columns);
  if(/anomal|outlier|unusual|risk|investigate/.test(lower)) return llmPlan.parse({operation:"anomalies",field,limit:20,explanation:"Screen for statistically unusual values."});
  if(/forecast|expect next|outlook|predict/.test(lower)&&timeField) return llmPlan.parse({operation:"forecast",field,timeField,explanation:"Forecast from the available time history."});
  if(/trend|over time|improving|declining|changed/.test(lower)&&timeField) return llmPlan.parse({operation:"trend",field,timeField,explanation:"Aggregate the available history into a monthly trend."});
  if(/average|typical|normal/.test(lower)) return llmPlan.parse({operation:"average",field,explanation:"Calculate the average across valid records."});
  if(groupBy&&/(bottom|lowest|weakest|underperforming|needs attention)/.test(lower)) return llmPlan.parse({operation:"bottom_values",field,groupBy,limit:5,explanation:"Rank the weakest business dimension."});
  if(groupBy&&/(top|leading|leader|driving|priority|strongest|highest|compare|across|contributes|matters|by )/.test(lower)) return llmPlan.parse({operation:"top_values",field,groupBy,limit:/top 10|10 /.test(lower)?10:5,explanation:"Rank the requested business dimension."});
  if(/total|overall|headline/.test(lower)) return llmPlan.parse({operation:"sum",field,explanation:"Calculate the total across valid records."});
  if(groupBy) return llmPlan.parse({operation:"top_values",field,groupBy,limit:5,explanation:"Rank the most relevant business dimension."});
  return llmPlan.parse({operation:"sum",field,explanation:"Calculate the requested measure."});
}

export async function makeSafePlan(question:string, columns:string[], metrics:string[]) {
  const planned=deterministicPlan(question,columns);
  if(planned) return planned;
  const endpoint=process.env.LLM_API_URL, key=process.env.LLM_API_KEY, model=process.env.LLM_MODEL;
  if(!endpoint||!key||!model) throw new Error("This question is not supported by built-in analysis, and the optional LLM planner is not configured.");
  const prompt="You are a data-analysis planner. Return JSON only. You may select exactly one operation from sum, average, top_values, forecast, anomalies. You may use only these source fields: "+JSON.stringify(columns)+". Approved metric names: "+JSON.stringify(metrics)+". Filters may only use a listed source field and one of equals, not_equals, contains, gt, gte, lt, lte. comparisonFilters describes a baseline for sum or average only. Never produce SQL, Python, a file path, or an instruction to access data outside this list. Question: "+question;
  const response=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+key},body:JSON.stringify({model,temperature:0,messages:[{role:"system",content:"Return a safe, minimal JSON analysis plan."},{role:"user",content:prompt}],response_format:{type:"json_object"}})});
  if(!response.ok) throw new Error("The analysis planner is temporarily unavailable.");
  const body=await response.json() as {choices?:Array<{message?:{content?:string}}>};
  return llmPlan.parse(JSON.parse(body.choices?.[0]?.message?.content || "{}"));
}
