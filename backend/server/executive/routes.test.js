const test = require('node:test');
const assert = require('node:assert/strict');
const { compensationRecord, employmentChangeIncomplete, findEmployeeMatches } = require('./routes');

test('matches an employee full name without partial last-name collisions', () => {
  const employees = [
    { 'First Name': 'Ryan', 'Last Name': 'Russell' },
    { 'First Name': 'Ryan', 'Last Name': 'Russell Jr.' },
  ];
  assert.deepEqual(findEmployeeMatches(employees, 'What is Ryan Russell Jr. current pay rate?'), [employees[1]]);
});

test('finds known compensation snapshot data', () => {
  const result = compensationRecord('Cherie Lynch');
  assert.equal(result.payType, 'Salary');
  assert.equal(result.rate, 75000);
});

test('identifies unfinished employment-change tasks', () => {
  assert.equal(employmentChangeIncomplete({ tasks: { file: { required: true } } }), true);
  assert.equal(employmentChangeIncomplete({ tasks: { file: { required: true, finalReviewedAt: new Date() } } }), false);
});
