const test = require('node:test');
const assert = require('node:assert/strict');
const { employeeView, fileTrackerComplete, sanitizeFileTracker, validDate } = require('./data');

test('maps Company App employee fields into a New Hire row', () => {
  const employee = {
    _id: '507f1f77bcf86cd799439011',
    'First Name': 'Myra', 'Last Name': 'Yu', Email: 'myu@example.com', Phone: '555',
    'Hire Date': '2026-08-01', 'Home Department': 'Office/Admin', 'Job Title': 'HR', Location: 'Dearborn',
    'Supervisor First Name': 'Sam', 'Supervisor Last Name': 'Dallis', 'EEOC Establishment': 'Dearborn',
    'Worker Category': 'Office', 'Pay Category': 'Salary', 'Position Status': 'Active', 'Account Active': 'Active', isActivated: 'false',
  };
  const result = employeeView(employee, { firstPayrollDate: '2026-08-07' });
  assert.equal(result.name, 'Myra Yu');
  assert.equal(result.supervisor, 'Sam Dallis');
  assert.equal(result.firstPayrollDate, '2026-08-07');
});

test('accepts empty or ISO dates only', () => {
  assert.equal(validDate(''), true);
  assert.equal(validDate('2026-08-01'), true);
  assert.equal(validDate('08/01/2026'), false);
});

test('requires every File Tracker item and handbook version before confirmation', () => {
  const tracker = sanitizeFileTracker({
    resumeInformation: 'Yes', hiringApproval: 'Yes', federalW4: 'Yes', stateW4: 'Yes',
    handbookSignoff: 'Yes', handbookVersion: '2026.1', safetyPolicySignoff: 'Yes',
    confidentialityPolicySignoff: 'Yes', offerLetter: 'Yes', nncdra: 'Exempt',
    backgroundCheck: 'Not Applicable', i9: 'Yes', comments: 'Waiting for payroll review.',
  });
  assert.equal(fileTrackerComplete(tracker), true);
  assert.equal(tracker.comments, 'Waiting for payroll review.');
  assert.equal(fileTrackerComplete({ ...tracker, handbookVersion: '' }), false);
});
