// ── Helpers ──────────────────────────────────────────────────────────────────

function getNumber(value) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/[$,]/g, ""));
}

// ── Forecast Engine ──────────────────────────────────────────────────────────

function getForecastData() {
  if (!rows.length) return null;

  const keys = Object.keys(rows[0]);

  const revenueKey =
    keys.find((k) => /^(revenue|sales|amount|total.?sales)$/i.test(k)) ||
    keys.find((k) => /(revenue|sales|amount)/i.test(k));

  const dateKey =
    keys.find((k) => /^(date|order.?date|month|period)$/i.test(k)) ||
    keys.find((k) => /(date|month|period)/i.test(k));

  if (!revenueKey) return null;

  const dated = rows
    .map((r) => ({
      value: getNumber(r[revenueKey]),
      date: dateKey ? new Date(r[dateKey]) : null,
    }))
    .filter((x) => Number.isFinite(x.value));

  if (!dated.length) return null;

  const buckets = {};

  dated.forEach((x, i) => {
    const valid = x.date && !Number.isNaN(x.date);
    const key = valid
      ? `${x.date.getFullYear()}-${String(x.date.getMonth() + 1).padStart(2, "0")}`
      : `record-${i}`;
    buckets[key] = (buckets[key] || 0) + x.value;
  });

  const values = Object.entries(buckets)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map((x) => x[1]);

  const n = values.length;
  const xs = values.map((_, i) => i);
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;

  const denom = xs.reduce((a, x) => a + (x - meanX) ** 2, 0) || 1;
  const slope =
    xs.reduce((a, x, i) => a + (x - meanX) * (values[i] - meanY), 0) / denom;
  const intercept = meanY - slope * meanX;

  const future = Array.from({ length: 12 }, (_, i) =>
    Math.max(0, intercept + slope * (n + i))
  );

  return {
    revenueKey,
    dateKey,
    values,
    slope,
    future,
    total: future.reduce((a, b) => a + b, 0),
    observed: values.reduce((a, b) => a + b, 0),
  };
}

// ── SVG Chart Rendering ──────────────────────────────────────────────────────

function drawForecast(f) {
  const svg = document.querySelector("#revenueChart");
  const W = 720;
  const H = 220;
  const all = [...f.values, ...f.future];
  const max = Math.max(...all) * 1.15 || 1;

  const point = (v, i) =>
    `${i * (W / (all.length - 1))},${H - 15 - (v / max) * (H - 32)}`;

  const actual = f.values.map(point).join(" ");
  const projected = f.future
    .map((v, i) => point(v, i + f.values.length))
    .join(" ");
  const last = point(f.values.at(-1), f.values.length - 1);

  svg.innerHTML = `
    ${[20, 78, 136, 194]
      .map(
        (y) =>
          `<line x1="0" x2="720" y1="${y}" y2="${y}" stroke="#2a3951" stroke-dasharray="3 4"/>`
      )
      .join("")}
    <polyline
      points="${actual}"
      fill="none"
      stroke="#818aff"
      stroke-width="3"
      stroke-linecap="round"
    />
    <polyline
      points="${last} ${projected}"
      fill="none"
      stroke="#4dd5a0"
      stroke-width="3"
      stroke-dasharray="7 6"
      stroke-linecap="round"
    />
    <text x="${W - 120}" y="22" fill="#74e6bc" font-size="11">Forecast</text>
  `;
}

// ── Column / Field Detection ─────────────────────────────────────────────────

function fieldMatch(patterns) {
  const keys = columnInfo();
  return keys.find((key) => patterns.some((pattern) => pattern.test(key))) || null;
}

function numericField() {
  return (
    fieldMatch([
      /^(revenue|sales|amount|total.?sales|profit|views|active users|event count|bounce rate)$/i,
      /(revenue|sales|amount|profit|views|users|events|rate)/i,
    ]) ||
    columnInfo().find((key) =>
      rows.some((row) => Number.isFinite(getNumber(row[key])))
    )
  );
}

function dimensionField(query) {
  const requested = columnInfo().find((key) =>
    query.toLowerCase().includes(key.toLowerCase())
  );
  return (
    requested ||
    fieldMatch([/page|title|screen|product|category|region|segment|country/i])
  );
}

// ── Data Quality ─────────────────────────────────────────────────────────────

function qualitySummary() {
  let total = 0;
  let missing = 0;

  rows.forEach((row) =>
    Object.values(row).forEach((value) => {
      total++;
      if (value == null || String(value).trim() === "") missing++;
    })
  );

  return {
    total,
    missing,
    completeness: total ? Math.round((1 - missing / total) * 100) : 0,
    duplicates: rows.length - new Set(rows.map((row) => JSON.stringify(row))).size,
  };
}

// ── Grouping ─────────────────────────────────────────────────────────────────

function groupValues(field, group) {
  const totals = new Map();

  rows.forEach((row) => {
    const value = getNumber(row[field]);
    if (Number.isFinite(value)) {
      const label = String(row[group] ?? "Unknown");
      totals.set(label, (totals.get(label) || 0) + value);
    }
  });

  return [...totals].sort((a, b) => b[1] - a[1]);
}

// ── Evidence Chart ───────────────────────────────────────────────────────────

function drawEvidenceChart(values, labels, title) {
  const svg = document.querySelector("#revenueChart");
  const W = 720;
  const H = 220;
  const max = Math.max(...values, 1) * 1.15;

  const point = (value, index) =>
    `${index * (W / Math.max(values.length - 1, 1))},${H - 15 - (value / max) * (H - 32)}`;

  svg.innerHTML = `
    ${[20, 78, 136, 194]
      .map(
        (y) =>
          `<line x1="0" x2="720" y1="${y}" y2="${y}" stroke="#2a3951" stroke-dasharray="3 4"/>`
      )
      .join("")}
    <polyline
      points="${values.map(point).join(" ")}"
      fill="none"
      stroke="#818aff"
      stroke-width="3"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  `;

  const axis = document.querySelector(".x-axis");
  axis.innerHTML = labels
    .slice(-12)
    .map((label) => `<span>${String(label).slice(0, 10)}</span>`)
    .join("");

  document.querySelector(".chart-card .eyebrow").textContent =
    "DATA-DERIVED EVIDENCE";
  document.querySelector(".chart-card h3").textContent = title;
  document.querySelector(".chart-total strong").textContent = money(
    values.reduce((sum, value) => sum + value, 0)
  );
  document.querySelector(".chart-total span").innerHTML =
    `${values.length} evidence points <small>from current source</small>`;
}

// ── Insight Presentation ─────────────────────────────────────────────────────

function presentEvidence({
  title,
  copy,
  method,
  records,
  values = [],
  labels = [],
  chartTitle = "Analysis evidence",
}) {
  const quality = qualitySummary();

  document.querySelector(".insight-card h2").textContent = title;
  document.querySelector(".insight-copy").innerHTML = copy;

  document.querySelector("#resultsBanner").innerHTML =
    `✦ Analysis results <span>${method} · ${records.toLocaleString()} records used · ${quality.completeness}% complete</span>`;

  if (values.length) drawEvidenceChart(values, labels, chartTitle);

  addHistory(document.querySelector("#queryInput").value || method);

  window.updateAssurance?.({
    method,
    note: `${records.toLocaleString()} records evaluated; ${quality.duplicates} exact duplicates detected.`,
    confidence: `${quality.completeness}% complete; inspect source limitations before acting.`,
  });

  document
    .querySelector("#insights")
    .scrollIntoView({ behavior: "smooth", block: "start" });

  toast("Analysis generated from the current dataset.");
}

// ── Data-Driven Analysis ─────────────────────────────────────────────────────

function dataDrivenAnalysis(query) {
  const field = numericField();
  const q = query.toLowerCase();

  if (!field) {
    presentEvidence({
      title: "A numeric measure is needed for this analysis.",
      copy: "Upload data containing a numeric Sales, Revenue, Amount, Profit, or similar measure.",
      method: "Data readiness check",
      records: rows.length,
    });
    return;
  }

  // ── Anomaly / Outlier Detection ──────────────────────────────────────────

  if (/anomal|outlier|unusual/.test(q)) {
    const values = rows
      .map((row, index) => ({ row, index, value: getNumber(row[field]) }))
      .filter((item) => Number.isFinite(item.value))
      .sort((a, b) => a.value - b.value);

    const median = (items) =>
      items.length ? items[Math.floor(items.length / 2)] : 0;

    const mid = Math.floor(values.length / 2);
    const q1 = median(
      values
        .slice(0, mid)
        .map((x) => x.value)
    );
    const q3 = median(
      values
        .slice(values.length % 2 ? mid + 1 : mid)
        .map((x) => x.value)
    );
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;

    const outliers = values.filter(
      (item) => item.value < low || item.value > high
    );

    const labels = outliers
      .slice(-8)
      .map(
        (item) =>
          String(item.row[dimensionField(q) || "Order_ID"] ??
            `Record ${item.index + 1}`)
      );

    presentEvidence({
      title: outliers.length
        ? `${outliers.length} potential ${field} outlier${outliers.length === 1 ? "" : "s"} detected.`
        : `No material ${field} outliers were detected.`,
      copy: `Method: IQR fences (${money(low)} to ${money(high)}). These records are candidates for review, not proof of an error or fraud.`,
      method: "IQR outlier screening",
      records: values.length,
      values: outliers.slice(-8).map((x) => x.value),
      labels,
      chartTitle: `Potential ${field} outliers`,
    });
    return;
  }

  // ── Trend / Time-Series Analysis ─────────────────────────────────────────

  const dateField = fieldMatch([
    /^(date|order.?date|month|period)$/i,
    /(date|month|period)/i,
  ]);

  if (/trend|month|time|growth|over time/.test(q) && dateField) {
    const buckets = new Map();

    rows.forEach((row) => {
      const date = new Date(row[dateField]);
      const value = getNumber(row[field]);

      if (!Number.isNaN(date) && Number.isFinite(value)) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, (buckets.get(key) || 0) + value);
      }
    });

    const series = [...buckets].sort((a, b) => a[0].localeCompare(b[0]));
    const values = series.map((x) => x[1]);
    const change =
      values.length > 1
        ? (values.at(-1) - values[0]) / Math.max(Math.abs(values[0]), 1)
        : 0;

    presentEvidence({
      title: `${field} trend shows a ${change >= 0 ? "positive" : "negative"} trajectory of ${(change * 100).toFixed(1)}%.`,
      copy: `Compared ${series.length} time periods. The latest period recorded ${money(values.at(-1))}, versus ${money(values[0])} in the earliest.`,
      method: "Time-series trend",
      records: values.length,
      values,
      labels: series.map((x) => x[0]),
      chartTitle: `${field} over time`,
    });
    return;
  }

  // ── Grouping / Ranking ───────────────────────────────────────────────────

  const dim = dimensionField(q);

  if (dim && /top|bottom|group|by|compare|segment|rank/.test(q)) {
    const grouped = groupValues(field, dim);

    if (grouped.length) {
      presentEvidence({
        title: `Grouped ${field} by ${dim} — ${grouped.length} segments.`,
        copy: `The largest segment is <strong>${grouped[0][0]}</strong> at ${money(grouped[0][1])}. The smallest is <strong>${grouped.at(-1)[0]}</strong> at ${money(grouped.at(-1)[1])}.`,
        method: `Group-by ${dim}`,
        records: rows.length,
        values: grouped.map((x) => x[1]).slice(0, 12),
        labels: grouped.map((x) => String(x[0]).slice(0, 12)).slice(0, 12),
        chartTitle: `${field} by ${dim}`,
      });
      return;
    }
  }

  // ── Default: Summary Stats ───────────────────────────────────────────────

  const nums = rows
    .map((r) => getNumber(r[field]))
    .filter(Number.isFinite);

  if (!nums.length) {
    presentEvidence({
      title: `No numeric ${field} values found.`,
      copy: "Upload a dataset with a valid numeric column.",
      method: "Statistical summary",
      records: rows.length,
    });
    return;
  }

  nums.sort((a, b) => a - b);
  const sum = nums.reduce((a, b) => a + b, 0);
  const avg = sum / nums.length;
  const med = nums[Math.floor(nums.length / 2)];

  presentEvidence({
    title: `${field} summary — ${nums.length} values.`,
    copy: `Total: <strong>${money(sum)}</strong>. Average: <strong>${money(avg)}</strong>. Median: <strong>${money(med)}</strong>. Min: <strong>${money(nums[0])}</strong>. Max: <strong>${money(nums.at(-1))}</strong>.`,
    method: "Statistical summary",
    records: nums.length,
    values: nums,
    labels: nums.map((_, i) => `#${i + 1}`),
    chartTitle: `${field} distribution`,
  });
}

// ── Enterprise Analyze (Forecast Router) ─────────────────────────────────────

function enterpriseAnalyze(query) {
  const q = query.trim();
  if (!q) return;

  document.querySelector("#queryInput").value = "";

  if (!/(forecast|predict|projection|next year|next quarter)/i.test(q)) {
    dataDrivenAnalysis(q);
    return;
  }

  const f = getForecastData();
  const title = document.querySelector(".insight-card h2");
  const copy = document.querySelector(".insight-copy");
  const banner = document.querySelector("#resultsBanner");

  if (!f) {
    title.textContent =
      "A revenue forecast needs a numeric revenue or sales field.";
    copy.textContent =
      "Upload a dataset containing a Sales, Revenue, Amount, or Total Sales column. Adding a Date column will also allow a time-based projection.";
    banner.innerHTML =
      '✦ Forecast needs more data <span>Add a revenue column and try again</span>';
    document
      .querySelector("#insights")
      .scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const monthly = f.total / 12;
  const direction = f.slope >= 0 ? "upward" : "downward";
  const confidence = f.values.length >= 6 ? "medium" : "directional";

  title.textContent = `Forecast: next-year revenue is estimated at ${money(f.total)}.`;

  copy.innerHTML =
    `Based on <strong>${f.values.length}</strong> observed ${f.dateKey ? "time periods" : "records"}, the ${f.revenueKey} trend is <strong class="positive">${direction}</strong>. The projection averages <strong>${money(monthly)}</strong> per month. Confidence: <strong>${confidence}</strong> — forecasts are trend estimates, not guarantees.`;

  banner.innerHTML =
    `✦ Forecast results <span>12-month linear trend projection · ${confidence} confidence</span>`;

  document.querySelector(".chart-card .eyebrow").textContent =
    "REVENUE FORECAST";
  document.querySelector(".chart-card h3").textContent =
    "Observed revenue and next 12 months";
  document.querySelector(".chart-total strong").textContent = money(f.total);
  document.querySelector(".chart-total span").innerHTML =
    "↗ Projected <small>next 12 months</small>";

  drawForecast(f);
  addHistory(q);

  document
    .querySelector("#insights")
    .scrollIntoView({ behavior: "smooth", block: "start" });

  toast("Forecast generated from your uploaded data.");
}

// ── Event Wiring ─────────────────────────────────────────────────────────────

document.querySelector("#sendQuery").onclick = () =>
  enterpriseAnalyze(document.querySelector("#queryInput").value);

document
  .querySelector("#queryInput")
  .addEventListener(
    "keydown",
    (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        enterpriseAnalyze(e.target.value);
      }
    },
    true
  );

document
  .querySelectorAll("[data-query]")
  .forEach(
    (b) =>
      (b.onclick = () => enterpriseAnalyze(b.dataset.query))
  );
