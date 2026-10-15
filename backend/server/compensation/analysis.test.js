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

test('hourly and salary populations reconcile after the approved hourly exclusion', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.deepEqual(analysis.payTypes.map((row) => row.payType), ['Hourly', 'Salary']);
  assert.equal(analysis.payTypes.reduce((sum, row) => sum + row.overall.population, 0), 207);
  assert.equal(analysis.payTypes.reduce((sum, row) => sum + row.overall.analyzed, 0), 202);
  for (const payType of analysis.payTypes) {
    assert.equal(payType.locations.reduce((sum, row) => sum + row.population, 0), payType.overall.population);
    assert.equal(payType.locations.reduce((sum, row) => sum + row.analyzed, 0), payType.overall.analyzed);
  }
  const salary = analysis.payTypes.find((row) => row.payType === 'Salary');
  const hourly = analysis.payTypes.find((row) => row.payType === 'Hourly');
  assert.ok(hourly);
  assert.equal(hourly.overall.population, 133);
  assert.equal(hourly.overall.analyzed, 128);
  assert.equal(hourly.overall.max, 106495.28);
  assert.equal(hourly.hourlyRate.population, 133);
  assert.equal(hourly.hourlyRate.analyzed, 131);
  assert.equal(hourly.hourlyRate.noHistory, 2);
  assert.equal(hourly.hourlyRate.median, 25);
  assert.equal(hourly.hourlyRate.average, 25.05);
  assert.equal(hourly.hourlyRate.max, 32);
  assert.equal(hourly.jobTitlesHourlyRate.reduce((sum, row) => sum + row.population, 0), 133);
  assert.equal(hourly.jobTitlesHourlyRate.reduce((sum, row) => sum + row.analyzed, 0), 131);
  assert.equal(hourly.jobTitlesAnnualGross.reduce((sum, row) => sum + row.population, 0), 133);
  assert.equal(hourly.jobTitlesAnnualGross.reduce((sum, row) => sum + row.analyzed, 0), 128);
  assert.equal(hourly.jobTitlesHourlyRate.some((row) => row.jobTitle === 'Project Manager'), false);
  assert.equal(hourly.jobTitlesAnnualGross.some((row) => row.jobTitle === 'Project Manager'), false);
  assert.equal(hourly.jobTitlesHourlyRate.find((row) => row.jobTitle === 'Trailer Mechanic / Technician').median, 27);
  assert.equal(hourly.jobTitlesAnnualGross.find((row) => row.jobTitle === 'Trailer Mechanic / Technician').average, 66843.36);
  assert.ok(salary);
  assert.equal(salary.jobTitles.reduce((sum, row) => sum + row.population, 0), 74);
  assert.equal(salary.jobTitles.reduce((sum, row) => sum + row.analyzed, 0), 74);
  assert.equal(salary.regularPay.population, 74);
  assert.equal(salary.regularPay.analyzed, 72);
  assert.equal(salary.regularPay.noHistory, 2);
  assert.equal(salary.regularPay.average, 106975.68);
  assert.equal(salary.regularPay.max, 420000);
  assert.equal(salary.jobTitlesRegularPay.reduce((sum, row) => sum + row.population, 0), 74);
  assert.equal(salary.jobTitlesRegularPay.reduce((sum, row) => sum + row.analyzed, 0), 72);
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

test('employee-level salary data is complete and includes confirmed current salaries', () => {
  const analysis = getCompensationGrossPayAnalysis();
  assert.equal(analysis.salaryEmployees.length, 74);
  assert.equal(new Set(analysis.salaryEmployees.map((employee) => employee.id)).size, 74);
  assert.equal(analysis.salaryEmployees.filter((employee) => employee.regularPay != null).length, 72);
  assert.ok(analysis.salaryEmployees.every((employee) => employee.jobFamily && employee.grossPay > 0));
  assert.equal(analysis.salaryEmployees.find((employee) => employee.name === 'Levi Nation').regularPay, 100000);
  assert.equal(analysis.salaryEmployees.find((employee) => employee.name === 'Xuan Yu').regularPay, 135000);
});
