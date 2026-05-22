const fs = require('fs');
const ExcelJS = require('exceljs');
const { BENEFITS } = require('./parser');

function money(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({ header: column.header, key: column.key, width: column.width || 18 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((row) => sheet.addRow(row));
  columns.forEach((column, index) => {
    if (column.numFmt) sheet.getColumn(index + 1).numFmt = column.numFmt;
  });
  return sheet;
}

const issueColumns = [
  { header: 'Benefit', key: 'benefit', width: 14 },
  { header: 'Issue Type', key: 'issueType', width: 20 },
  { header: 'Name', key: 'name', width: 28 },
  { header: 'Payroll Amount', key: 'payrollAmount', width: 18, numFmt: '$#,##0.00' },
  { header: 'Invoice Amount', key: 'invoiceAmount', width: 18, numFmt: '$#,##0.00' },
  { header: 'Difference', key: 'difference', width: 14, numFmt: '$#,##0.00' },
  { header: 'Payroll Row', key: 'payrollRow', width: 12 },
  { header: 'Invoice Rows', key: 'invoiceRows', width: 14 },
  { header: 'Notes', key: 'notes', width: 56 },
];

async function writeInsuranceExcelReport(result, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTUT Admin';
  workbook.created = new Date();

  addSheet(workbook, 'Summary', [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 20 },
  ], [
    { metric: 'Payroll Employees', value: result.summary.payrollEmployees },
    { metric: 'Total Issues', value: result.summary.totalIssues },
    { metric: 'Amount Mismatches', value: result.summary.amountMismatches },
    { metric: 'Missing in Invoice', value: result.summary.missingInInvoice },
    { metric: 'Missing in Payroll', value: result.summary.missingInPayroll },
    ...result.summary.summaryByBenefit.map((row) => ({ metric: `${row.label} Issues`, value: row.issues })),
  ]);

  addSheet(workbook, 'All Issues', issueColumns, result.issues);
  BENEFITS.forEach((benefit) => {
    addSheet(workbook, `${benefit.label} Issues`, issueColumns, result.issuesByBenefit[benefit.key] || []);
  });

  addSheet(workbook, 'Run Info', [
    { header: 'Field', key: 'field', width: 26 },
    { header: 'Value', key: 'value', width: 60 },
  ], [
    { field: 'Generated At', value: result.metadata.generatedAt },
    { field: 'Rule Version', value: result.metadata.ruleVersion },
    { field: 'Payroll File', value: result.metadata.payrollFileName },
    { field: 'Dental File', value: result.metadata.dentalFileName },
    { field: 'Vision File', value: result.metadata.visionFileName },
    { field: 'LTD Life SUPP File', value: result.metadata.ltdLifeSuppFileName },
  ]);

  await workbook.xlsx.writeFile(outputPath);
}

function issueClass(issueType) {
  if (issueType === 'Amount Mismatch') return 'danger';
  if (issueType === 'Missing in Invoice') return 'warn';
  return 'info';
}

function renderIssueRows(rows) {
  if (!rows.length) return '<tr><td colspan="7" class="empty">No issues found.</td></tr>';
  return rows.map((issue) => `
    <tr>
      <td><span class="pill ${issueClass(issue.issueType)}">${escapeHtml(issue.issueType)}</span></td>
      <td>${escapeHtml(issue.benefit)}</td>
      <td>${escapeHtml(issue.name)}</td>
      <td class="num">${formatMoney(issue.payrollAmount)}</td>
      <td class="num">${formatMoney(issue.invoiceAmount)}</td>
      <td class="num">${formatMoney(issue.difference)}</td>
      <td>${escapeHtml(issue.notes)}</td>
    </tr>
  `).join('');
}

function writeInsuranceHtmlReport(result, outputPath) {
  const generated = new Date(result.metadata.generatedAt).toLocaleString('en-US');
  const issueTone = result.summary.totalIssues ? 'danger-text' : 'ok-text';
  const issueTitle = result.summary.totalIssues ? 'Review required' : 'Ready to approve';
  const benefitCards = result.summary.summaryByBenefit.map((row) => `
    <div class="stat">
      <span>${escapeHtml(row.label)}</span>
      <strong>${row.issues}</strong>
      <small>${row.amountMismatches} mismatch / ${row.missingInInvoice} invoice missing / ${row.missingInPayroll} payroll missing</small>
    </div>
  `).join('');
  const sections = BENEFITS.map((benefit) => `
    <section>
      <div class="section-head">
        <div>
          <h2>${escapeHtml(benefit.label)} Issues</h2>
          <p>${(result.issuesByBenefit[benefit.key] || []).length} issue(s)</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Issue</th><th>Benefit</th><th>Name</th><th class="num">Payroll</th><th class="num">Invoice</th><th class="num">Difference</th><th>Notes</th></tr></thead>
          <tbody>${renderIssueRows(result.issuesByBenefit[benefit.key] || [])}</tbody>
        </table>
      </div>
    </section>
  `).join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Insurance Breakout Report</title>
  <style>
    :root { --bg:#f4f7fb; --panel:#fff; --ink:#111827; --muted:#64748b; --line:#dbe3ee; --danger:#b91c1c; --warn:#b45309; --info:#1d4ed8; --ok:#047857; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; }
    .wrap { max-width:1180px; margin:0 auto; padding:32px 22px 48px; }
    .hero { background:linear-gradient(135deg,#111827 0%,#7c3aed 54%,#0891b2 100%); color:white; padding:28px; border-radius:18px; box-shadow:0 22px 60px rgba(15,23,42,.22); }
    .eyebrow { margin:0 0 8px; color:#ddd6fe; font-size:13px; font-weight:800; text-transform:uppercase; }
    h1 { margin:0; font-size:clamp(30px,4vw,46px); letter-spacing:0; }
    .hero-grid { display:grid; grid-template-columns:1fr auto; gap:22px; align-items:end; }
    .verdict { min-width:230px; border:1px solid rgba(255,255,255,.28); background:rgba(255,255,255,.12); border-radius:14px; padding:18px; }
    .verdict strong { display:block; font-size:24px; }
    .meta { margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; color:#e0f2fe; font-size:13px; }
    .meta span { border:1px solid rgba(255,255,255,.25); border-radius:999px; padding:6px 10px; }
    .stats { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:14px; margin-top:18px; }
    .stat, section { background:var(--panel); border:1px solid var(--line); border-radius:14px; box-shadow:0 12px 32px rgba(15,23,42,.07); }
    .stat { padding:16px; }
    .stat span { display:block; color:var(--muted); font-size:12px; font-weight:800; text-transform:uppercase; }
    .stat strong { display:block; margin-top:7px; font-size:28px; }
    .stat small { display:block; margin-top:5px; color:var(--muted); font-size:12px; }
    section { margin-top:18px; overflow:hidden; }
    .section-head { padding:18px 20px; border-bottom:1px solid var(--line); }
    .section-head h2 { margin:0; font-size:18px; }
    .section-head p { margin:4px 0 0; color:var(--muted); font-size:13px; }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; min-width:860px; }
    th,td { padding:12px 14px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; font-size:13px; }
    th { background:#f8fafc; color:#475569; font-size:11px; text-transform:uppercase; }
    .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .pill { display:inline-flex; border-radius:999px; padding:4px 9px; font-weight:800; font-size:12px; white-space:nowrap; }
    .danger { color:var(--danger); background:#fee2e2; } .warn { color:var(--warn); background:#fef3c7; } .info { color:var(--info); background:#dbeafe; }
    .danger-text { color:#fecaca; } .ok-text { color:#bbf7d0; }
    .empty { text-align:center; color:var(--muted); padding:24px; }
    @media (max-width:860px) { .wrap{padding:18px 12px 34px;} .hero-grid{grid-template-columns:1fr;} .stats{grid-template-columns:repeat(2,minmax(0,1fr));} }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">RTUT Admin Report</p>
          <h1>Insurance Breakout</h1>
          <div class="meta">
            <span>Generated ${escapeHtml(generated)}</span>
            <span>Rule ${escapeHtml(result.metadata.ruleVersion)}</span>
            <span>${escapeHtml(result.metadata.payrollFileName)}</span>
          </div>
        </div>
        <div class="verdict">
          <span>Current status</span>
          <strong class="${issueTone}">${issueTitle}</strong>
          <small>${result.summary.totalIssues} issue${result.summary.totalIssues === 1 ? '' : 's'} detected</small>
        </div>
      </div>
    </header>
    <div class="stats">${benefitCards}</div>
    <section>
      <div class="section-head"><h2>All Important Issues</h2><p>Amount mismatches and missing employee records across all insurance sources.</p></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Issue</th><th>Benefit</th><th>Name</th><th class="num">Payroll</th><th class="num">Invoice</th><th class="num">Difference</th><th>Notes</th></tr></thead>
          <tbody>${renderIssueRows(result.issues)}</tbody>
        </table>
      </div>
    </section>
    ${sections}
  </main>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

module.exports = { writeInsuranceExcelReport, writeInsuranceHtmlReport };
