"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";

const OBJECTIVES = [
  { icon: "↗", label: "Understand performance", desc: "Find drivers, trends and changes" },
  { icon: "⌕", label: "Investigate an issue", desc: "Identify anomalies and root causes" },
  { icon: "⟡", label: "Compare segments", desc: "Benchmark groups against each other" },
  { icon: "⟐", label: "Forecast future values", desc: "Project trends into the future" },
];

type Props = { onComplete: (question?: string) => void };

export function AnalysisWizard({ onComplete }: Props) {
  const { rows, profile } = useStore();
  const [step, setStep] = useState(1);
  const [objective, setObjective] = useState("Understand performance");
  const [question, setQuestion] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  const colCount = rows[0] ? Object.keys(rows[0]).length : 0;
  const totalSteps = 4;

  const close = (analysisQuestion?: string) => {
    setVisible(false);
    setTimeout(() => onComplete(analysisQuestion), 300);
  };

  const runAnalysis = () => {
    const objectiveQuestion = objective === "Investigate an issue" ? "Where are we seeing unusual values?" : objective === "Compare segments" ? "Which business area is driving our performance?" : objective === "Forecast future values" ? "What should we expect next?" : undefined;
    close(question.trim() || objectiveQuestion);
  };

  const next = () => {
    if (step < totalSteps) setStep(step + 1);
    else runAnalysis();
  };

  const back = () => { if (step > 1) setStep(step - 1); };

  const stepLabel = (n: number) => {
    if (n < step) return "✓";
    if (n === step) return "●";
    return "○";
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div
        className={`flex w-full max-w-3xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl transition-transform duration-300 ${
          visible ? "scale-100" : "scale-95"
        }`}
        style={{ maxHeight: "85vh" }}
      >
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-background p-5 md:flex">
          <p className="mb-4 text-xs font-bold tracking-widest text-primary">ANALYSIS WIZARD</p>
          <ol className="space-y-4">
            {["Choose data", "Set objective", "Configure", "Review & run"].map((label, i) => (
              <li key={label} className={`flex items-center gap-3 text-sm ${i + 1 === step ? "text-white font-semibold" : i + 1 < step ? "text-primary" : "text-text-muted"}`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-xs">{stepLabel(i + 1)}</span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <p className="mt-auto pt-6 text-[10px] text-text-muted leading-relaxed">
            ◈ Enterprise-grade protection<br />
            Data is encrypted in transit and at rest.
          </p>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between md:hidden">
            <span className="text-xs font-bold text-primary">STEP {step} OF {totalSteps}</span>
            <button onClick={() => close()} className="text-2xl text-text-muted hover:text-white">×</button>
          </div>

          {/* Step 1: Choose data */}
          {step === 1 && (
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">STEP 1 OF 4</p>
              <h2 className="mb-2 text-xl font-bold">Choose the data to analyze</h2>
              <p className="mb-5 text-sm text-text-secondary">Your analysis will inherit the current dataset and its detected fields.</p>
              <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-sm font-bold text-primary">DATA</span>
                <div className="flex-1">
                  <p className="font-semibold">{rows.length.toLocaleString()} rows · {colCount} fields</p>
                  <p className="text-sm text-text-muted">{profile?.fields.filter(f => f.kind === "number").length ?? 0} measures · {profile?.fields.filter(f => f.kind === "category").length ?? 0} dimensions</p>
                </div>
                <span className="text-primary">✓</span>
              </div>
            </div>
          )}

          {/* Step 2: Set objective */}
          {step === 2 && (
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">STEP 2 OF 4</p>
              <h2 className="mb-2 text-xl font-bold">What decision will this analysis support?</h2>
              <p className="mb-5 text-sm text-text-secondary">A clear objective focuses the analysis and surfaces the right evidence.</p>
              <div className="grid grid-cols-2 gap-3">
                {OBJECTIVES.map((o) => (
                  <button
                    key={o.label}
                    onClick={() => setObjective(o.label)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      objective === o.label
                        ? "border-primary bg-primary/10 text-white"
                        : "border-border bg-background text-text-secondary hover:border-primary/40"
                    }`}
                  >
                    <span className="mb-2 block text-lg">{o.icon}</span>
                    <b className="block text-sm">{o.label}</b>
                    <span className="mt-1 block text-xs text-text-muted">{o.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {step === 3 && (
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">STEP 3 OF 4</p>
              <h2 className="mb-2 text-xl font-bold">Refine your analysis</h2>
              <p className="mb-5 text-sm text-text-secondary">Optionally add a specific question to focus the analysis.</p>
              <label className="mb-3 block text-sm font-semibold text-text-secondary">Specific question (optional)</label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder={`e.g. Which products are driving the most ${objective.toLowerCase()}?`}
                className="w-full rounded-lg border border-border bg-background p-3 text-sm text-white placeholder-text-muted focus:border-primary focus:outline-none"
              />
              <p className="mt-3 text-xs text-text-muted">Leave blank for a general {objective.toLowerCase()} analysis across all fields.</p>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div>
              <p className="mb-1 text-xs font-bold tracking-widest text-primary">STEP 4 OF 4</p>
              <h2 className="mb-2 text-xl font-bold">Review & run</h2>
              <p className="mb-5 text-sm text-text-secondary">Confirm your settings and generate the analysis.</p>
              <div className="space-y-3 rounded-lg border border-border bg-background p-4 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Data</span><span className="font-semibold">{rows.length.toLocaleString()} rows · {colCount} fields</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Objective</span><span className="font-semibold">{objective}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Question</span><span className="font-semibold">{question || "General analysis"}</span></div>
              </div>
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-text-secondary">
                The analysis will scan all dimensions, detect anomalies, compute concentration risks, and generate prioritized recommendations.
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <button
              onClick={back}
              disabled={step === 1}
              className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface disabled:opacity-30"
            >
              Back
            </button>
            <span className="text-xs text-text-muted md:hidden">{step} of {totalSteps}</span>
            <button
              onClick={next}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              {step === totalSteps ? "Run analysis ✦" : "Continue →"}
            </button>
          </div>
        </div>

        {/* Close button (desktop) */}
        <button onClick={() => close()} className="absolute right-4 top-4 hidden h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-lg text-text-muted hover:text-white md:flex">
          ×
        </button>
      </div>
    </div>
  );
}
