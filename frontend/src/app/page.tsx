import Image from "next/image";
import Link from "next/link";

const features = [
  { icon: "💬", title: "Ask in plain language", desc: "Type a business question in words you already use. No SQL, no code, no training needed." },
  { icon: "📊", title: "Instant charts & reports", desc: "Get ranked results, trends, and comparisons rendered as interactive charts the moment you ask." },
  { icon: "🔍", title: "Outlier detection", desc: "Surface unusual values automatically so you catch problems and opportunities before anyone else." },
  { icon: "📈", title: "Time-series forecasting", desc: "Project future performance with seasonal models, holdout validation, and confidence intervals." },
  { icon: "🛡️", title: "Governed analysis plans", desc: "Every query goes through an approved plan with field-level access controls and audit trails." },
  { icon: "✅", title: "Evidence-backed answers", desc: "Each result shows exactly how it was calculated, which records were used, and what was excluded." },
];

const steps = [
  { num: "1", title: "Upload your data", desc: "Drag in a CSV or JSON file. Datalyst profiles it instantly — rows, columns, completeness, and duplicates." },
  { num: "2", title: "Ask a question", desc: "Type what you want to know in plain English. Datalyst builds an analysis plan behind the scenes." },
  { num: "3", title: "Get an answer", desc: "See ranked results, charts, and trends — each with the evidence and method clearly explained." },
];

const plans = [
  {
    name: "Explorer",
    price: "$0",
    period: "/month",
    desc: "For individuals learning from data.",
    features: ["1 workspace", "Upload CSV & JSON files", "Core analysis & charts", "5 queries per day", "Community support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Team",
    price: "$29",
    period: "/user /month",
    desc: "For teams making everyday decisions.",
    features: ["Shared workspaces", "Unlimited queries", "Governed metrics & definitions", "Forecasting & anomaly detection", "Audit history & exports", "Priority support"],
    cta: "Start Team trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Let's talk",
    period: "",
    desc: "For governed data at scale.",
    features: ["SSO & advanced access controls", "Custom data connections", "On-premise deployment option", "Dedicated success manager", "SLA & 24/7 support", "SOC 2 compliance"],
    cta: "Contact sales",
    featured: false,
  },
];

const stats = [
  { value: "2.4M+", label: "Queries answered" },
  { value: "99.9%", label: "Uptime SLA" },
  { value: "< 3s", label: "Average response" },
  { value: "SOC 2", label: "Type II ready" },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background text-white">
      {/* NAV */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm">D</span>
          DATALYST
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-text-secondary hover:text-white transition-colors">Log in</Link>
          <Link href="/register" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold hover:opacity-90 transition-opacity">Start free</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-20 lg:grid-cols-[1fr_0.9fr] lg:text-left">
        <div className="mx-auto max-w-3xl lg:mx-0">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-primary">The Decision Intelligence Platform</p>
          <h1 className="text-5xl font-bold leading-tight md:text-6xl">
            Turn trusted data into<br />clear decisions.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-text-secondary">
            Ask business questions in plain language. Get evidence-backed answers with charts, forecasts, and governance — all in one workspace.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 lg:justify-start">
            <Link href="/dashboard" className="rounded-lg bg-primary px-6 py-3 font-semibold transition-opacity hover:opacity-90">
              Explore the workspace
            </Link>
            <a href="#how-it-works" className="rounded-lg border border-border px-6 py-3 text-text-secondary transition-colors hover:border-text-muted hover:text-white">
              See how it works
            </a>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-surface p-2 shadow-2xl shadow-primary/20">
          <Image
            src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=85"
            alt="Business analytics dashboard displayed on a screen"
            width={1200}
            height={900}
            priority
            className="aspect-[4/3] rounded-2xl object-cover opacity-90"
          />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/65 via-transparent to-primary/10" />
          <div className="absolute bottom-7 left-7 rounded-xl border border-white/15 bg-background/80 px-4 py-3 backdrop-blur">
            <p className="text-xs font-semibold text-primary">EVIDENCE, NOT GUESSWORK</p>
            <p className="mt-1 text-sm text-text-secondary">Clear methods behind every answer.</p>
          </div>
        </div>

        {/* STATS BAR */}
        <div className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-6 rounded-2xl border border-border bg-surface p-8 md:grid-cols-4 lg:col-span-2">
          {stats.map(s => (
            <div key={s.label} className="text-center">
              <div className="text-2xl font-bold text-primary">{s.value}</div>
              <div className="mt-1 text-xs text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">How it works</p>
          <h2 className="mt-3 text-center text-3xl font-bold">Three steps to insight</h2>
        <div className="mt-12 space-y-8">
          <div className="grid gap-8 md:grid-cols-3">
          {steps.map(s => (
              <div key={s.num} className="rounded-2xl border border-border bg-surface p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">{s.num}</div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{s.desc}</p>
              </div>
          ))}
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface">
            <Image
              src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85"
              alt="A team collaborating around business data"
              width={1400}
              height={520}
              className="h-56 w-full object-cover opacity-65"
            />
            <div className="absolute inset-0 flex items-end bg-gradient-to-t from-background via-background/20 to-transparent p-7">
              <div className="max-w-md">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Built for teams</p>
                <p className="mt-2 text-lg font-bold">Move from a question to an explainable decision together.</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">Capabilities</p>
          <h2 className="mt-3 text-center text-3xl font-bold">Everything your team needs to decide with confidence</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(f => (
              <div key={f.title} className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary/40">
                <div className="text-2xl">{f.icon}</div>
                <h3 className="mt-3 font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">Built for trust</p>
          <h2 className="mt-3 text-center text-3xl font-bold">Answers your team can stand behind</h2>
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-surface p-6 text-center">
              <div className="text-3xl">🔒</div>
              <h3 className="mt-3 font-bold">Row-level security</h3>
              <p className="mt-2 text-sm text-text-secondary">Every query is scoped to your organization. Users only see what they&apos;re authorized to access.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center">
              <div className="text-3xl">📋</div>
              <h3 className="mt-3 font-bold">Full audit trail</h3>
              <p className="mt-2 text-sm text-text-secondary">Every analysis, plan change, and data upload is logged with timestamps and user identity.</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6 text-center">
              <div className="text-3xl">🧮</div>
              <h3 className="mt-3 font-bold">Method transparency</h3>
              <p className="mt-2 text-sm text-text-secondary">Results show exactly how they were calculated, which records were used, and what was excluded.</p>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
          <h2 className="mt-3 text-center text-3xl font-bold">Start small. Scale with confidence.</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-text-secondary">No credit card required for the free plan. Upgrade anytime.</p>
          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-3">
            {plans.map(p => (
              <div key={p.name} className={`flex flex-col rounded-2xl border p-8 ${p.featured ? "border-primary bg-surface shadow-lg shadow-primary/10" : "border-border bg-surface"}`}>
                {p.featured && <span className="mb-4 inline-block w-fit rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary">Most popular</span>}
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{p.name}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{p.price}</span>
                  {p.period && <span className="text-sm text-text-muted">{p.period}</span>}
                </div>
                <p className="mt-2 text-sm text-text-secondary">{p.desc}</p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="mt-0.5 text-primary">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={p.name === "Enterprise" ? "/login" : "/dashboard"}
                  className={`mt-8 block rounded-lg py-3 text-center font-semibold transition-opacity hover:opacity-90 ${p.featured ? "bg-primary text-white" : "border border-border text-white hover:border-text-muted"}`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-text-muted">Plan prices are illustrative for this demo and are not a billing system.</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
          <h2 className="mt-3 text-center text-3xl font-bold">Common questions</h2>
          <div className="mt-12 space-y-6">
            {[
              { q: "What types of data can I upload?", a: "CSV and JSON files. Datalyst auto-detects columns, types, and handles messy report notes. For best results, include a date column, a numeric measure, and one or more category columns." },
              { q: "Is my data secure?", a: "Yes. Data is encrypted in transit and at rest. Every query is scoped to your organization with role-based access controls. Full audit trails are maintained for every action." },
              { q: "Do I need to know SQL or coding?", a: "No. Datalyst works entirely in plain English. Type a question like 'Which region has the highest sales?' and get a chart-backed answer instantly." },
              { q: "Can I try it before committing?", a: "Absolutely. The Explorer plan is free forever with no credit card required. Upgrade to Team when you need shared workspaces and unlimited queries." },
              { q: "How does the forecasting work?", a: "Datalyst uses seasonal time-series models with automatic holdout validation. It reports MAE and MAPE so you know exactly how reliable the forecast is." },
            ].map(item => (
              <div key={item.q} className="rounded-2xl border border-border bg-surface p-6">
                <h3 className="font-bold">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">Ready to make decisions you can explain?</h2>
          <p className="mx-auto mt-4 max-w-lg text-text-secondary">Start exploring your data in minutes. No credit card, no setup calls, no commitment.</p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link href="/dashboard" className="rounded-lg bg-primary px-6 py-3 font-semibold transition-opacity hover:opacity-90">
              Get started free
            </Link>
            <Link href="/login" className="rounded-lg border border-border px-6 py-3 text-text-secondary transition-colors hover:border-text-muted hover:text-white">
              Log in
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 text-sm text-text-muted md:flex-row">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs">D</span>
            DATALYST
          </div>
          <div className="flex gap-6">
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
          </div>
          <span>Decision intelligence for teams that move with clarity.</span>
        </div>
      </footer>
    </main>
  );
}
