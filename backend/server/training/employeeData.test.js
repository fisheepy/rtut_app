const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmployee } = require('./employeeData');

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
  assert.equal(employee.training.monthly.status, 'Not started');
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
  assert.equal(employee.training.monthly.status, 'Not started');
});
