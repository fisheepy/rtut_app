const test = require('node:test');
const assert = require('node:assert/strict');
const { compensationRecord, employmentChangeIncomplete, findEmployeeMatches, findLocationMatch, locationEmployeeDetails } = require('./routes');
const { EXECUTIVE_TOOLS, createToolResolver, extractOutputText } = require('./smartAi');

test('matches an employee full name without partial last-name collisions', () => {
  const employees = [
    { 'First Name': 'Ryan', 'Last Name': 'Russell' },
    { 'First Name': 'Ryan', 'Last Name': 'Russell Jr.' },
  ];
  assert.deepEqual(findEmployeeMatches(employees, 'What is Ryan Russell Jr. current pay rate?'), [employees[1]]);
});

test('matches a unique employee by first name, last name, or a minor typo', () => {
  const employees = [
    { 'First Name': 'Cherie', 'Last Name': 'Lynch' },
    { 'First Name': 'Michael', 'Last Name': 'Davis' },
  ];
  assert.deepEqual(findEmployeeMatches(employees, 'Show me Cherie'), [employees[0]]);
  assert.deepEqual(findEmployeeMatches(employees, 'What is Lynch paid?'), [employees[0]]);
  assert.deepEqual(findEmployeeMatches(employees, 'Show me Cherrie Linch'), [employees[0]]);
});

test('returns candidate employees when a short name is ambiguous', () => {
  const employees = [
    { 'First Name': 'Michael', 'Last Name': 'Davis' },
    { 'First Name': 'Michael', 'Last Name': 'Morrison' },
    { 'First Name': 'Cherie', 'Last Name': 'Lynch' },
  ];
  assert.deepEqual(findEmployeeMatches(employees, 'Tell me about Michael'), [employees[0], employees[1]]);
});

test('matches an employee by a configured preferred-name alias', () => {
  const employees = [
    { 'First Name': 'Xuan', 'Last Name': 'Yu' },
    { 'First Name': 'Cherie', 'Last Name': 'Lynch' },
  ];
  assert.deepEqual(findEmployeeMatches(employees, 'What is Myra Yu paid?'), [employees[0]]);
  assert.deepEqual(findEmployeeMatches(employees, 'Show me Myra'), [employees[0]]);
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

test('uses strict read-only tool schemas', () => {
  for (const tool of EXECUTIVE_TOOLS) {
    assert.equal(tool.strict, true);
    assert.equal(tool.parameters.additionalProperties, false);
    assert.deepEqual(new Set(tool.parameters.required), new Set(Object.keys(tool.parameters.properties)));
  }
});

test('extracts text from a Responses API result', () => {
  assert.equal(extractOutputText({ output: [{ content: [{ type: 'output_text', text: 'Verified answer' }] }] }), 'Verified answer');
});

test('keeps location filters exact instead of merging Dearborn Warehouse into Dearborn', async () => {
  const employees = [
    { 'First Name': 'A', 'Last Name': 'One', Location: 'Dearborn', 'Position Status': 'Active' },
    { 'First Name': 'B', 'Last Name': 'Two', Location: 'Dearborn Warehouse', 'Position Status': 'Active' },
  ];
  const resolve = createToolResolver({ db: {}, employees, compensationRecord: () => null, employmentChangeIncomplete: () => false });
  const result = await resolve('search_employees', { name: null, location: 'Dearborn', department: null, jobTitle: null, manager: null, status: null, payType: null, limit: 100 });
  assert.equal(result.count, 1);
  assert.equal(result.employees[0].name, 'A One');
});
