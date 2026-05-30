const fs = require('fs');
const ExcelJS = require('exceljs');

function money(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const STATUS_COLORS = {
  Matched: { className: 'status-ok', fill: 'FFE7F8EF' },
  'No Commission': { className: 'status-slate', fill: 'FFF1F5F9' },
  'Duplicate Roster Name': { className: 'status-purple', fill: 'FFF3E8FF' },
  'Report Flagged Departed': { className: 'status-teal', fill: 'FFCCFBF1' },
  'Report Flagged - Roster Active': { className: 'status-amber', fill: 'FFFEF3C7' },
  'Terminated in Roster With Commission': { className: 'status-red', fill: 'FFFFE4E6' },
  'Terminated in Roster': { className: 'status-orange', fill: 'FFFFEDD5' },
  'Missing in Roster': { className: 'status-blue', fill: 'FFDBEAFE' },
  'Ambiguous Roster Match': { className: 'status-purple', fill: 'FFF3E8FF' },
};

function statusColor(status) {
  return STATUS_COLORS[status] || { className: 'status-slate', fill: 'FFF1F5F9' };
}

function addSheet(workbook, name, columns, rows) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width || 18,
  }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  rows.forEach((row) => sheet.addRow(row));

  if (columns.some((column) => column.key === 'status')) {
    sheet.eachRow((sheetRow, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = rows[rowNumber - 2];
      if (!rowData?.status || rowData.status === 'Matched') return;
      const fill = statusColor(rowData.status).fill;
      sheetRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      });
    });
  }

  if (columns.some((column) => column.key === 'error')) {
    sheet.eachRow((sheetRow, rowNumber) => {
      if (rowNumber === 1) return;
      const rowData = rows[rowNumber - 2];
      if (!rowData?.error) return;
      sheetRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
      });
    });
  }

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
      cell.alignment = { vertical: 'top', wrapText: true };
    });
  });

  columns.forEach((column, index) => {
    if (column.numFmt) sheet.getColumn(index + 1).numFmt = column.numFmt;
  });

  if (columns.length <= 26) {
    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };
  }

  return sheet;
}

const mappingColumns = [
  { header: 'Status', key: 'status', width: 28 },
  { header: 'Recommended Action', key: 'action', width: 56 },
  { header: 'Report Name', key: 'reportName', width: 26 },
  { header: 'Report Raw Name', key: 'reportRawName', width: 26 },
  { header: 'Report Marked Departed', key: 'reportMarkedDeparted', width: 20 },
  { header: 'Report Location', key: 'reportLocation', width: 18 },
  { header: 'Report Commission', key: 'reportCommission', width: 18, numFmt: '$#,##0.00' },
  { header: 'Report Row', key: 'reportRow', width: 12 },
  { header: 'Roster Name', key: 'rosterName', width: 26 },
  { header: 'Roster Status', key: 'rosterStatus', width: 16 },
  { header: 'Roster Location Code', key: 'rosterLocationCode', width: 18 },
  { header: 'Roster Department', key: 'rosterDepartment', width: 26 },
  { header: 'Roster Basis of Pay', key: 'rosterBasisOfPay', width: 18 },
  { header: 'Roster Reports To', key: 'rosterReportsTo', width: 24 },
  { header: 'Roster Row', key: 'rosterRow', width: 12 },
  { header: 'Match Score', key: 'matchScore', width: 12 },
  { header: 'Match Candidates', key: 'matchCandidates', width: 70 },
  { header: 'Notes', key: 'notes', width: 70 },
];

const rosterCommissionColumns = [
  { header: 'Position Status', key: 'positionStatus', width: 16 },
  { header: 'Payroll Name', key: 'payrollName', width: 28 },
  { header: 'Location Code', key: 'locationCode', width: 14 },
  { header: 'Home Department Description', key: 'homeDepartmentDescription', width: 30 },
  { header: 'Basis of Pay', key: 'basisOfPay', width: 16 },
  { header: 'Reports To Name', key: 'reportsToName', width: 26 },
  { header: 'Commission', key: 'commission', width: 16, numFmt: '$#,##0.00' },
  { header: 'Error', key: 'error', width: 34 },
  { header: 'Recommended Action', key: 'recommendedAction', width: 56 },
  { header: 'Report Name', key: 'reportName', width: 26 },
  { header: 'Report Marked Departed', key: 'reportMarkedDeparted', width: 20 },
  { header: 'Report Rows', key: 'reportRows', width: 14 },
  { header: 'Roster Row', key: 'rosterRow', width: 12 },
  { header: 'Match Score', key: 'matchScore', width: 12 },
];

const reviewColumns = [
  { header: 'Review Type', key: 'reviewType', width: 28 },
  { header: 'Status', key: 'status', width: 28 },
  { header: 'Reason', key: 'reason', width: 70 },
  { header: 'Report Name', key: 'reportName', width: 26 },
  { header: 'Report Raw Name', key: 'reportRawName', width: 26 },
  { header: 'Report Marked Departed', key: 'reportMarkedDeparted', width: 20 },
  { header: 'Report Location', key: 'reportLocation', width: 18 },
  { header: 'Report Commission', key: 'reportCommission', width: 18, numFmt: '$#,##0.00' },
  { header: 'Report Row', key: 'reportRow', width: 14 },
  { header: 'Roster Name', key: 'rosterName', width: 28 },
  { header: 'Roster Status', key: 'rosterStatus', width: 16 },
  { header: 'Roster Location Code', key: 'rosterLocationCode', width: 18 },
  { header: 'Roster Department', key: 'rosterDepartment', width: 28 },
  { header: 'Roster Reports To', key: 'rosterReportsTo', width: 24 },
  { header: 'Roster Row', key: 'rosterRow', width: 12 },
  { header: 'Match Candidates', key: 'matchCandidates', width: 70 },
  { header: 'Notes', key: 'notes', width: 70 },
];

async function writeCommissionRosterReport(result, outputPath) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RTUT Admin';
  workbook.created = new Date();

  addSheet(workbook, 'Roster Commission Output', rosterCommissionColumns, result.rosterCommissionRows);
  addSheet(workbook, 'Review Errors Removed', reviewColumns, result.reviewRows);

  addSheet(workbook, 'Summary', [
    { header: 'Metric', key: 'metric', width: 34 },
    { header: 'Value', key: 'value', width: 24 },
  ], [
    { metric: 'Roster Employees', value: result.summary.rosterEmployees },
    { metric: 'Quarterly Report Rows', value: result.summary.quarterlyRows },
    { metric: 'Final Roster Commission Rows', value: result.summary.finalRosterCommissionRows },
    { metric: 'Review Rows', value: result.summary.reviewRows },
    { metric: 'Removed Rows', value: result.summary.removedNoCommission },
    { metric: 'Matched', value: result.summary.matched },
    { metric: 'Report Marked Departed', value: result.summary.reportMarkedDeparted },
    { metric: 'Missing in Roster', value: result.summary.missingInRoster },
    { metric: 'Ambiguous Matches', value: result.summary.ambiguous },
    { metric: 'Terminated / Flagged Issues', value: result.summary.terminatedIssues },
    { metric: 'Duplicate Roster Name Rows', value: result.summary.duplicateRosterNames },
    { metric: 'Active Service Roster Only', value: result.summary.activeServiceRosterOnly },
    { metric: 'Issues', value: result.summary.issues },
    { metric: 'Total Report Commission', value: money(result.summary.totalReportCommission) },
    { metric: 'Total Mapped Commission', value: money(result.summary.totalMappedCommission) },
    { metric: 'Total Review Commission', value: money(result.summary.totalReviewCommission) },
    { metric: 'Total Reconciled Commission', value: money(result.summary.totalReconciledCommission) },
  ]);

  addSheet(workbook, 'Important Issues', mappingColumns, result.issues);
  addSheet(workbook, 'Report Mapping', mappingColumns, result.mapping);

  addSheet(workbook, 'Roster Only Review', [
    { header: 'Payroll Name', key: 'payrollName', width: 26 },
    { header: 'Roster Display Name', key: 'rosterDisplayName', width: 26 },
    { header: 'Position Status', key: 'positionStatus', width: 16 },
    { header: 'Location Code', key: 'locationCode', width: 14 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Department', key: 'department', width: 28 },
    { header: 'Basis of Pay', key: 'basisOfPay', width: 16 },
    { header: 'Reports To', key: 'reportsToName', width: 24 },
    { header: 'Roster Row', key: 'sourceRow', width: 12 },
    { header: 'Note', key: 'note', width: 70 },
  ], result.activeServiceRosterOnly);

  addSheet(workbook, 'Quarterly Rows', [
    { header: 'Report Name', key: 'displayName', width: 26 },
    { header: 'Raw Name', key: 'rawName', width: 26 },
    { header: 'Marked Departed', key: 'reportFlagged', width: 18 },
    { header: 'Location', key: 'location', width: 18 },
    { header: 'Commission', key: 'commission', width: 14, numFmt: '$#,##0.00' },
    { header: 'Source Row', key: 'sourceRow', width: 12 },
  ], result.reportRows);

  addSheet(workbook, 'Roster Data', [
    { header: 'Payroll Name', key: 'payrollName', width: 26 },
    { header: 'Position Status', key: 'positionStatus', width: 16 },
    { header: 'Location Code', key: 'locationCode', width: 14 },
    { header: 'Department', key: 'department', width: 28 },
    { header: 'Basis of Pay', key: 'basisOfPay', width: 16 },
    { header: 'Reports To', key: 'reportsToName', width: 24 },
    { header: 'Duplicate Name', key: 'duplicateRosterName', width: 16 },
    { header: 'Source Row', key: 'sourceRow', width: 12 },
  ], result.rosterRows);

  addSheet(workbook, 'Exceptions', [
    { header: 'Type', key: 'type', width: 26 },
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Source', key: 'source', width: 22 },
    { header: 'Details', key: 'details', width: 68 },
    { header: 'Action', key: 'action', width: 68 },
  ], result.exceptions);

  addSheet(workbook, 'Run Info', [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 64 },
  ], [
    { field: 'Generated At', value: result.metadata.generatedAt },
    { field: 'Rule Version', value: result.metadata.ruleVersion },
    { field: 'Roster File', value: result.metadata.rosterFileName },
    { field: 'Quarterly Report File', value: result.metadata.quarterlyReportFileName },
    { field: 'Roster Sheet', value: result.metadata.rosterSheetName },
    { field: 'Quarterly Report Sheet', value: result.metadata.quarterlyReportSheetName },
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
  return statusColor(status).className;
}

function renderRows(rows) {
  if (!rows.length) return '<tr><td colspan="8" class="empty">No issues found.</td></tr>';
  return rows.map((row) => `
    <tr>
      <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.reportName)}</td>
      <td>${escapeHtml(row.rosterName)}</td>
      <td>${escapeHtml(row.reportMarkedDeparted)}</td>
      <td>${escapeHtml(row.reportLocation)}</td>
      <td class="num">${formatMoney(row.reportCommission)}</td>
      <td>${escapeHtml(row.action)}</td>
      <td>${escapeHtml(row.notes || row.matchCandidates)}</td>
    </tr>
  `).join('');
}

function renderRosterCommissionRows(rows) {
  if (!rows.length) return '<tr><td colspan="9" class="empty">No commission rows ready for roster output.</td></tr>';
  return rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.positionStatus)}</td>
      <td>${escapeHtml(row.payrollName)}</td>
      <td>${escapeHtml(row.locationCode)}</td>
      <td>${escapeHtml(row.homeDepartmentDescription)}</td>
      <td>${escapeHtml(row.basisOfPay)}</td>
      <td>${escapeHtml(row.reportsToName)}</td>
      <td class="num">${formatMoney(row.commission)}</td>
      <td>${row.error ? `<span class="pill status-red">${escapeHtml(row.error)}</span>` : ''}</td>
      <td>${escapeHtml(row.recommendedAction)}</td>
    </tr>
  `).join('');
}

function renderReviewRows(rows) {
  if (!rows.length) return '<tr><td colspan="8" class="empty">No review rows found.</td></tr>';
  return rows.slice(0, 250).map((row) => `
    <tr>
      <td>${escapeHtml(row.reviewType)}</td>
      <td><span class="pill ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.reason)}</td>
      <td>${escapeHtml(row.reportName)}</td>
      <td class="num">${formatMoney(row.reportCommission)}</td>
      <td>${escapeHtml(row.rosterName)}</td>
      <td>${escapeHtml(row.rosterStatus)}</td>
      <td>${escapeHtml(row.notes || row.matchCandidates)}</td>
    </tr>
  `).join('');
}

function renderRosterOnlyRows(rows) {
  if (!rows.length) return '<tr><td colspan="6" class="empty">No active service roster-only rows found.</td></tr>';
  return rows.slice(0, 80).map((row) => `
    <tr>
      <td>${escapeHtml(row.payrollName)}</td>
      <td>${escapeHtml(row.positionStatus)}</td>
      <td>${escapeHtml(row.location || row.locationCode)}</td>
      <td>${escapeHtml(row.department)}</td>
      <td>${escapeHtml(row.reportsToName)}</td>
      <td>${escapeHtml(row.note)}</td>
    </tr>
  `).join('');
}

function writeCommissionRosterHtmlReport(result, outputPath) {
  const generated = new Date(result.metadata.generatedAt).toLocaleString('en-US');
  const issueTone = result.summary.issues > 0 ? 'danger' : 'ok';
  const issueTitle = result.summary.issues > 0 ? 'Review required' : 'Ready to approve';

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Commission Roster Mapping Report</title>
  <style>
    :root {
      --bg: #f4f7fb; --panel: #ffffff; --ink: #111827; --muted: #64748b; --line: #dbe3ee;
      --blue: #2563eb; --ok: #047857; --ok-bg: #d1fae5; --warn: #b45309; --warn-bg: #fef3c7;
      --danger: #b91c1c; --danger-bg: #fee2e2; --red:#be123c; --red-bg:#ffe4e6; --amber:#b45309; --amber-bg:#fef3c7;
      --blue:#1d4ed8; --blue-bg:#dbeafe; --purple:#7e22ce; --purple-bg:#f3e8ff; --orange:#c2410c; --orange-bg:#ffedd5;
      --teal:#0f766e; --teal-bg:#ccfbf1; --slate:#475569; --slate-bg:#f1f5f9;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; line-height: 1.45; }
    .wrap { max-width: 1240px; margin: 0 auto; padding: 32px 22px 48px; }
    .hero { background: linear-gradient(135deg, #0f172a 0%, #0f766e 54%, #1d4ed8 100%); color: white; padding: 28px; border-radius: 18px; box-shadow: 0 22px 60px rgba(15, 23, 42, 0.22); }
    .hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 22px; align-items: end; }
    .eyebrow { margin: 0 0 8px; color: #bfdbfe; font-size: 13px; font-weight: 700; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(30px, 4vw, 46px); letter-spacing: 0; }
    .meta { margin-top: 18px; display: flex; flex-wrap: wrap; gap: 10px; color: #e0f2fe; font-size: 13px; }
    .meta span { border: 1px solid rgba(255,255,255,0.25); border-radius: 999px; padding: 6px 10px; }
    .verdict { min-width: 240px; border: 1px solid rgba(255,255,255,0.28); background: rgba(255,255,255,0.12); border-radius: 14px; padding: 18px; }
    .verdict strong { display: block; font-size: 24px; }
    .grid { display: grid; gap: 14px; }
    .stats { grid-template-columns: repeat(5, minmax(0, 1fr)); margin-top: 18px; }
    .stat, section { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.07); }
    .stat { padding: 16px; }
    .stat span { display: block; color: var(--muted); font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .stat strong { display: block; margin-top: 7px; font-size: 24px; }
    section { margin-top: 18px; overflow: hidden; }
    .section-head { padding: 18px 20px; border-bottom: 1px solid var(--line); }
    .section-head h2 { margin: 0; font-size: 18px; }
    .section-head p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 1040px; }
    th, td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; font-size: 13px; }
    th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .pill { display: inline-flex; border-radius: 999px; padding: 4px 9px; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .status-ok { color: var(--ok); background: var(--ok-bg); }
    .status-red { color: var(--red); background: var(--red-bg); }
    .status-amber { color: var(--amber); background: var(--amber-bg); }
    .status-blue { color: var(--blue); background: var(--blue-bg); }
    .status-purple { color: var(--purple); background: var(--purple-bg); }
    .status-orange { color: var(--orange); background: var(--orange-bg); }
    .status-teal { color: var(--teal); background: var(--teal-bg); }
    .status-slate { color: var(--slate); background: var(--slate-bg); }
    .empty { text-align: center; color: var(--muted); padding: 24px; }
    .danger { color: var(--danger); }
    .ok { color: var(--ok); }
    @media (max-width: 860px) { .wrap { padding: 18px 12px 34px; } .hero-grid { grid-template-columns: 1fr; } .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="hero">
      <div class="hero-grid">
        <div>
          <p class="eyebrow">RTUT HR Tools</p>
          <h1>Commission Roster Mapping</h1>
          <div class="meta">
            <span>Generated ${escapeHtml(generated)}</span>
            <span>Rule ${escapeHtml(result.metadata.ruleVersion)}</span>
            <span>Roster sheet ${escapeHtml(result.metadata.rosterSheetName)}</span>
            <span>Report sheet ${escapeHtml(result.metadata.quarterlyReportSheetName)}</span>
          </div>
        </div>
        <div class="verdict">
          <span>Current status</span>
          <strong class="${issueTone}">${issueTitle}</strong>
          <small>${result.summary.issues} issue${result.summary.issues === 1 ? '' : 's'} detected</small>
        </div>
      </div>
    </header>

    <div class="grid stats">
      <div class="stat"><span>Matched</span><strong class="ok">${result.summary.matched}</strong></div>
      <div class="stat"><span>Final Rows</span><strong class="ok">${result.summary.finalRosterCommissionRows}</strong></div>
      <div class="stat"><span>Review Rows</span><strong class="${result.summary.reviewRows ? 'danger' : ''}">${result.summary.reviewRows}</strong></div>
      <div class="stat"><span>Missing Roster</span><strong class="${result.summary.missingInRoster ? 'danger' : ''}">${result.summary.missingInRoster}</strong></div>
      <div class="stat"><span>Total Commission</span><strong>${formatMoney(result.summary.totalReportCommission)}</strong></div>
      <div class="stat"><span>Reconciled</span><strong>${formatMoney(result.summary.totalReconciledCommission)}</strong></div>
    </div>

    <section>
      <div class="section-head">
        <h2>Roster Commission Output</h2>
        <p>Roster-format rows that should receive commission. Rows with errors are also listed in the review sheet.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Position Status</th><th>Payroll Name</th><th>Location Code</th><th>Home Department</th><th>Basis of Pay</th><th>Reports To</th><th class="num">Commission</th><th>Error</th><th>Recommended Action</th></tr></thead>
          <tbody>${renderRosterCommissionRows(result.rosterCommissionRows)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Review Errors And Removed Rows</h2>
        <p>Every error, attention item, and employee removed from the final roster output. Excel contains the complete list.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Review Type</th><th>Status</th><th>Reason</th><th>Report Name</th><th class="num">Commission</th><th>Roster Name</th><th>Roster Status</th><th>Notes</th></tr></thead>
          <tbody>${renderReviewRows(result.reviewRows)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <div class="section-head">
        <h2>Quarterly Report Mapping Detail</h2>
        <p>Diagnostic mapping from report names to roster rows.</p>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Status</th><th>Report Name</th><th>Roster Name</th><th>Marked</th><th>Location</th><th class="num">Commission</th><th>Recommended Action</th><th>Notes</th></tr></thead>
          <tbody>${renderRows(result.mapping)}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
}

module.exports = { writeCommissionRosterReport, writeCommissionRosterHtmlReport };
