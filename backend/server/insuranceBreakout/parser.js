const path = require('path');
const XLSX = require('xlsx');

const BENEFITS = [
  { key: 'dental', label: 'Dental', payrollColumn: 'Dental 6' },
  { key: 'vision', label: 'Vision', payrollColumn: 'Vision' },
  { key: 'ltd', label: 'LTD', payrollColumn: 'LTD' },
  { key: 'life', label: 'Life', payrollColumn: 'Life-Voluntary' },
  { key: 'supp', label: 'SUPP', payrollColumn: 'SUPP' },
];

function cellText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r/g, '').trim();
}

function firstToken(value) {
  return cellText(value).toLowerCase().split(/\s+/, 1)[0] || '';
}

function nameKey(lastName, firstName) {
  return `${firstToken(lastName)}|${firstToken(firstName)}`;
}

function displayName(lastName, firstName) {
  return [cellText(firstName), cellText(lastName)].filter(Boolean).join(' ');
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = String(value).trim();
  const isNegative = /^\(.*\)$/.test(raw) || raw.includes('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? (isNegative ? -parsed : parsed) : 0;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function moneyEqual(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 1;
}

function readRows(filePath, options = {}) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = options.sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, range: options.range || 0 });
}

function createInvoiceStore() {
  return { firstByName: new Map(), records: [] };
}

function addRecord(store, record) {
  if (!record.key || !record.name) return;
  const normalized = { ...record, amount: Number(record.amount) || 0, sourceRows: [record.sourceRow] };
  store.records.push(normalized);
  if (!store.firstByName.has(record.key)) store.firstByName.set(record.key, normalized);
}

function parsePayroll(filePath, { payType, payrollCount = null } = {}) {
  if (!['salary', 'hourly'].includes(payType)) throw new Error('Payroll pay type must be salary or hourly.');
  if (payType === 'hourly' && ![2, 3].includes(Number(payrollCount))) throw new Error('Hourly payroll count must be 2 or 3.');
  const rows = readRows(filePath);
  const records = [];
  const keySet = new Set();
  const expectedCode = payType === 'salary' ? 'S' : 'H';
  const factor = payType === 'hourly' ? 26 / (Number(payrollCount) * 12) : 1;

  rows.forEach((row, index) => {
    const key = nameKey(row['Last Name'], row['First Name']);
    if (!key.includes('|') || key === '|') return;
    const payCode = cellText(row['Regular Pay Rate Code']).toUpperCase();
    if (payCode && payCode !== expectedCode) {
      throw new Error(`${payType === 'salary' ? 'Salary' : 'Hourly'} payroll file contains pay code ${payCode} on row ${index + 2}; expected ${expectedCode}.`);
    }

    keySet.add(key);
    const rawAmounts = {
      dental: parseMoney(row['Dental 6']),
      vision: parseMoney(row.Vision),
      ltd: parseMoney(row.LTD ?? row['LTD Adjusted']),
      life: parseMoney(row['Life-Voluntary'] ?? row['Life Adjusted']),
      supp: parseMoney(row.SUPP ?? row['SUPP Adjusted']),
    };
    records.push({
      key,
      lastName: firstToken(row['Last Name']),
      firstName: firstToken(row['First Name']),
      name: displayName(row['Last Name'], row['First Name']),
      sourceRow: index + 2,
      payType,
      payrollCount: payType === 'hourly' ? Number(payrollCount) : 24 / 12,
      normalizationFactor: factor,
      rawAmounts,
      amounts: Object.fromEntries(Object.entries(rawAmounts).map(([benefit, amount]) => [benefit, roundMoney(amount * factor)])),
    });
  });

  if (!records.length) throw new Error(`No ${payType} payroll employees were found in the uploaded file.`);
  return { records, keySet };
}

function combinePayrolls(...payrolls) {
  const records = payrolls.flatMap((payroll) => payroll.records);
  const keySet = new Set();
  for (const employee of records) {
    if (keySet.has(employee.key)) throw new Error(`${employee.name} appears in both Salary and Hourly payroll files.`);
    keySet.add(employee.key);
  }
  return { records, keySet };
}

function parseDental(filePath) {
  const store = createInvoiceStore();
  const rows = readRows(filePath, { sheetName: 'Subscriber Listing' });

  rows.forEach((row, index) => {
    const key = nameKey(row.LAST_NAME, row.FIRST_NAME);
    addRecord(store, {
      key,
      name: displayName(row.LAST_NAME, row.FIRST_NAME),
      amount: parseMoney(row['TOTAL DUE']),
      sourceRow: index + 2,
    });
  });

  return store;
}

function parseVision(filePath) {
  const store = createInvoiceStore();
  const rows = readRows(filePath, { range: 12 });

  rows.forEach((row, index) => {
    const key = nameKey(row['Last Name'], row['First Name']);
    addRecord(store, {
      key,
      name: displayName(row['Last Name'], row['First Name']),
      amount: parseMoney(row.Rate),
      sourceRow: index + 14,
    });
  });

  return store;
}

function parseParticipantName(value) {
  const text = cellText(value);
  if (!text || text === 'PARTICIPANT' || text === 'Grand Total' || !text.includes(',')) return null;
  const [lastName, firstName] = text.split(',', 2).map((part) => part.trim());
  return { lastName, firstName };
}

function participantKey(lastName, firstName) {
  return `${cellText(lastName).toLowerCase()}|${cellText(firstName).toLowerCase()}`;
}

function classifyCoverage(value) {
  const coverage = cellText(value).toLowerCase();
  if (coverage === 'vol ltd') return 'ltd';
  if (coverage === 'vol ad&d' || coverage === 'vol life') return 'life';
  if (coverage === 'vol') return 'supp';
  return null;
}

function parseLtdLifeSupp(filePath) {
  const stores = { ltd: createInvoiceStore(), life: createInvoiceStore(), supp: createInvoiceStore() };
  const grouped = { ltd: new Map(), life: new Map(), supp: new Map() };
  const rows = readRows(filePath, { sheetName: 'Detail' });

  rows.forEach((row, index) => {
    const benefit = classifyCoverage(row.COVERAGE);
    if (!benefit) return;
    const participant = parseParticipantName(row.PARTICIPANT);
    if (!participant) return;

    const id = cellText(row.ID) || `${participant.lastName}|${participant.firstName}`;
    const existing = grouped[benefit].get(id) || {
      ...participant,
      amount: 0,
      sourceRows: [],
    };
    existing.amount = existing.amount + parseMoney(row.AMOUNT);
    existing.sourceRows.push(index + 2);
    grouped[benefit].set(id, existing);
  });

  for (const benefit of ['ltd', 'life', 'supp']) {
    const sortedIds = Array.from(grouped[benefit].keys()).sort();
    for (const id of sortedIds) {
      const record = grouped[benefit].get(id);
      addRecord(stores[benefit], {
        key: participantKey(record.lastName, record.firstName),
        name: displayName(record.lastName, record.firstName),
        amount: record.amount,
        sourceRow: record.sourceRows.join(', '),
      });
    }
  }

  return stores;
}

function buildIssue({ benefit, issueType, payrollEmployee, invoiceRecord, payrollAmount, invoiceAmount }) {
  return {
    benefit: benefit.label,
    benefitKey: benefit.key,
    issueType,
    name: payrollEmployee?.name || invoiceRecord?.name || '',
    payType: payrollEmployee?.payType ? payrollEmployee.payType[0].toUpperCase() + payrollEmployee.payType.slice(1) : '',
    payrollCount: payrollEmployee?.payrollCount ?? null,
    rawPayrollAmount: payrollEmployee ? roundMoney(payrollEmployee.rawAmounts?.[benefit.key] || 0) : null,
    payrollAmount: payrollAmount === null || payrollAmount === undefined ? null : roundMoney(payrollAmount),
    invoiceAmount: invoiceAmount === null || invoiceAmount === undefined ? null : roundMoney(invoiceAmount),
    difference: payrollAmount === null || invoiceAmount === null || payrollAmount === undefined || invoiceAmount === undefined
      ? null
      : roundMoney(invoiceAmount - payrollAmount),
    payrollRow: payrollEmployee?.sourceRow || '',
    invoiceRows: invoiceRecord?.sourceRows?.join(', ') || '',
    notes: issueType === 'Amount Mismatch'
      ? `${benefit.label} invoice amount differs from the normalized payroll deduction by at least $1.00.${payrollEmployee?.payType === 'hourly' ? ` Hourly amount normalized as raw deduction / ${payrollEmployee.payrollCount} × 26 / 12.` : ''}`
      : issueType === 'Missing in Invoice'
        ? `Payroll has a ${benefit.label} deduction but no matching invoice record was found.`
        : `${benefit.label} invoice has a charge but no matching payroll employee was found.`,
  };
}

function compareBenefit({ benefit, payroll, invoiceStore }) {
  const issues = [];

  for (const employee of payroll.records) {
    const payrollAmount = employee.amounts[benefit.key] || 0;
    const invoiceRecord = invoiceStore.firstByName.get(employee.key);

    if (!invoiceRecord && !moneyEqual(payrollAmount, 0)) {
      issues.push(buildIssue({ benefit, issueType: 'Missing in Invoice', payrollEmployee: employee, payrollAmount, invoiceAmount: null }));
    } else if (invoiceRecord && !moneyEqual(payrollAmount, invoiceRecord.amount)) {
      issues.push(buildIssue({
        benefit,
        issueType: 'Amount Mismatch',
        payrollEmployee: employee,
        invoiceRecord,
        payrollAmount,
        invoiceAmount: invoiceRecord.amount,
      }));
    }
  }

  for (const invoiceRecord of invoiceStore.records) {
    if (!payroll.keySet.has(invoiceRecord.key) && !moneyEqual(invoiceRecord.amount, 0)) {
      issues.push(buildIssue({ benefit, issueType: 'Missing in Payroll', invoiceRecord, payrollAmount: null, invoiceAmount: invoiceRecord.amount }));
    }
  }

  return issues;
}

function compareInsuranceFiles({ salaryPayrollFilePath, hourlyPayrollFilePath, hourlyPayrollCount, dentalFilePath, visionFilePath, ltdLifeSuppFilePath }) {
  const salaryPayroll = parsePayroll(salaryPayrollFilePath, { payType: 'salary' });
  const hourlyPayroll = parsePayroll(hourlyPayrollFilePath, { payType: 'hourly', payrollCount: Number(hourlyPayrollCount) });
  const payroll = combinePayrolls(salaryPayroll, hourlyPayroll);
  const invoiceMaps = {
    dental: parseDental(dentalFilePath),
    vision: parseVision(visionFilePath),
    ...parseLtdLifeSupp(ltdLifeSuppFilePath),
  };

  const issuesByBenefit = {};
  const issues = [];

  for (const benefit of BENEFITS) {
    const benefitIssues = compareBenefit({ benefit, payroll, invoiceStore: invoiceMaps[benefit.key] });
    issuesByBenefit[benefit.key] = benefitIssues;
    issues.push(...benefitIssues);
  }

  const summaryByBenefit = BENEFITS.map((benefit) => ({
    key: benefit.key,
    label: benefit.label,
    issues: issuesByBenefit[benefit.key].length,
    amountMismatches: issuesByBenefit[benefit.key].filter((issue) => issue.issueType === 'Amount Mismatch').length,
    missingInInvoice: issuesByBenefit[benefit.key].filter((issue) => issue.issueType === 'Missing in Invoice').length,
    missingInPayroll: issuesByBenefit[benefit.key].filter((issue) => issue.issueType === 'Missing in Payroll').length,
  }));

  return {
    summary: {
      payrollEmployees: payroll.records.length,
      salaryEmployees: salaryPayroll.records.length,
      hourlyEmployees: hourlyPayroll.records.length,
      totalIssues: issues.length,
      amountMismatches: issues.filter((issue) => issue.issueType === 'Amount Mismatch').length,
      missingInInvoice: issues.filter((issue) => issue.issueType === 'Missing in Invoice').length,
      missingInPayroll: issues.filter((issue) => issue.issueType === 'Missing in Payroll').length,
      summaryByBenefit,
    },
    issues,
    issuesByBenefit,
    metadata: {
      salaryPayrollFileName: path.basename(salaryPayrollFilePath),
      hourlyPayrollFileName: path.basename(hourlyPayrollFilePath),
      hourlyPayrollCount: Number(hourlyPayrollCount),
      dentalFileName: path.basename(dentalFilePath),
      visionFileName: path.basename(visionFilePath),
      ltdLifeSuppFileName: path.basename(ltdLifeSuppFilePath),
      generatedAt: new Date().toISOString(),
      ruleVersion: 'insurance-breakout-v2-pay-types',
    },
  };
}

module.exports = {
  BENEFITS,
  compareInsuranceFiles,
  parsePayroll,
  parseMoney,
  roundMoney,
  moneyEqual,
};
