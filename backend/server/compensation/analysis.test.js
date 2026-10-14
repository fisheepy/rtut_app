const test = require('node:test');
const assert = require('node:assert/strict');
const { getCompensationGrossPayAnalysis } = require('./analysis');

test('gross pay analysis covers the current roster and reconciles location populations', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.equal(analysis.overall.population, 208);
  assert.equal(analysis.overall.analyzed, 203);
  assert.equal(analysis.overall.noHistory, 5);
  assert.equal(analysis.annualizedEmployees, 14);
  assert.equal(analysis.insufficientHistoryEmployees, 2);
  assert.equal(analysis.locations.reduce((sum, row) => sum + row.population, 0), 208);
  assert.equal(analysis.locations.reduce((sum, row) => sum + row.analyzed, 0), 203);
});

test('annualized gross pay analysis identifies its estimation method', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.match(analysis.basis, /annualized by covered employment days/i);
  assert.equal(analysis.overall.average, 83003.45);
});

test('hourly and salary populations reconcile to the current roster', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.deepEqual(analysis.payTypes.map((row) => row.payType), ['Hourly', 'Salary']);
  assert.equal(analysis.payTypes.reduce((sum, row) => sum + row.overall.population, 0), 208);
  assert.equal(analysis.payTypes.reduce((sum, row) => sum + row.overall.analyzed, 0), 203);
  for (const payType of analysis.payTypes) {
    assert.equal(payType.locations.reduce((sum, row) => sum + row.population, 0), payType.overall.population);
    assert.equal(payType.locations.reduce((sum, row) => sum + row.analyzed, 0), payType.overall.analyzed);
  }
  const salary = analysis.payTypes.find((row) => row.payType === 'Salary');
  assert.ok(salary);
  assert.equal(salary.jobTitles.reduce((sum, row) => sum + row.population, 0), 74);
  assert.equal(salary.jobTitles.reduce((sum, row) => sum + row.analyzed, 0), 74);
  assert.equal(salary.regularPay.population, 74);
  assert.equal(salary.regularPay.analyzed, 72);
  assert.equal(salary.regularPay.noHistory, 2);
  assert.equal(salary.regularPay.average, 106975.68);
  assert.equal(salary.regularPay.max, 420000);
});

test('gross pay percentiles are ordered for every population', () => {
  const analysis = getCompensationGrossPayAnalysis();
  for (const row of [analysis.overall, ...analysis.locations]) {
    assert.ok(row.min <= row.p25);
    assert.ok(row.p25 <= row.median);
    assert.ok(row.median <= row.p75);
    assert.ok(row.p75 <= row.max);
  }
});
