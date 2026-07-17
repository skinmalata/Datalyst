import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChartViewer, type ChartType } from "./ChartViewer";

export function ChatMessage({ role, content, values, chartType }: { role:"user"|"assistant"; content:string; values?:{label:string;value:number;zScore?:number}[]; chartType?:ChartType }) {
  return <article className={role==="user"?"ml-12 rounded-xl bg-primary p-4":"mr-12 rounded-xl bg-surface p-4"}><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>{values?.length?<div className="mt-4"><ChartViewer data={values} type={chartType}/></div>:null}</article>;
}
