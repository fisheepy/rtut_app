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

module.exports = { writeCommissionReport };
