const test = require('node:test');
const assert = require('node:assert/strict');
const { NOVEMBER_1_2026_SALARY_CHANGES } = require('./novemberSalaryBackfill');

test('confirmed November 1 salary list is complete and unique', () => {
  assert.equal(NOVEMBER_1_2026_SALARY_CHANGES.length, 28);
  assert.equal(new Set(NOVEMBER_1_2026_SALARY_CHANGES.map(item => item.name.toLowerCase())).size, 28);
  assert.ok(NOVEMBER_1_2026_SALARY_CHANGES.every(item => item.annualSalary > 0));
});

test('confirmed executive salaries retain the approved values', () => {
  const salary = name => NOVEMBER_1_2026_SALARY_CHANGES.find(item => item.name === name)?.annualSalary;
  assert.equal(salary('Ken Bumgardner'), 420000);
  assert.equal(salary('Julie Igielski'), 262500);
  assert.equal(salary('Myra Yu'), 135000);
  assert.equal(salary('Scott Chapman'), 103000);
});
