const test = require('node:test');
const assert = require('node:assert/strict');
const { closureBlocker, closureWarnings, employeeSnapshot, sanitizeCaseInput, totalCaseCost, withCurrentWorkStatus } = require('./data');

const employee = {
  _id: 'employee-1', 'First Name': 'Alex', 'Last Name': 'Morgan', 'Hire Date': '2024-01-15',
  'Home Department': 'Service', Location: 'Dearborn', 'Supervisor First Name': 'Sam',
  'Supervisor Last Name': 'Dallis', 'Job Title': 'Technician', Phone: '555-0100',
  Email: 'alex@example.com', 'Position Status': 'Active',
};

test('takes employee identity and roster details from the Company App record', () => {
  assert.deepEqual(employeeSnapshot(employee), {
    employeeId: 'employee-1', employeeName: 'Alex Morgan', hireDate: '2024-01-15', department: 'Service',
    location: 'Dearborn', supervisor: 'Sam Dallis', jobTitle: 'Technician', employeePhone: '555-0100',
    employeeEmail: 'alex@example.com', companyStatus: 'Active',
  });
});

test('validates and sanitizes a new work injury case', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No', followUpIssues: 'Clinic follow-up',
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.employeeName, 'Alex Morgan');
  assert.equal(result.value.followUpIssues, 'Clinic follow-up');
});

test('requires an employee injury folder link when creating a new case', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
  }, employee, { requireEmployeeInjuryFolder: true });
  assert.equal(result.error, 'Employee Injury Folder Link is required for a new case.');
});

test('accepts follow-up issues without a follow-up date', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Pending Medical Evaluation', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No', followUpIssues: 'Clinic follow-up',
  }, employee);
  assert.equal(result.error, undefined);
});

test('requires details when Other work status is selected', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Other', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
  }, employee);
  assert.equal(result.error, 'Enter the other Work Status / Medical Restriction.');
});

test('requires conditional safety and workers compensation details', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'Yes', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
  }, employee);
  assert.equal(result.error, 'Describe the safety violation.');
});

test('keeps optional workers compensation contact information', () => {
  const result = sanitizeCaseInput({ injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand', injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand', oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'Yes', workersCompCaseNumber: 'WC-123', workersCompContactName: 'Taylor Smith', workersCompContactPhone: '555-0102', workersCompContactEmail: 'taylor@example.com' }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.workersCompContactName, 'Taylor Smith');
  assert.equal(result.value.workersCompContactPhone, '555-0102');
  assert.equal(result.value.workersCompContactEmail, 'taylor@example.com');
});

test('sanitizes timeline entries and case costs', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    timeline: [{ date: '2026-08-08', description: 'Clinic visit', workStatusAfter: 'Off Work', documentationLink: '' }],
    costs: [{ invoiceDate: '2026-08-09', description: 'Clinic invoice', paidBy: 'Royal', royalCostType: 'Medical Bill', amount: '125.50', invoiceLink: '' }],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.timeline[0].description, 'Clinic visit');
  assert.equal(result.value.costs[0].amount, 125.5);
  assert.equal(result.value.costs[0].royalCostType, 'Medical Bill');
});

test('requires and stores an item for Other Royal costs', () => {
  const base = { injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand', injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand', oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No' };
  const missing = sanitizeCaseInput({ ...base, costs: [{ description: 'Other expense', paidBy: 'Royal', royalCostType: 'Other', amount: '25', invoiceLink: '' }] }, employee);
  assert.match(missing.error, /Other Royal cost item/);
  const result = sanitizeCaseInput({ ...base, costs: [{ description: 'Other expense', paidBy: 'Royal', royalCostType: 'Other', royalCostOtherItem: 'Damaged uniform replacement', amount: '25', invoiceLink: '' }] }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.costs[0].royalCostOtherItem, 'Damaged uniform replacement');
});

test('validates and stores safety investigation details', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'Yes', safetyViolationDetails: 'Guard was removed',
    investigationStatus: 'Completed', investigationDate: '2026-08-08', rootCause: 'Machine guard bypassed',
    correctiveActionRequired: 'Yes', correctiveActionDetails: 'Replace guard and retrain team',
    correctiveActionTargetDate: '2026-08-15', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.investigationStatus, 'Completed');
  assert.equal(result.value.rootCause, 'Machine guard bypassed');
  assert.equal(result.value.correctiveActionDetails, 'Replace guard and retrain team');
});

test('requires investigation findings before an investigation is completed', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', investigationStatus: 'Completed',
    correctiveActionRequired: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
  }, employee);
  assert.equal(result.error, 'A completed investigation requires an investigation date and root cause.');
});

test('uses the latest timeline entry as the summary work status while preserving the initial status', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    timeline: [
      { date: '2026-08-08', description: 'Initial restriction', workStatusAfter: 'Off Work' },
      { date: '2026-08-10', description: 'Doctor update', workStatusAfter: 'Other', otherWorkStatusAfter: 'Light duty - four hours' },
    ],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.workStatus, 'Off Work');
  const summary = withCurrentWorkStatus(result.value);
  assert.equal(summary.workStatus, 'Other');
  assert.equal(summary.otherWorkStatus, 'Light duty - four hours');
  assert.equal(summary.initialWorkStatus, 'Off Work');
});

test('accepts a case cost without an invoice date', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    costs: [{ description: 'Estimated clinic cost', paidBy: 'Royal', royalCostType: 'Medical Bill', amount: '100', invoiceLink: '' }],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.costs[0].invoiceDate, '');
});

test('totals every cost recorded against an injury case', () => {
  assert.equal(totalCaseCost({ costs: [{ amount: 125.5 }, { amount: '74.50' }, { amount: '' }] }), 200);
});

test('repairs a stale grid status from the latest saved timeline entry', () => {
  const record = withCurrentWorkStatus({
    workStatus: 'Off Work', otherWorkStatus: '',
    timeline: [
      { date: '2026-08-08', workStatusAfter: 'Off Work' },
      { date: '2026-08-12', workStatusAfter: 'Other', otherWorkStatusAfter: 'No lifting over ten pounds' },
    ],
  });
  assert.equal(record.workStatus, 'Other');
  assert.equal(record.otherWorkStatus, 'No lifting over ten pounds');
});

test('preserves a legacy custom timeline status as Other when editing its documentation', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    timeline: [{ date: '2026-08-08', description: 'Doctor note', workStatusAfter: 'Light duty - no lifting', documentationLink: 'https://royaltruck.sharepoint.com/sites/Safety/file.pdf' }],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.timeline[0].workStatusAfter, 'Other');
  assert.equal(result.value.timeline[0].otherWorkStatusAfter, 'Light duty - no lifting');
});

test('explains every issue that should be reviewed before case closure', () => {
  const warnings = closureWarnings({
    workStatus: 'Off Work', investigationStatus: 'In Progress', investigationDate: '', rootCause: '',
    safetyViolation: 'No', correctiveActionRequired: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    followUpIssues: 'Awaiting clinic note', timeline: [],
  });
  assert.ok(warnings.some(message => message.includes('not "Returned to Work - No Restrictions"')));
  assert.ok(warnings.includes('The safety investigation is not completed.'));
  assert.ok(warnings.includes('Investigation Date is missing.'));
  assert.ok(warnings.includes('Root Cause is missing.'));
  assert.ok(!warnings.some((warning) => warning.includes('Follow-up Issues')));
});

test('allows a complete unrestricted case to proceed without warnings', () => {
  const warnings = closureWarnings({
    workStatus: 'Returned to Work - No Restrictions', investigationStatus: 'Completed', investigationDate: '2026-08-10', rootCause: 'Wet floor',
    safetyViolation: 'No', correctiveActionRequired: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No', followUpIssues: '', timeline: [],
  });
  assert.deepEqual(warnings, []);
});

test('blocks closure until the injury report and its link are received', () => {
  assert.equal(closureBlocker({ injuryReportReceived: 'No' }), 'The Injury Report must be received before requesting case closure.');
  assert.equal(closureBlocker({ injuryReportReceived: 'Yes', injuryReportLink: '' }), 'The Injury Report Link is required before requesting case closure.');
  assert.equal(closureBlocker({ injuryReportReceived: 'Yes', injuryReportLink: 'https://royaltruck.sharepoint.com/report' }), '');
});
