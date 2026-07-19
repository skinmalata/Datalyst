"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api-client";

export function ExecutiveBriefing({ datasetId }: { datasetId: string }) {
  const [briefing, setBriefing] = useState(""), [error, setError] = useState("");
  useEffect(() => { let active = true; api<{ briefing: string }>(`/api/datasets/${datasetId}/briefing`).then(result => { if (active) setBriefing(result.briefing); }).catch(() => { if (active) setError("The executive briefing could not be prepared yet."); }); return () => { active = false; }; }, [datasetId]);
  if (error) return <p className="text-sm text-amber-300">{error}</p>;
  if (!briefing) return <p className="text-sm text-text-muted">Preparing executive briefing…</p>;
  return <section className="rounded-2xl border border-primary/40 bg-surface p-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{briefing}</ReactMarkdown></section>;
}
