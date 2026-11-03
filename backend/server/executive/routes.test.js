const test = require('node:test');
const assert = require('node:assert/strict');
const { compensationRecord, employmentChangeIncomplete, findEmployeeMatches, findLocationMatch, locationEmployeeDetails } = require('./routes');

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

test('recognizes a location in a natural-language employee question', () => {
  const employees = [
    { Location: 'Dearborn' },
    { Location: 'Grand Rapids' },
  ];
  assert.equal(findLocationMatch(employees, 'Show me all employees at Dearborn'), 'Dearborn');
  assert.equal(findLocationMatch(employees, 'How many people work in Grand Rapids?'), 'Grand Rapids');
});

test('formats the location employee list with useful executive details', () => {
  const detail = locationEmployeeDetails({
    'First Name': 'Alex',
    'Last Name': 'Example',
    'Job Title': 'Service Manager',
    'Home Department': 'Service',
    'Position Status': 'Active',
    'Pay Category': 'Salary',
  });
  assert.equal(detail, 'Alex Example — Service Manager | Service | Active | Salary');
});
