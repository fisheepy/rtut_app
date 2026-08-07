const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const XLSX = require('xlsx');
const { parsePayroll, moneyEqual } = require('./parser');

function payrollWorkbook(payCode, values = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'insurance-payroll-'));
  const filePath = path.join(directory, 'payroll.xlsx');
  const rows = [{
    'Last Name': 'Employee',
    'First Name': 'Test',
    'Regular Pay Rate Code': payCode,
    'Dental 6': values.dental ?? 17.08,
    Vision: values.vision ?? 6,
    LTD: values.ltd ?? 12,
    'Life-Voluntary': values.life ?? 9,
    SUPP: values.supp ?? 3,
  }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), '1');
  XLSX.writeFile(workbook, filePath);
  return { directory, filePath };
}

test('normalizes a two-payroll hourly report to a monthly amount', () => {
  const fixture = payrollWorkbook('H');
  try {
    const payroll = parsePayroll(fixture.filePath, { payType: 'hourly', payrollCount: 2 });
    assert.equal(payroll.records[0].amounts.dental, 18.5);
    assert.equal(payroll.records[0].amounts.ltd, 13);
    assert.equal(payroll.records[0].rawAmounts.life, 9);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('normalizes a three-payroll hourly report using the same annual factor', () => {
  const fixture = payrollWorkbook('H');
  try {
    const payroll = parsePayroll(fixture.filePath, { payType: 'hourly', payrollCount: 3 });
    assert.equal(payroll.records[0].amounts.dental, 12.34);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('uses salary payroll amounts without normalization', () => {
  const fixture = payrollWorkbook('S', { dental: 35.68, ltd: 64.66, life: 19.3, supp: 10.72 });
  try {
    const payroll = parsePayroll(fixture.filePath, { payType: 'salary' });
    assert.equal(payroll.records[0].amounts.dental, 35.68);
    assert.equal(payroll.records[0].amounts.ltd, 64.66);
    assert.equal(payroll.records[0].amounts.life, 19.3);
    assert.equal(payroll.records[0].amounts.supp, 10.72);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('ignores differences below one dollar but reports one dollar or more', () => {
  assert.equal(moneyEqual(10, 10.99), true);
  assert.equal(moneyEqual(10, 11), false);
  assert.equal(moneyEqual(10, 9.01), true);
  assert.equal(moneyEqual(10, 9), false);
});
