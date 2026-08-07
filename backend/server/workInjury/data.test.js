const test = require('node:test');
const assert = require('node:assert/strict');
const { employeeSnapshot, sanitizeCaseInput, withCurrentWorkStatus } = require('./data');

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

test('sanitizes timeline entries and case costs', () => {
  const result = sanitizeCaseInput({
    injuryDateTime: '2026-08-07T09:30', firstNoticeDate: '2026-08-07', injuryDescription: 'Cut to hand',
    injuryLocation: 'Service bay', safetyViolation: 'No', workStatus: 'Off Work', injuredBodyPart: 'Left hand',
    oshaRecordable: 'No', injuryReportReceived: 'No', workersCompClaimed: 'No',
    timeline: [{ date: '2026-08-08', description: 'Clinic visit', workStatusAfter: 'Off Work', documentationLink: '' }],
    costs: [{ invoiceDate: '2026-08-09', description: 'Clinic invoice', paidBy: 'Royal', amount: '125.50', invoiceLink: '' }],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.timeline[0].description, 'Clinic visit');
  assert.equal(result.value.costs[0].amount, 125.5);
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
    costs: [{ description: 'Estimated clinic cost', paidBy: 'Royal', amount: '100', invoiceLink: '' }],
  }, employee);
  assert.equal(result.error, undefined);
  assert.equal(result.value.costs[0].invoiceDate, '');
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

