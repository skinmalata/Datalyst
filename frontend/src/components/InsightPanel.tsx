export type Insight = {
  type: "recommendation" | "warning" | "opportunity" | "context";
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
};

const typeStyles: Record<Insight["type"], { border: string; badge: string; icon: string }> = {
  recommendation: { border: "border-l-primary", badge: "bg-primary/20 text-primary", icon: "→" },
  warning:        { border: "border-l-amber-400", badge: "bg-amber-400/20 text-amber-300", icon: "⚠" },
  opportunity:    { border: "border-l-emerald-400", badge: "bg-emerald-400/20 text-emerald-300", icon: "★" },
  context:        { border: "border-l-text-muted", badge: "bg-white/5 text-text-muted", icon: "i" },
};

const priorityLabel: Record<Insight["priority"], string> = {
  high: "Action needed",
  medium: "Worth reviewing",
  low: "For context",
};

export function InsightPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) return null;
  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">Insights &amp; recommendations</p>
      {insights.map((insight, i) => {
        const style = typeStyles[insight.type];
        return (
          <div
            key={i}
            className={`rounded-lg border border-border bg-surface/50 p-3 border-l-4 ${style.border}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${style.badge}`}>
                {style.icon}
              </span>
              <span className="text-sm font-semibold">{insight.title}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-text-muted">
                {priorityLabel[insight.priority]}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary pl-7">
              {insight.detail}
            </p>
          </div>
        );
      })}
    </div>
  );
}
