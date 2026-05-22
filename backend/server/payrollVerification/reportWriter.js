const ExcelJS = require('exceljs');

function money(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 18,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFF6FF' },
  };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = {
    from: 'A1',
    to: `${String.fromCharCode(64 + columns.length)}1`,
  };

  rows.forEach((row) => sheet.addRow(row));

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });
  });

  columns.forEach((column, index) => {
    if (column.numFmt) {
      sheet.getColumn(index + 1).numFmt = column.numFmt;
    }
  });

  return sheet;
}

async function writeCommissionReport(result, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTUT Admin';
  workbook.created = new Date();

  addSheet(workbook, 'Summary', [
    { header: 'Metric', key: 'metric', width: 28 },
    { header: 'Value', key: 'value', width: 24 },
  ], [
    { metric: 'Total HR Employees', value: result.summary.totalHrEmployees },
    { metric: 'Payroll COM Employees', value: result.summary.payrollComEmployees },
    { metric: 'Matched', value: result.summary.matched },
    { metric: 'Mismatched', value: result.summary.mismatched },
    { metric: 'Missing in Payroll', value: result.summary.missingInPayroll },
    { metric: 'Missing in HR', value: result.summary.missingInHr },
    { metric: 'Exceptions', value: result.summary.exceptions },
    { metric: 'Total HR Commission', value: money(result.summary.totalHrCommission) },
    { metric: 'Total Payroll Commission', value: money(result.summary.totalPayrollCommission) },
    { metric: 'Total Difference', value: money(result.summary.totalDifference) },
  ]);

  addSheet(workbook, 'Comparison', [
    { header: 'Name', key: 'name', width: 26 },
    { header: 'HR Commission', key: 'hrCommission', width: 16, numFmt: '$#,##0.00' },
    { header: 'Payroll COM Total', key: 'payrollCommission', width: 18, numFmt: '$#,##0.00' },
    { header: 'Difference', key: 'difference', width: 14, numFmt: '$#,##0.00' },
    { header: 'Status', key: 'status', width: 18 },
    { header: 'Payroll Employee Name', key: 'payrollEmployeeName', width: 26 },
    { header: 'Associate ID', key: 'associateId', width: 18 },
    { header: 'File #', key: 'fileNumber', width: 12 },
    { header: 'Department', key: 'department', width: 14 },
    { header: 'Payroll Rows', key: 'payrollRows', width: 14 },
    { header: 'Notes', key: 'notes', width: 42 },
  ], result.comparison);

  addSheet(workbook, 'Payroll COM Detail', [
    { header: 'Employee Name', key: 'name', width: 26 },
    { header: 'Associate ID', key: 'associateId', width: 18 },
    { header: 'File #', key: 'fileNumber', width: 12 },
    { header: 'Department', key: 'department', width: 14 },
    { header: 'Code', key: 'code', width: 10 },
    { header: 'Amount', key: 'amount', width: 14, numFmt: '$#,##0.00' },
    { header: 'Gross', key: 'gross', width: 14, numFmt: '$#,##0.00' },
    { header: 'Source Row', key: 'sourceRow', width: 12 },
    { header: 'Source Column', key: 'sourceColumn', width: 18 },
  ], result.payrollComDetails);

  addSheet(workbook, 'Exceptions', [
    { header: 'Type', key: 'type', width: 22 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Details', key: 'details', width: 64 },
  ], result.exceptions);

  addSheet(workbook, 'Run Info', [
    { header: 'Field', key: 'field', width: 24 },
    { header: 'Value', key: 'value', width: 52 },
  ], [
    { field: 'Generated At', value: result.metadata.generatedAt },
    { field: 'Rule Version', value: result.metadata.ruleVersion },
    { field: 'HR File', value: result.metadata.hrFileName },
    { field: 'Payroll File', value: result.metadata.payrollFileName },
    { field: 'Payroll Sheet', value: result.metadata.payrollSheetName },
    { field: 'Company Code', value: result.payrollInfo.companyCode || '' },
    { field: 'Company Name', value: result.payrollInfo.companyName || '' },
    { field: 'Week', value: result.payrollInfo.week || '' },
    { field: 'Pay Date', value: result.payrollInfo.payDate || '' },
    { field: 'Period End Date', value: result.payrollInfo.periodEndDate || '' },
    { field: 'Run Time', value: result.payrollInfo.runTime || '' },
    { field: 'Service Center', value: result.payrollInfo.serviceCenter || '' },
  ]);

  await workbook.xlsx.writeFile(outputPath);
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

function formatMoney(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function statusClass(status) {
  if (status === 'Match') return 'status-ok';
  if (status === 'Mismatch') return 'status-danger';
  return 'status-warn';
}

function renderIssueRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="7" class="empty">No issues found.</td></tr>';
  }

  return rows.map((row) => `
    <tr>
      <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.name || row.payrollEmployeeName)}</td>
      <td class="num">${formatMoney(row.hrCommission)}</td>
      <td class="num">${formatMoney(row.payrollCommission)}</td>
      <td class="num">${formatMoney(row.difference)}</td>
      <td>${escapeHtml(row.payrollRows)}</td>
      <td>${escapeHtml(row.notes)}</td>
    </tr>
  `).join('');
}

function renderDetailRows(rows) {
  return rows.map((row) => `
    <tr>
      <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.name || row.payrollEmployeeName)}</td>
      <td class="num">${formatMoney(row.hrCommission)}</td>
      <td class="num">${formatMoney(row.payrollCommission)}</td>
      <td class="num">${formatMoney(row.difference)}</td>
      <td>${escapeHtml(row.associateId)}</td>
      <td>${escapeHtml(row.fileNumber)}</td>
      <td>${escapeHtml(row.department)}</td>
    </tr>
  `).join('');
}

function renderExceptionRows(rows) {
  if (!rows.length) {
    return '<tr><td colspan="3" class="empty">No exceptions found.</td></tr>';
  }

  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.type)}</td>
      <td>${escapeHtml(row.name)}</td>
      <td>${escapeHtml(row.details)}</td>
    </tr>
  `).join('');
}

function writeCommissionHtmlReport(result, outputPath) {
  const fs = require('fs');
  const issues = result.comparison.filter((row) => row.status !== 'Match');
  const generated = new Date(result.metadata.generatedAt).toLocaleString('en-US');
  const summary = result.summary;
  const issueTone = summary.exceptions > 0 ? 'danger' : 'ok';
  const issueTitle = summary.exceptions > 0 ? 'Review required' : 'Ready to approve';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Commission Verification Report</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f7fb;
      --panel: #ffffff;
      --ink: #111827;
      --muted: #64748b;
      --line: #dbe3ee;
      --blue: #2563eb;
      --ok: #047857;
      --ok-bg: #d1fae5;
      --warn: #b45309;
      --warn-bg: #fef3c7;
      --danger: #b91c1c;
      --danger-bg: #fee2e2;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      line-height: 1.45;
    }
    .wrap { max-width: 1180px; margin: 0 auto; padding: 32px 22px 48px; }
    .hero {
      background: linear-gradient(135deg, #0f172a 0%, #1d4ed8 58%, #0f766e 100%);
      color: white;
      padding: 28px;
      border-radius: 18px;
      box-shadow: 0 22px 60px rgba(15, 23, 42, 0.22);
    }
    .eyebrow { margin: 0 0 8px; color: #bfdbfe; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(30px, 4vw, 46px); letter-spacing: 0; }
    .hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: end; }
    .verdict {
      min-width: 230px;
      border: 1px solid rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.12);
      border-radius: 14px;
      padding: 18px;
    }
    .verdict strong { display: block; font-size: 24px; }
    .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; color: #e0f2fe; font-size: 13px; }
    .meta span { border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 6px 10px; }
    .grid { display: grid; gap: 14px; }
    .stats { grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 18px; }
    .stat, section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07);
    }
    .stat { padding: 16px; }
    .stat span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .stat strong { display: block; margin-top: 7px; font-size: 24px; }
    section { margin-top: 18px; overflow: hidden; }
    .section-head { padding: 18px 20px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .section-head h2 { margin: 0; font-size: 18px; }
    .section-head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 850px; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0; }
    tr:hover td { background: #f8fafc; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .status-ok { color: var(--ok); background: var(--ok-bg); }
    .status-warn { color: var(--warn); background: var(--warn-bg); }
    .status-danger { color: var(--danger); background: var(--danger-bg); }
    .empty { text-align: center; color: var(--muted); padding: 24px; }
    .danger { color: var(--danger); }
    .ok { color: var(--ok); }
    @media (max-width: 860px) {
      .wrap { padding: 18px 12px 34px; }
      .hero-grid { grid-template-columns: 1fr; }
      .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .hero { padding: 22px; border-radius: 14px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">RTUT Admin Report</p>
          <h1>Commission Verification</h1>
          <div class="meta">
            <span>Generated ${escapeHtml(generated)}</span>
            <span>Rule ${escapeHtml(result.metadata.ruleVersion)}</span>
            <span>Payroll Sheet ${escapeHtml(result.metadata.payrollSheetName)}</span>
          </div>
        </div>
        <div class="verdict">
          <span>Current status</span>
          <strong class="${issueTone}">${issueTitle}</strong>
          <small>${summary.exceptions} issue${summary.exceptions === 1 ? '' : 's'} detected</small>
        </div>
      </div>
    </header>

    <div class="grid stats">
      <div class="stat"><span>Matched</span><strong class="ok">${summary.matched}</strong></div>
      <div class="stat"><span>Mismatched</span><strong class="${summary.mismatched ? 'danger' : ''}">${summary.mismatched}</strong></div>
      <div class="stat"><span>Missing Payroll</span><strong>${summary.missingInPayroll}</strong></div>
      <div class="stat"><span>Missing HR</span><strong>${summary.missingInHr}</strong></div>
      <div class="stat"><span>Total Difference</span><strong class="${summary.totalDifference ? 'danger' : 'ok'}">${formatMoney(summary.totalDifference)}</strong></div>
    </div>

    <section>
      <div class="section-head">
        <div>
          <h2>Important Issues</h2>
          <p>Mismatches, missing employees, and ambiguous records that should be reviewed before approval.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Status</th><th>Name</th><th class="num">HR Commission</th><th class="num">Payroll COM</th><th class="num">Difference</th><th>Payroll Rows</th><th>Notes</th></tr>
          </thead>
          <tbody>${renderIssueRows(issues)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <div>
          <h2>Full Comparison</h2>
          <p>Every HR reference employee and every payroll-only COM record included in the reconciliation.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Status</th><th>Name</th><th class="num">HR Commission</th><th class="num">Payroll COM</th><th class="num">Difference</th><th>Associate ID</th><th>File #</th><th>Department</th></tr>
          </thead>
          <tbody>${renderDetailRows(result.comparison)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <div>
          <h2>Exceptions</h2>
          <p>Supplemental warnings produced by the parser and matcher.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Type</th><th>Name</th><th>Details</th></tr></thead>
          <tbody>${renderExceptionRows(result.exceptions)}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

module.exports = { writeCommissionReport, writeCommissionHtmlReport };
