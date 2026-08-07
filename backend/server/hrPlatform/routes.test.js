const test = require('node:test');
const assert = require('node:assert/strict');
const { commentAudit, employeeView, terminationEmployeeView, fileTrackerComplete, payrollChangeRequestChanged, sanitizeFileTracker, validDate } = require('./data');

test('maps Company App employee fields into a New Hire row', () => {
  const employee = {
    _id: '507f1f77bcf86cd799439011',
    'First Name': 'Myra', 'Last Name': 'Yu', Email: 'myu@example.com', Phone: '555',
    'Hire Date': '2026-08-01', 'Home Department': 'Office/Admin', 'Job Title': 'HR', Location: 'Dearborn',
    'Supervisor First Name': 'Sam', 'Supervisor Last Name': 'Dallis', 'EEOC Establishment': 'Dearborn',
    'Worker Category': 'Office', 'Pay Category': 'Salary', 'Position Status': 'Active', 'Account Active': 'Active', isActivated: 'false',
  };
  const result = employeeView(employee, { firstPayrollDate: '2026-08-07', payrollCheckedAt: new Date('2026-08-08'), insuranceCheckedBy: 'admin@example.com', insuranceNotApplicable: true, retirementEffectiveDate: '2026-09-01', payRateChangePending: true, payrollChangeDate: '2026-08-15', payrollChangeReason: 'Promotion' });
  assert.equal(result.name, 'Myra Yu');
  assert.equal(result.supervisor, 'Sam Dallis');
  assert.equal(result.firstPayrollDate, '2026-08-07');
  assert.equal(result.payrollCheckedAt.toISOString(), '2026-08-08T00:00:00.000Z');
  assert.equal(result.insuranceCheckedBy, 'admin@example.com');
  assert.equal(result.payRateChangePending, true);
  assert.equal(result.payrollChangeDate, '2026-08-15');
  assert.equal(result.payrollChangeReason, 'Promotion');
  assert.equal(result.insuranceNotApplicable, true);
  assert.equal(result.retirementNotApplicable, false);
  assert.equal(result.retirementEffectiveDate, '2026-09-01');
});

test('accepts empty or ISO dates only', () => {
  assert.equal(validDate(''), true);
  assert.equal(validDate('2026-08-01'), true);
  assert.equal(validDate('08/01/2026'), false);
});

test('resets payroll change review when the pending date or reason changes', () => {
  const existing = { payRateChangePending: true, payrollChangeDate: '2026-08-15', payrollChangeReason: 'Promotion' };
  assert.equal(payrollChangeRequestChanged(existing, true, '2026-08-15', 'Promotion'), false);
  assert.equal(payrollChangeRequestChanged(existing, true, '2026-08-22', 'Promotion'), true);
  assert.equal(payrollChangeRequestChanged(existing, true, '2026-08-15', 'Market adjustment'), true);
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

test('does not require a handbook version when the employee did not sign', () => {
  const tracker = sanitizeFileTracker({
    resumeInformation: 'Yes', hiringApproval: 'Yes', federalW4: 'Yes', stateW4: 'Yes',
    handbookSignoff: 'No', handbookVersion: '', safetyPolicySignoff: 'Yes',
    confidentialityPolicySignoff: 'Yes', offerLetter: 'Yes', nncdra: 'Exempt',
    backgroundCheck: 'Not Applicable', i9: 'Yes',
  });
  assert.equal(tracker.responses.handbookSignoff, 'No');
  assert.equal(tracker.handbookVersion, '');
  assert.equal(fileTrackerComplete(tracker), true);
});

test('recognizes a manager-configured handbook signoff field', () => {
  const catalog = [{ id: 'custom-handbook', label: 'Handbook Sign-off', options: ['Yes - Signed', 'No'], active: true }];
  const declined = sanitizeFileTracker({ responses: { 'custom-handbook': 'No' }, handbookVersion: '' }, catalog);
  const signed = sanitizeFileTracker({ responses: { 'custom-handbook': 'Yes - Signed' }, handbookVersion: '' }, catalog);
  assert.equal(fileTrackerComplete(declined, catalog), true);
  assert.equal(fileTrackerComplete(signed, catalog), false);
});

test('records the administrator and history when File Tracker comments change', () => {
  const now = new Date('2026-08-04T14:00:00Z');
  const changed = commentAudit({ comments: 'Old note' }, 'Updated note', 'admin@example.com', now);
  assert.equal(changed.commentsBy, 'admin@example.com');
  assert.equal(changed.commentsUpdatedAt, now);
  assert.deepEqual(changed.commentHistory, [{ comments: 'Updated note', by: 'admin@example.com', at: now }]);
  assert.deepEqual(commentAudit(changed, 'Updated note', 'other@example.com', new Date()), changed);
});

test('maps a terminated Company App employee into the termination workflow', () => {
  const row = terminationEmployeeView({
    _id: 'employee-2', 'First Name': 'Test080501', 'Last Name': 'Test080501',
    'Termination Date': '2026-08-05', 'Home Department': 'Office/Admin', 'Job Title': 'Tester',
  }, {
    finalPayrollDate: '2026-08-12', pendingIssues: true,
    payrollFollowThroughUntil: '2026-08-31', insuranceParticipation: 'not-participated',
  });
  assert.equal(row.name, 'Test080501 Test080501');
  assert.equal(row.terminationDate, '2026-08-05');
  assert.equal(row.finalPayrollDate, '2026-08-12');
  assert.equal(row.pendingIssues, true);
  assert.equal(row.insuranceParticipation, 'not-participated');
});

test('keeps historical COBRA enrollment dates on a terminated employee', () => {
  const row = terminationEmployeeView({
    _id: 'cobra-employee', 'First Name': 'Cobra', 'Last Name': 'History', 'Termination Date': '2025-01-15',
  }, { cobraStartDate: '2025-02-01', cobraEndDate: '2026-02-01', cobraUpdatedBy: 'admin@example.com' });
  assert.equal(row.cobraStartDate, '2025-02-01');
  assert.equal(row.cobraEndDate, '2026-02-01');
  assert.equal(row.cobraUpdatedBy, 'admin@example.com');
});

test('exposes COBRA closure audit without removing historical dates', () => {
  const closedAt = new Date('2026-02-02T12:00:00Z');
  const row = terminationEmployeeView({
    _id: 'closed-cobra', 'First Name': 'Closed', 'Last Name': 'Cobra', 'Termination Date': '2025-01-15',
  }, { cobraStartDate: '2025-02-01', cobraEndDate: '2026-02-01', cobraClosedAt: closedAt, cobraClosedBy: 'admin@example.com' });
  assert.equal(row.cobraStartDate, '2025-02-01');
  assert.equal(row.cobraEndDate, '2026-02-01');
  assert.equal(row.cobraClosedAt, closedAt);
  assert.equal(row.cobraClosedBy, 'admin@example.com');
});
