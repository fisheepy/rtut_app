const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmployee, completedAtLeastOneYear, explicitPriorServiceQualified } = require('./employeeData');
const { canonicalizeEmployeeRosterFields } = require('./employeeFieldFormat');

test('maps Company App roster fields and supplies both training types', () => {
  const employee = normalizeEmployee({
    _id: 'employee-1',
    'First Name': 'Alex',
    'Last Name': 'Morgan',
    Email: 'alex.morgan@example.com',
    Phone: '(555) 123-4567',
    'Job Title': 'Technician',
    Location: 'Detroit',
    'Home Department': 'Service',
    'Hire Date': '2026-01-02',
    'Supervisor First Name': 'Sam',
    'Supervisor Last Name': 'Lee',
    'Account Active': 'Active',
  });

  assert.equal(employee.employeeName, 'Alex Morgan');
  assert.equal(employee.email, 'alex.morgan@example.com');
  assert.equal(employee.contactNumber, '(555) 123-4567');
  assert.equal(employee.department, 'Service');
  assert.equal(employee.reportingTo, 'Sam Lee');
  assert.equal(employee.folderUrl, '');
  assert.equal(employee.employmentStatus, 'Active');
  assert.equal(employee.training.orientation.status, 'Unassigned');
  assert.equal(employee.training.monthly.status, 'Unassigned');
});

test('merges roster field labels that only differ by case, spacing, or slash formatting', () => {
  const employees = canonicalizeEmployeeRosterFields([
    { department: 'OFFICE / ADMIN', jobTitle: 'OWNER', location: 'DEARBORN' },
    { department: 'Office/Admin', jobTitle: 'Owner', location: 'Dearborn ' },
    { department: 'Office / admin', jobTitle: 'owner', location: 'dearborn' },
  ]);

  assert.deepEqual([...new Set(employees.map((employee) => employee.department))], ['Office/Admin']);
  assert.deepEqual([...new Set(employees.map((employee) => employee.jobTitle))], ['Owner']);
  assert.deepEqual([...new Set(employees.map((employee) => employee.location))], ['Dearborn']);
});

test('keeps a manually assigned SharePoint employee folder link', () => {
  const employee = normalizeEmployee({
    _id: 'employee-3',
    'First Name': 'Xuan',
    'Last Name': 'Yu',
  }, {
    folderUrl: 'https://royaltruck.sharepoint.com/sites/Safety/example',
  });

  assert.equal(employee.folderUrl, 'https://royaltruck.sharepoint.com/sites/Safety/example');
});

test('shows employees with a termination date as terminated', () => {
  const employee = normalizeEmployee({
    _id: 'employee-2',
    'First Name': 'Jamie',
    'Last Name': 'Chen',
    'Termination Date': '2026-06-30',
    'Account Active': 'Active',
  }, {
    orientation: { status: 'Completed', completedAt: '2025-02-03' },
  });

  assert.equal(employee.employmentStatus, 'Terminated');
  assert.equal(employee.terminationDay, '2026-06-30');
  assert.equal(employee.training.orientation.status, 'Unassigned');
  assert.equal(employee.training.monthly.status, 'Unassigned');
});

test('keeps an employee on Leave in the active Training Tools roster', () => {
  const employee = normalizeEmployee({
    _id: 'employee-leave',
    'First Name': 'Taylor',
    'Last Name': 'Jordan',
    'Position Status': 'Leave',
    'Account Active': 'Active',
    'Termination Date': '',
  });

  assert.equal(employee.employmentStatus, 'Active');
  assert.equal(employee.terminationDay, null);
});

test('recognizes a rehire whose prior completed employment period lasted at least one year', () => {
  const employee = normalizeEmployee({
    _id: 'employee-rehire-qualified',
    'First Name': 'Rehire',
    'Last Name': 'Qualified',
    'Hire Date': '2026-09-01',
  }, null, [], [], [{
    employeeSnapshot: {
      'Hire Date': '2022-04-10',
      'Termination Date': '2024-06-15',
    },
  }]);

  assert.equal(employee.priorServiceQualifiedForSafetyPto, true);
});

test('does not waive the one-year requirement when prior rehire service was shorter than one year', () => {
  const employee = normalizeEmployee({
    _id: 'employee-rehire-not-qualified',
    'First Name': 'Rehire',
    'Last Name': 'New',
    'Hire Date': '2026-09-01',
  }, null, [], [], [{
    employeeSnapshot: {
      'Hire Date': '2025-01-10',
      'Termination Date': '2025-08-15',
    },
  }]);

  assert.equal(employee.priorServiceQualifiedForSafetyPto, false);
  assert.equal(completedAtLeastOneYear({ 'Hire Date': '2024-02-29', 'Termination Date': '2025-02-28' }), true);
});

test('uses explicitly recorded previous rehire dates before archived onboarding history', () => {
  const employee = normalizeEmployee({
    _id: 'employee-explicit-rehire',
    'First Name': 'Explicit',
    'Last Name': 'Rehire',
    'Hire Date': '2026-09-01',
    'Is Rehire': true,
    'Previous Hire Date': '2021-03-15',
    'Previous Termination Date': '2024-04-01',
  });

  assert.equal(explicitPriorServiceQualified({
    'Is Rehire': true,
    'Previous Hire Date': '2021-03-15',
    'Previous Termination Date': '2024-04-01',
  }), true);
  assert.equal(employee.priorServiceQualifiedForSafetyPto, true);
});
