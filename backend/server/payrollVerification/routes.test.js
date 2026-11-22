const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { createPayrollVerificationRouter } = require('./routes');

function workbook(rows, name) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), name);
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
}

test('multipart payroll upload produces matching totals and downloadable XLSX/HTML on Express 5', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'rtut-payroll-test-'));
  const app = express();
  const logs = [];
  app.use('/api/payroll-verification', createPayrollVerificationRouter({
    upload: multer({ dest: directory }), uploadDirectory: directory,
    logOperationToDatabase: async log => logs.push(log),
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const form = new FormData();
    form.append('commissionFile', new Blob([workbook([
      { Name: 'Example, One', Commission: 125.25 },
      { Name: 'Example, Two', Commission: 50 },
    ], 'HR')]), 'hr.xlsx');
    form.append('payrollFile', new Blob([workbook([
      { Personnel: 'Example, One\nAssociate ID: TEST1\nFile #: 1', Earnings: 'COM 125.25' },
      { Personnel: 'Example, Two\nAssociate ID: TEST2\nFile #: 2', Earnings: 'COM 55.00' },
    ], 'Payroll Register')]), 'payroll.xlsx');
    const response = await fetch(`${base}/api/payroll-verification/jobs`, { method: 'POST', body: form });
    const result = await response.json();
    assert.equal(response.status, 200, JSON.stringify(result));
    assert.equal(result.status, 'completed');
    assert.equal(result.summary.matched, 1);
    assert.equal(result.summary.mismatched, 1);
    assert.equal(result.summary.totalHrCommission, 175.25);
    assert.equal(result.summary.totalPayrollCommission, 180.25);
    assert.equal(result.summary.totalDifference, 5);
    assert.equal(logs[0].status, 'success');
    const download = await fetch(base + result.reportUrl);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-disposition'), /attachment/);
    const report = new ExcelJS.Workbook();
    await report.xlsx.load(Buffer.from(await download.arrayBuffer()));
    assert.ok(report.worksheets.length >= 2);
    const allCells = report.worksheets.flatMap(sheet => sheet.getSheetValues());
    assert.match(JSON.stringify(allCells), /Example, One/);
    assert.match(JSON.stringify(allCells), /Mismatch/);
    const html = await fetch(base + result.htmlReportUrl);
    assert.equal(html.status, 200);
    assert.match(await html.text(), /Example, Two/);
    const invalid = await fetch(`${base}/api/payroll-verification/jobs`, { method: 'POST', body: new FormData() });
    assert.equal(invalid.status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('rtut-payroll-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
});
