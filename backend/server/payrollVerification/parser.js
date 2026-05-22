const path = require('path');
const XLSX = require('xlsx');

const SUMMARY_ROW_PATTERNS = [
  /^Paid-In Department/i,
  /^Dept\. Total/i,
  /^Earnings Analysis/i,
  /^Memo Analysis/i,
  /^Statutory Ded\. Analysis/i,
  /^Voluntary Ded\. Analysis/i,
  /^Net Payroll/i,
];

function cellText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\r/g, '').trim();
}

function normalizeSpaces(value) {
  return cellText(value).replace(/\s+/g, ' ').trim();
}

function normalizeName(value) {
  return normalizeSpaces(value).toLowerCase();
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  const isNegative = /^\(.*\)$/.test(raw) || raw.includes('-');
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -parsed : parsed;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function readWorkbook(filePath) {
  return XLSX.readFile(filePath, { cellDates: true });
}

function sheetToRows(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
}

function getPayrollSheetName(workbook) {
  return workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'payroll register') || workbook.SheetNames[0];
}

function getHrSheetName(workbook) {
  return workbook.SheetNames[0];
}

function extractNamedValue(rows, label) {
  const target = label.toLowerCase();
  for (const row of rows) {
    const entries = Object.values(row).map(cellText);
    const index = entries.findIndex((value) => value.toLowerCase() === target);
    if (index >= 0 && index + 1 < entries.length) return entries[index + 1];
  }
  return '';
}

function parsePayrollInfo(filePath) {
  const workbook = readWorkbook(filePath);
  const sheetName = workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'payroll info');
  if (!sheetName) return {};

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, raw: false });
  return {
    companyCode: extractNamedValue(rows, 'Company Code'),
    companyName: extractNamedValue(rows, 'Company Name'),
    week: extractNamedValue(rows, 'Week#'),
    quarterYear: extractNamedValue(rows, 'QTR/Year'),
    payDate: extractNamedValue(rows, 'Pay Date'),
    periodEndDate: extractNamedValue(rows, 'P/E Date'),
    runTime: extractNamedValue(rows, 'Run Time/Date'),
    serviceCenter: extractNamedValue(rows, 'Service Center'),
  };
}

function isEmployeeHeader(personnel) {
  return /Associate ID:/i.test(personnel) && /File #:/i.test(personnel);
}

function isSummaryRow(personnel) {
  const normalized = normalizeSpaces(personnel);
  return SUMMARY_ROW_PATTERNS.some((pattern) => pattern.test(normalized));
}

function firstLine(value) {
  return cellText(value).split('\n')[0].trim();
}

function extractField(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cellText(text).match(new RegExp(`${escaped}\\s*:?\\s*([^\\n]+)`, 'i'));
  return match ? normalizeSpaces(match[1]) : '';
}

function extractDepartment(text) {
  return extractField(text, 'W-In Dept') || extractField(text, 'H Dept');
}

function parseEarningsCells(row) {
  const details = [];

  for (const [column, value] of Object.entries(row)) {
    const text = cellText(value);
    if (!text) continue;

    const regex = /\b([A-Z0-9]{2,5})\s+(-?\(?\$?\d[\d,]*\.?\d*\)?)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      details.push({
        code: match[1].trim().toUpperCase(),
        amount: parseMoney(match[2]),
        sourceColumn: column,
        sourceText: text,
      });
    }
  }

  return details.filter((detail) => detail.amount !== null);
}

function parseHrReference(filePath) {
  const workbook = readWorkbook(filePath);
  const rows = sheetToRows(workbook, getHrSheetName(workbook));
  const normalizedRows = rows.map((row, index) => {
    const nameKey = Object.keys(row).find((key) => key.trim().toLowerCase() === 'name');
    const commissionKey = Object.keys(row).find((key) => key.trim().toLowerCase() === 'commission');
    const name = nameKey ? normalizeSpaces(row[nameKey]) : '';
    const commission = commissionKey ? parseMoney(row[commissionKey]) : null;

    return {
      sourceRow: index + 2,
      name,
      normalizedName: normalizeName(name),
      hrCommission: commission === null ? 0 : commission,
      rawCommission: commissionKey ? row[commissionKey] : null,
    };
  });

  return normalizedRows.filter((row) => row.name);
}

function parsePayrollRegister(filePath) {
  const workbook = readWorkbook(filePath);
  const sheetName = getPayrollSheetName(workbook);
  const rows = sheetToRows(workbook, sheetName);

  let currentEmployee = null;
  const employees = new Map();
  const earningDetails = [];
  const exceptions = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const personnel = cellText(row.Personnel);
    if (!personnel) return;

    if (isSummaryRow(personnel)) return;

    if (isEmployeeHeader(personnel)) {
      const name = firstLine(personnel);
      currentEmployee = {
        name: normalizeSpaces(name),
        normalizedName: normalizeName(name),
        associateId: extractField(personnel, 'Associate ID'),
        fileNumber: extractField(personnel, 'File #'),
        department: extractDepartment(personnel),
      };

      if (!employees.has(currentEmployee.normalizedName)) {
        employees.set(currentEmployee.normalizedName, currentEmployee);
      }
    } else if (!currentEmployee) {
      return;
    } else {
      const department = extractDepartment(personnel);
      if (department && !currentEmployee.department) currentEmployee.department = department;
    }

    const earnings = parseEarningsCells(row);
    earnings.forEach((earning) => {
      earningDetails.push({
        ...currentEmployee,
        code: earning.code,
        amount: roundMoney(earning.amount),
        sourceColumn: earning.sourceColumn,
        sourceText: earning.sourceText,
        sourceRow: rowNumber,
        gross: parseMoney(row.Gross),
      });
    });
  });

  const comDetails = earningDetails.filter((detail) => detail.code === 'COM');
  const payrollByName = new Map();

  comDetails.forEach((detail) => {
    const existing = payrollByName.get(detail.normalizedName) || {
      ...detail,
      payrollCommission: 0,
      comRows: [],
    };
    existing.payrollCommission = roundMoney(existing.payrollCommission + detail.amount);
    existing.comRows.push(detail.sourceRow);
    payrollByName.set(detail.normalizedName, existing);
  });

  const nameCounts = {};
  for (const detail of comDetails) {
    nameCounts[detail.normalizedName] = (nameCounts[detail.normalizedName] || 0) + 1;
  }

  Object.entries(nameCounts).forEach(([normalizedName, count]) => {
    if (count > 1) {
      const employee = payrollByName.get(normalizedName);
      exceptions.push({
        type: 'Multiple COM Rows',
        name: employee?.name || normalizedName,
        details: `${count} COM rows were summed for this employee.`,
      });
    }
  });

  return {
    payrollInfo: parsePayrollInfo(filePath),
    payrollSheetName: sheetName,
    employees: Array.from(employees.values()),
    earningDetails,
    comDetails,
    payrollByName,
    exceptions,
  };
}

function compareCommissionFiles({ hrFilePath, payrollFilePath }) {
  const hrRows = parseHrReference(hrFilePath);
  const payroll = parsePayrollRegister(payrollFilePath);
  const exceptions = [...payroll.exceptions];
  const comparison = [];
  const matchedPayrollNames = new Set();

  const hrNameCounts = hrRows.reduce((acc, row) => {
    acc[row.normalizedName] = (acc[row.normalizedName] || 0) + 1;
    return acc;
  }, {});

  hrRows.forEach((hrRow) => {
    const payrollRow = payroll.payrollByName.get(hrRow.normalizedName);
    const duplicateHrName = hrNameCounts[hrRow.normalizedName] > 1;
    const payrollCommission = payrollRow ? payrollRow.payrollCommission : null;
    const difference = payrollCommission === null ? null : roundMoney(payrollCommission - hrRow.hrCommission);
    let status = 'Match';
    let notes = '';

    if (duplicateHrName) {
      status = 'Ambiguous HR Name';
      notes = 'The HR reference file contains this name more than once.';
    } else if (!payrollRow) {
      status = 'Missing in Payroll';
      notes = 'No payroll COM earning found for this HR employee.';
    } else if (Math.abs(difference) >= 0.01) {
      status = 'Mismatch';
      notes = 'HR commission does not equal payroll COM total.';
    }

    if (payrollRow) matchedPayrollNames.add(hrRow.normalizedName);

    comparison.push({
      name: hrRow.name,
      hrCommission: roundMoney(hrRow.hrCommission),
      payrollCommission,
      difference,
      status,
      payrollEmployeeName: payrollRow?.name || '',
      associateId: payrollRow?.associateId || '',
      fileNumber: payrollRow?.fileNumber || '',
      department: payrollRow?.department || '',
      payrollRows: payrollRow?.comRows?.join(', ') || '',
      notes,
    });
  });

  for (const payrollRow of payroll.payrollByName.values()) {
    if (!matchedPayrollNames.has(payrollRow.normalizedName)) {
      comparison.push({
        name: '',
        hrCommission: null,
        payrollCommission: payrollRow.payrollCommission,
        difference: null,
        status: 'Missing in HR',
        payrollEmployeeName: payrollRow.name,
        associateId: payrollRow.associateId,
        fileNumber: payrollRow.fileNumber,
        department: payrollRow.department,
        payrollRows: payrollRow.comRows.join(', '),
        notes: 'Payroll has COM earnings but the employee is not in HR reference.',
      });
    }
  }

  comparison.forEach((row) => {
    if (row.status !== 'Match') {
      exceptions.push({
        type: row.status,
        name: row.name || row.payrollEmployeeName,
        details: row.notes,
      });
    }
  });

  const summary = {
    totalHrEmployees: hrRows.length,
    payrollComEmployees: payroll.payrollByName.size,
    matched: comparison.filter((row) => row.status === 'Match').length,
    mismatched: comparison.filter((row) => row.status === 'Mismatch').length,
    missingInPayroll: comparison.filter((row) => row.status === 'Missing in Payroll').length,
    missingInHr: comparison.filter((row) => row.status === 'Missing in HR').length,
    exceptions: comparison.filter((row) => row.status !== 'Match').length,
    totalHrCommission: roundMoney(hrRows.reduce((sum, row) => sum + row.hrCommission, 0)),
    totalPayrollCommission: roundMoney(Array.from(payroll.payrollByName.values()).reduce((sum, row) => sum + row.payrollCommission, 0)),
  };
  summary.totalDifference = roundMoney(summary.totalPayrollCommission - summary.totalHrCommission);

  return {
    summary,
    comparison,
    payrollComDetails: payroll.comDetails,
    earningDetails: payroll.earningDetails,
    exceptions,
    payrollInfo: payroll.payrollInfo,
    metadata: {
      hrFileName: path.basename(hrFilePath),
      payrollFileName: path.basename(payrollFilePath),
      payrollSheetName: payroll.payrollSheetName,
      generatedAt: new Date().toISOString(),
      ruleVersion: 'payroll-commission-v1',
    },
  };
}

module.exports = {
  compareCommissionFiles,
  normalizeName,
  parseMoney,
  roundMoney,
};
