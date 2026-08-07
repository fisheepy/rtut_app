const test = require('node:test');
const assert = require('node:assert/strict');
const { employeeSnapshot, sanitizeCaseInput } = require('./data');

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
