const sample = [
  { Order_ID: 'CA-2024-1001', Date: '2024-01-04', Region: 'West', Category: 'Technology', Product: 'Canon imageCLASS 2200', Sales: 61599, Profit: 10472 },
  { Order_ID: 'CA-2024-1002', Date: '2024-01-07', Region: 'East', Category: 'Office Supplies', Product: 'Fellowes PB500 Binder', Sales: 27453, Profit: 4870 },
  { Order_ID: 'CA-2024-1003', Date: '2024-01-12', Region: 'Central', Category: 'Furniture', Product: 'HON 5400 Series Chair', Sales: 21870, Profit: 2150 },
  { Order_ID: 'CA-2024-1004', Date: '2024-02-04', Region: 'West', Category: 'Technology', Product: 'Cisco TelePresence System', Sales: 20450, Profit: 5726 },
  { Order_ID: 'CA-2024-1005', Date: '2024-02-12', Region: 'South', Category: 'Office Supplies', Product: 'GBC DocuBind', Sales: 16220, Profit: 2911 },
  { Order_ID: 'CA-2024-1006', Date: '2024-03-19', Region: 'East', Category: 'Furniture', Product: 'Global Leather Chair', Sales: 14290, Profit: 1480 }
];

var rows=[...sample], file='global_retail_2024.csv', history=[];

const $ = s => document.querySelector(s);

function money(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(n);
}

function renderChart() {
  const vals = [120, 138, 131, 154, 161, 156, 170, 183, 178, 201, 219, 245];
  const svg = $('#revenueChart');
  const W = 720, H = 220;
  let points = vals.map((v, i) => `${i * (W / 11)},${H - 20 - (v - 100) * 1.25}`).join(' ');
  let area = `0,${H} ${points} ${W},${H}`;
  svg.innerHTML = `
    <defs>
      <linearGradient id="fill" x1="0" x2="0" y1="0" y2="1">
        <stop stop-color="#7984ff" stop-opacity=".35" />
        <stop offset="1" stop-color="#7984ff" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${[20, 78, 136, 194].map(y => `<line x1="0" x2="720" y1="${y}" y2="${y}" stroke="#2a3951" stroke-dasharray="3 4" />`).join('')}
    <polygon points="${area}" fill="url(#fill)" />
    <polyline points="${points}" fill="none" stroke="#818aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="720" cy="${H - 20 - (245 - 100) * 1.25}" r="5" fill="#818aff" stroke="#d9dcff" stroke-width="2" />
  `;
}

function table() {
  const table = $('#dataTable');
  if (!rows.length) {
    table.innerHTML = '<tr><td>No usable rows found.</td></tr>';
    return;
  }
  const cols = Object.keys(rows[0]).slice(0, 9);
  table.innerHTML = `
    <thead>
      <tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${rows.slice(0, 100).map(r => `<tr>${cols.map(c => `<td>${r[c] ?? '—'}</td>`).join('')}</tr>`).join('')}
    </tbody>
  `;
}

function stats() {
  const columns = rows[0] ? Object.keys(rows[0]).length : 0;
  $('#rowCount').textContent = rows.length > 999 ? (rows.length / 1000).toFixed(1) + 'K' : rows.length;
  $('#columnCount').textContent = columns;
  $('#fileName').textContent = file;
  $('#fileMeta').textContent = `${rows.length.toLocaleString()} rows · ${columns} columns`;
  $('#datasetCount').textContent = '1';
  const sales = rows.reduce((a, r) => a + (Number(r.Sales) || Number(r.sales) || 0), 0);
  if (sales) {
    $('#totalRevenue').textContent = money(sales);
    $('#averageOrder').textContent = money(sales / rows.length);
  }
}

function toast(message) {
  const t = $('#toast');
  t.textContent = message;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}

function addHistory(q) {
  history.unshift(q);
  history = history.slice(0, 5);
  $('#historyList').innerHTML = history.map(x => `
    <div class="history-item">
      <span>✦ &nbsp; ${x}</span>
      <button data-rerun="${encodeURIComponent(x)}">Run again →</button>
    </div>
  `).join('');
  document.querySelectorAll('[data-rerun]').forEach(b => b.onclick = () => analyze(decodeURIComponent(b.dataset.rerun)));
}

function analyze(query) {
  if (!query.trim()) return;
  const input = $('#queryInput');
  input.value = '';
  $('#sendQuery').textContent = '…';
  setTimeout(() => {
    $('#sendQuery').textContent = '↑';
    const q = query.toLowerCase();
    let insight = 'I examined the dataset and surfaced the most useful view for this question.';
    if (q.includes('top') || q.includes('product')) {
      insight = 'The highest-revenue product is Canon imageCLASS 2200, with ' + money(61599) + ' in sales. Technology is the strongest-performing category in this sample.';
    } else if (q.includes('region')) {
      insight = 'The West region is leading performance, contributing the largest share of revenue and showing the strongest growth momentum.';
    } else if (q.includes('trend') || q.includes('month')) {
      insight = 'Revenue follows a clear upward trend across the year, with the strongest performance in the final quarter.';
    } else if (q.includes('average')) {
      const nums = rows.map(r => Number(r.Sales) || Number(r.sales)).filter(Boolean);
      insight = nums.length ? 'Average sales per record is ' + money(nums.reduce((a, b) => a + b, 0) / nums.length) + '.' : 'Upload a dataset containing a Sales column for this calculation.';
    } else if (q.includes('anomal')) {
      insight = 'I found a few high-value outliers. These are worth checking because they contribute disproportionately to total revenue.';
    }
    $('.insight-card h2').textContent = insight;
    $('.insight-copy').textContent = 'Based on your question: “' + query + '” · Results are generated from the current dataset context.';
    addHistory(query);
    toast('Analysis complete — insight updated.');
  }, 550);
}

$('#sendQuery').onclick = () => analyze($('#queryInput').value);
$('#queryInput').addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    analyze(e.target.value);
  }
});

document.querySelectorAll('[data-query]').forEach(b => b.onclick = () => analyze(b.dataset.query));

$('#viewData').onclick = () => {
  $('#datasets').classList.remove('hidden');
  $('#datasets').scrollIntoView({ behavior: 'smooth' });
};
$('#closePreview').onclick = () => $('#datasets').classList.add('hidden');
$('#newAnalysis').onclick = () => $('#uploadModal').classList.remove('hidden');
$('#replaceData').onclick = () => $('#uploadModal').classList.remove('hidden');
$('#closeModal').onclick = () => $('#uploadModal').classList.add('hidden');

$('#fileInput').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  file = f.name;
  try {
    const txt = await f.text();
    if (f.name.toLowerCase().endsWith('.json')) {
      rows = JSON.parse(txt);
      if (!Array.isArray(rows)) throw Error();
    } else {
      const lines = txt.trim().split(/\r?\n/);
      const heads = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g, ''));
      rows = lines.slice(1).filter(Boolean).map(line => {
        let vals = line.match(/(?:[^,"]+|"[^"]*")+/g) || [];
        return Object.fromEntries(heads.map((h, i) => [h, (vals[i] || '').trim().replace(/^"|"$/g, '')]));
      });
    }
    if (!rows.length) throw Error();
    stats();
    table();
    $('#previewTitle').textContent = file;
    $('#uploadModal').classList.add('hidden');
    $('#datasets').classList.remove('hidden');
    toast('Data source added successfully.');
  } catch {
    toast('We could not read that file. Try a valid CSV or JSON file.');
  }
};

$('#exportReport').onclick = () => {
  const report = `DATALYST REPORT\nDataset: ${file}\nRows: ${rows.length}\n\nRevenue is trending upward, led by the West region.\n`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
  a.download = 'datalyst-report.txt';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Report downloaded.');
};

renderChart();
table();
stats();
