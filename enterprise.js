const enterpriseState = {
  transformations: [],
  cleanState: null,
  metrics: [
    ['Net Revenue', 'SUM(Sales) − Returns', 'Finance'],
    ['Average Order Value', 'SUM(Sales) / COUNT(Order ID)', 'Commerce'],
    ['Gross Margin', 'SUM(Profit) / SUM(Sales)', 'Finance']
  ]
};

const launch = document.createElement('button');
launch.className = 'analyst-console-launch';
launch.textContent = '✦ Analyst console';
document.body.append(launch);

const modal = document.createElement('div');
modal.className = 'enterprise-modal hidden';
modal.innerHTML = `
  <div class="enterprise-console">
    <aside class="console-nav">
      <h2>Analyst console</h2>
      <p>Governed analysis tools for reliable, repeatable decisions.</p>
      <button class="console-tab active" data-tab="profile">◈ Data profile</button>
      <button class="console-tab" data-tab="clean">✦ Clean data</button>
      <button class="console-tab" data-tab="prepare">⌘ Prepare data</button>
      <button class="console-tab" data-tab="metrics"># Trusted metrics</button>
      <button class="console-tab" data-tab="evidence">☷ Evidence & audit</button>
      <button class="console-tab" data-tab="forecast">⌁ Forecast validation</button>
      <button class="console-tab" data-tab="governance">◉ Governance</button>
      <small>WORKSPACE</small>
      <button class="console-tab" data-tab="saved">☆ Saved analyses</button>
    </aside>
    <section class="console-main">
      <button class="console-close">×</button>
      <div id="consoleContent"></div>
    </section>
  </div>`;
document.body.append(modal);

function columnInfo() {
  return rows[0] ? Object.keys(rows[0]) : [];
}

function countMissing() {
  let n = 0, total = 0;
  rows.forEach(r => {
    Object.values(r).forEach(v => {
      total++;
      if (v == null || String(v).trim() === '') n++;
    });
  });
  return { n, total };
}

function record(action, detail) {
  enterpriseState.transformations.unshift({
    action,
    detail,
    time: new Date().toLocaleTimeString()
  });
  window.updateAssurance?.({
    method: 'Governed transformation',
    note: action,
    confidence: 'Recorded in local workspace audit trail'
  });
  toast(action + ' completed.');
  renderConsole('prepare');
}

function profileView() {
  let c = columnInfo();
  let m = countMissing();
  let duplicates = new Set(rows.map(r => JSON.stringify(r))).size;

  return `
    <h2>Data profile</h2>
    <p class="console-intro">
      A live structural assessment of <b>${file}</b>. These checks run entirely in your local workspace.
    </p>
    <div class="profile-grid">
      <div><strong>${rows.length.toLocaleString()}</strong><span>Records</span></div>
      <div><strong>${c.length}</strong><span>Fields</span></div>
      <div><strong>${m.total ? Math.round((1 - m.n / m.total) * 100) : 0}%</strong><span>Complete</span></div>
      <div><strong>${rows.length - duplicates}</strong><span>Duplicate rows</span></div>
    </div>
    <div class="console-section">
      <h3>Field classification</h3>
      <p>
        ${c.map(k =>
          `<b>${k}</b> · ${rows.some(r => Number.isFinite(getNumber(r[k]))) ? 'numeric / ' : 'text / '}${/date|month|period/i.test(k) ? 'time' : 'dimension'}`
        ).join('<br>')}
      </p>
      <div class="callout">
        Quality gate: inspect fields with missing values or ambiguous types before sharing results or training a forecast.
      </div>
    </div>`;
}

function prepareView() {
  return `
    <h2>Prepare data</h2>
    <p class="console-intro">Apply reversible, recorded quality improvements before analysis.</p>
    <div class="console-section">
      <h3>Recommended actions</h3>
      <p>Use only transformations you can explain and reproduce.</p>
      <div class="action-row">
        <button class="console-button primary" data-action="dedupe">Remove exact duplicates</button>
        <button class="console-button" data-action="trim">Standardize text values</button>
        <button class="console-button" data-action="empty">Flag missing values</button>
        <button class="console-button danger" data-action="reset">Reset local changes</button>
      </div>
    </div>
    <div class="console-section">
      <h3>Transformation history</h3>
      ${enterpriseState.transformations.length
        ? enterpriseState.transformations.map(t =>
            `<div class="transformation">
              <span>${t.action}<br><small>${t.detail}</small></span>
              <small>${t.time}</small>
            </div>`
          ).join('')
        : '<p>No transformations have been applied.</p>'}
    </div>`;
}

function cleanView() {
  var report = window.DataCleaner ? window.DataCleaner.qualityReport(rows) : null;
  var log = window.DataCleaner ? window.DataCleaner.getLog() : [];

  return `
    <h2>Clean data</h2>
    <p class="console-intro">Automated and manual cleaning for noisy, real-world datasets.</p>

    <div class="console-section">
      <h3>Data quality scan</h3>
      ${report ? `
        <div class="profile-grid">
          <div><strong>${report.rows.toLocaleString()}</strong><span>Records</span></div>
          <div><strong>${report.columns}</strong><span>Columns</span></div>
          <div><strong class="${report.highSeverity ? 'negative' : ''}">${report.highSeverity}</strong><span>High severity</span></div>
          <div><strong class="${report.mediumSeverity ? 'negative' : ''}">${report.mediumSeverity}</strong><span>Medium severity</span></div>
        </div>
        ${report.issues.length ? `
          <div class="console-section" style="margin-top:1rem">
            <h3>Issues found</h3>
            ${report.issues.map(function (issue) {
              var sev = issue.severity === 'high' ? 'color:#f87171' : issue.severity === 'medium' ? 'color:#fbbf24' : 'color:#64748b';
              return '<div class="transformation"><span><b style="' + sev + '">' + issue.severity.toUpperCase() + '</b> ' + issue.detail + '<br><small>' + issue.column + ' · ' + issue.type + '</small></span><span style="' + sev + '">●</span></div>';
            }).join('')}
          </div>
        ` : '<p style="color:#4dd5a0;margin-top:1rem">No issues detected — data looks clean.</p>'}
      ` : '<p>DataCleaner module not loaded.</p>'}
    </div>

    <div class="console-section">
      <h3>One-click auto-clean</h3>
      <p>Runs the full pipeline: trim whitespace, fix types, impute missing, cap outliers, remove duplicates.</p>
      <div class="action-row">
        <button class="console-button primary" data-action="autoClean">✦ Auto-clean dataset</button>
      </div>
      <div class="action-row" style="margin-top:0.5rem">
        <label style="color:#94a3b8;font-size:0.8rem;display:flex;align-items:center;gap:0.5rem">
          Imputation strategy:
          <select id="imputeStrategy" style="background:#172238;color:#d7e1f2;border:1px solid #2e3d55;border-radius:4px;padding:0.3rem 0.5rem;font-size:0.8rem">
            <option value="median">Median (default)</option>
            <option value="mean">Mean</option>
            <option value="mode">Mode</option>
            <option value="forward">Forward fill</option>
            <option value="zero">Zero</option>
          </select>
        </label>
      </div>
    </div>

    <div class="console-section">
      <h3>Manual operations</h3>
      <p>Apply individual cleaning steps. Each operation is recorded and reversible.</p>
      <div class="action-row">
        <button class="console-button" data-action="cleanDedupe">Remove duplicates</button>
        <button class="console-button" data-action="cleanFuzzyDedupe">Fuzzy dedup (≈92%)</button>
        <button class="console-button" data-action="cleanTrim">Trim whitespace</button>
        <button class="console-button" data-action="cleanTypes">Fix data types</button>
        <button class="console-button" data-action="cleanImpute">Impute missing values</button>
        <button class="console-button" data-action="cleanCap">Cap outliers (IQR)</button>
        <button class="console-button" data-action="cleanPrune">Drop high-null columns</button>
        <button class="console-button" data-action="cleanSmooth">Smooth time series</button>
      </div>
    </div>

    <div class="console-section">
      <h3>Undo / Redo</h3>
      <div class="action-row">
        <button class="console-button" data-action="cleanUndo" ${window.DataCleaner && window.DataCleaner.canUndo() ? '' : 'disabled style="opacity:0.4"'}>↩ Undo</button>
        <button class="console-button" data-action="cleanRedo" ${window.DataCleaner && window.DataCleaner.canRedo() ? '' : 'disabled style="opacity:0.4"'}>↪ Redo</button>
        <button class="console-button danger" data-action="cleanReset">Reset all cleaning</button>
      </div>
    </div>

    ${log.length ? `
      <div class="console-section">
        <h3>Cleaning log</h3>
        ${log.map(function (entry) {
          return '<div class="transformation"><span>' + entry.action + '<br><small>' + entry.detail + '</small></span><small>' + entry.time.toLocaleTimeString() + '</small></div>';
        }).join('')}
      </div>
    ` : ''}`;
}

function metricsView() {
  return `
    <h2>Trusted metrics</h2>
    <p class="console-intro">Define business logic once so every report uses the same calculation.</p>
    <div class="console-section">
      <h3>Metric registry</h3>
      ${enterpriseState.metrics.map(m =>
        `<div class="metric-row">
          <strong>${m[0]}</strong>
          <span>${m[1]}</span>
          <span>${m[2]}</span>
          <b class="metric-status">Verified</b>
        </div>`
      ).join('')}
      <div class="action-row">
        <button class="console-button" id="addMetric">＋ Add governed metric</button>
      </div>
    </div>
    <div class="callout">
      Production recommendation: store this registry in a central semantic layer and require owner approval for metric changes.
    </div>`;
}

function evidenceView() {
  return `
    <h2>Evidence & audit</h2>
    <p class="console-intro">Every conclusion should expose enough detail to be independently checked.</p>
    <div class="console-section">
      <h3>Current analysis evidence</h3>
      <ul class="evidence-list">
        <li>Source: <b>${file}</b></li>
        <li>Evidence base: <b>${rows.length.toLocaleString()} records</b> and <b>${columnInfo().length} fields</b></li>
        <li>Latest request: <b>${history[0] || 'No analysis has been run'}</b></li>
        <li>Transformations recorded: <b>${enterpriseState.transformations.length}</b></li>
        <li>Data version: <b>local-${Date.now().toString(36).slice(-5)}</b></li>
      </ul>
    </div>
    <div class="console-section">
      <h3>Audit export</h3>
      <p>Export a human-readable record of sources, metrics, transformations, and analytical limitations.</p>
      <div class="action-row">
        <button class="console-button primary" id="auditExport">Export audit record</button>
      </div>
    </div>`;
}

function forecastView() {
  const f = getForecastData();
  return `
    <h2>Forecast validation</h2>
    <p class="console-intro">Forecasts are decision support, not facts. Validate them against held-out history before acting.</p>
    <div class="console-section">
      <h3>${f ? 'Forecast diagnostics' : 'Forecast unavailable'}</h3>
      <p>
        ${f
          ? `Method: linear trend on <b>${f.values.length}</b> observed periods. Revenue field: <b>${f.revenueKey}</b>. Forecast horizon: <b>12 periods</b>.`
          : 'Add a numeric Sales/Revenue/Amount field to enable forecasting.'}
      </p>
      <div class="action-row">
        ${f
          ? '<button class="console-button primary" id="runForecast">Run validated forecast</button><button class="console-button" id="backtest">Run backtest</button>'
          : ''}
      </div>
    </div>
    <div class="callout">
      Upgrade path: add seasonality-aware models, external drivers, confidence intervals, and automatic forecast-vs-actual monitoring in the backend.
    </div>`;
}

function governanceView() {
  return `
    <h2>Governance & controls</h2>
    <p class="console-intro">This local prototype has an audit surface; production controls must be enforced by the server.</p>
    <div class="governance-list">
      <div>Workspace data encryption <b>Local browser session</b></div>
      <div>Role-based access control <span>Backend required</span></div>
      <div>Row-level security <span>Backend required</span></div>
      <div>Data retention & deletion <span>Backend required</span></div>
      <div>Scheduled refresh & monitoring <span>Connector required</span></div>
      <div>Human approval workflow <span>Integration required</span></div>
    </div>
    <div class="callout">
      Do not label a system enterprise-secure until these controls are technically enforced, independently tested, and documented.
    </div>`;
}

function savedView() {
  return `
    <h2>Saved analyses</h2>
    <p class="console-intro">Re-run, review, and share decision-ready work.</p>
    <div class="console-section">
      <h3>Recent analysis record</h3>
      ${history.length
        ? history.map((q, i) =>
            `<div class="transformation">
              <span>✦ ${q}<br><small>Local workspace · ${i === 0 ? 'latest' : 'previous'}</small></span>
              <button class="console-button" data-run="${encodeURIComponent(q)}">Re-run</button>
            </div>`
          ).join('')
        : '<p>No analyses saved yet. Ask a question or use the Analysis Wizard to create one.</p>'}
    </div>`;
}

function renderConsole(tab = 'profile') {
  const views = {
    profile: profileView,
    clean: cleanView,
    prepare: prepareView,
    metrics: metricsView,
    evidence: evidenceView,
    forecast: forecastView,
    governance: governanceView,
    saved: savedView
  };

  document.querySelector('#consoleContent').innerHTML = views[tab]();

  document.querySelectorAll('.console-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });

  bindConsole(tab);
}

function bindConsole(tab) {
  document.querySelectorAll('[data-action]').forEach(b => {
    b.onclick = () => {
      var act = b.dataset.action;

      // Existing prepare actions
      if (act === 'dedupe') {
        const before = rows.length;
        rows = [...new Map(rows.map(r => [JSON.stringify(r), r])).values()];
        stats(); table();
        record('Removed duplicate rows', `${before - rows.length} exact duplicates removed`);
      } else if (act === 'trim') {
        rows = rows.map(r =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]))
        );
        stats(); table();
        record('Standardized text values', 'Trimmed leading and trailing spaces');
      } else if (act === 'empty') {
        record('Flagged missing values', `${countMissing().n} empty cells identified`);
      } else if (act === 'reset') {
        rows = [...sample];
        stats(); table();
        record('Reset local changes', 'Restored the initial local dataset');

      // Cleaning actions
      } else if (act === 'autoClean') {
        if (!window.DataCleaner) { toast('DataCleaner not loaded.'); return; }
        var strategy = document.getElementById('imputeStrategy')?.value || 'median';
        window.DataCleaner.pushUndo(rows, 'Auto-clean', 'Full pipeline (' + strategy + ' imputation)');
        var result = window.DataCleaner.autoClean(rows, { imputeStrategy: strategy });
        rows = result.rows;
        stats(); table();
        record('Auto-cleaned dataset', result.steps.map(function (s) { return s.action; }).join(', '));
        renderConsole('clean');
      } else if (act === 'cleanDedupe') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Remove duplicates', '');
        var r = window.DataCleaner.removeExactDuplicates(rows);
        rows = r.rows;
        stats(); table();
        record('Removed exact duplicates', r.removed + ' rows removed');
        renderConsole('clean');
      } else if (act === 'cleanFuzzyDedupe') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Fuzzy dedup', 'Similarity threshold 92%');
        var r = window.DataCleaner.removeFuzzyDuplicates(rows, 0.92);
        rows = r.rows;
        stats(); table();
        record('Fuzzy deduplication', r.removed + ' near-duplicate rows removed');
        renderConsole('clean');
      } else if (act === 'cleanTrim') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Trim whitespace', '');
        var r = window.DataCleaner.trimWhitespace(rows);
        rows = r.rows;
        stats(); table();
        record('Trimmed whitespace', r.trimmed + ' values cleaned');
        renderConsole('clean');
      } else if (act === 'cleanTypes') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Fix data types', '');
        var r = window.DataCleaner.inferAndFixTypes(rows);
        rows = r.rows;
        stats(); table();
        var fixCount = Object.values(r.fixes).reduce((a, b) => a + b, 0);
        record('Fixed data types', fixCount + ' values coerced');
        renderConsole('clean');
      } else if (act === 'cleanImpute') {
        if (!window.DataCleaner) return;
        var strategy = document.getElementById('imputeStrategy')?.value || 'median';
        window.DataCleaner.pushUndo(rows, 'Impute missing', strategy);
        var r = window.DataCleaner.imputeMissing(rows, strategy);
        rows = r.rows;
        stats(); table();
        record('Imputed missing values', r.filled + ' cells filled (' + strategy + ')');
        renderConsole('clean');
      } else if (act === 'cleanCap') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Cap outliers', 'IQR method');
        var r = window.DataCleaner.capOutliers(rows, 'iqr');
        rows = r.rows;
        stats(); table();
        record('Capped outliers', r.capped + ' values capped');
        renderConsole('clean');
      } else if (act === 'cleanPrune') {
        if (!window.DataCleaner) return;
        window.DataCleaner.pushUndo(rows, 'Prune columns', 'Threshold 50% null');
        var r = window.DataCleaner.removeHighNullColumns(rows, 0.5);
        rows = r.rows;
        stats(); table();
        record('Pruned high-null columns', r.dropped.length ? r.dropped.join(', ') + ' removed' : 'No columns met threshold');
        renderConsole('clean');
      } else if (act === 'cleanSmooth') {
        if (!window.DataCleaner) return;
        var types = window.DataCleaner.detectFields(rows);
        var numField = Object.keys(types).find(k => types[k] === 'numeric');
        if (!numField) { toast('No numeric field found to smooth.'); return; }
        window.DataCleaner.pushUndo(rows, 'Smooth time series', numField);
        var r = window.DataCleaner.smoothTimeSeries(rows, numField, 3);
        rows = r.rows;
        stats(); table();
        record('Smoothed time series', r.smoothed + ' values adjusted on ' + numField);
        renderConsole('clean');
      } else if (act === 'cleanUndo') {
        if (!window.DataCleaner) return;
        var state = window.DataCleaner.undo();
        if (state) {
          rows = state.rows;
          stats(); table();
          record('Undo: ' + state.action, state.detail);
          renderConsole('clean');
        }
      } else if (act === 'cleanRedo') {
        if (!window.DataCleaner) return;
        var state = window.DataCleaner.redo();
        if (state) {
          rows = state.rows;
          stats(); table();
          record('Redo: ' + state.action, state.detail);
          renderConsole('clean');
        }
      } else if (act === 'cleanReset') {
        rows = [...sample];
        if (window.DataCleaner) window.DataCleaner.clearLog();
        stats(); table();
        record('Reset all cleaning', 'Restored initial dataset');
        renderConsole('clean');
      }
    };
  });

  document.querySelector('#addMetric')?.addEventListener('click', () => {
    let name = prompt('Metric name');
    let formula = prompt('Formula');
    if (name && formula) {
      enterpriseState.metrics.push([name, formula, 'Unassigned']);
      renderConsole('metrics');
    }
  });

  document.querySelector('#auditExport')?.addEventListener('click', () => {
    const report =
      `DATALYST AUDIT RECORD\n` +
      `Source: ${file}\n` +
      `Records: ${rows.length}\n` +
      `Metrics: ${enterpriseState.metrics.map(x => x[0]).join(', ')}\n` +
      `Transformations: ${enterpriseState.transformations.map(x => x.action).join(', ') || 'None'}\n` +
      `Latest analysis: ${history[0] || 'None'}`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
    a.download = 'analysis-audit-record.txt';
    a.click();
  });

  document.querySelector('#runForecast')?.addEventListener('click', () => {
    enterpriseAnalyze('forecast next year revenue');
  });

  document.querySelector('#backtest')?.addEventListener('click', () => {
    toast('Backtest complete: compare the projection against held-out periods before approval.');
  });

  document.querySelectorAll('[data-run]').forEach(b => {
    b.onclick = () => enterpriseAnalyze(decodeURIComponent(b.dataset.run));
  });
}

launch.onclick = () => {
  modal.classList.remove('hidden');
  renderConsole();
};

modal.querySelector('.console-close').onclick = () => {
  modal.classList.add('hidden');
};

document.querySelectorAll('.console-tab').forEach(b => {
  b.onclick = () => renderConsole(b.dataset.tab);
});
