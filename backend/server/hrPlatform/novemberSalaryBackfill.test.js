const test = require('node:test');
const assert = require('node:assert/strict');
const { NOVEMBER_1_2026_SALARY_CHANGES, findEmployeeForSalaryTarget, ensureNovemberSalaryEmploymentChanges } = require('./novemberSalaryBackfill');
const roster = require('../executive/turnoverQ3EmployeeBase.json');

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

test('Tommy Westfall uses the confirmed September effective date', () => {
  const tommy = NOVEMBER_1_2026_SALARY_CHANGES.find(item => item.name === 'Tommy Westfall');
  assert.equal(tommy?.effectiveDate, '2026-09-16');
});

test('Ken Bumgardner includes the formal Company App name', () => {
  const target = NOVEMBER_1_2026_SALARY_CHANGES.find(item => item.name === 'Ken Bumgardner');
  assert.equal(findEmployeeForSalaryTarget(target, roster)?.name, 'Kenneth Carl Bumgardner');
});

test('every confirmed salary employee resolves to the formal roster name', () => {
  const missing = NOVEMBER_1_2026_SALARY_CHANGES.filter(target => !findEmployeeForSalaryTarget(target, roster)).map(target => target.name);
  assert.deepEqual(missing, []);
});

test('moves the system-created Tommy record from November 1 to September 16', async () => {
  const employees = [{ _id: 'tommy-id', 'First Name': 'Thomas', 'Last Name': 'Westfall', Email: 'tommy@example.com', 'Pay Category': 'Salary' }];
  const changes = [{
    _id: 'change-id', employeeId: 'tommy-id', effectiveDate: '2026-11-01', historicalBackfill: true,
    requestedPayRate: { type: 'Annual Salary', amount: 130000 }, requestedTracking: { payroll: true }, changes: [], tasks: {},
  }];
  const collection = records => ({
    find: () => ({ toArray: async () => records }),
    updateOne: async ({ _id }, update) => Object.assign(records.find(record => record._id === _id), update.$set),
    deleteOne: async ({ _id }) => { const index = records.findIndex(record => record._id === _id); if (index >= 0) records.splice(index, 1); },
    insertOne: async record => records.push(record),
  });
  const db = { collection: name => name === 'employees' ? collection(employees) : collection(changes) };
  await ensureNovemberSalaryEmploymentChanges(db);
  const corrected = changes.find(record => record.employeeId === 'tommy-id');
  assert.equal(corrected?.effectiveDate, '2026-09-16');
  assert.equal(corrected?.tasks?.file?.required, false);
  assert.equal(corrected?.tasks?.file?.finalReviewedAt, null);
  assert.equal(corrected?.tasks?.payroll?.finalReviewedAt?.toISOString().slice(0, 10), '2026-09-16');
  assert.equal(corrected?.salaryHistoryVersion, 2);
});

test('sets November salary payroll work to November 20 once and preserves later admin edits', async () => {
  const employees = [{ _id: 'stratos-id', 'First Name': 'Stratos', 'Last Name': 'Dallis', Email: 'stratos@example.com', 'Pay Category': 'Salary' }];
  const changes = [{
    _id: 'change-id', employeeId: 'stratos-id', effectiveDate: '2026-11-01', historicalBackfill: true,
    requestedPayRate: { type: 'Annual Salary', amount: 104750 }, requestedTracking: { payroll: true },
    changes: [], tasks: { file: { required: false, finalReviewedAt: new Date('2026-11-01T12:00:00Z') }, payroll: { required: true, applicable: true, actionDate: '2026-11-01', finalReviewedAt: new Date('2026-11-01T12:00:00Z') } },
  }];
  const collection = records => ({
    find: () => ({ toArray: async () => records }),
    updateOne: async ({ _id }, update) => Object.assign(records.find(record => record._id === _id), update.$set),
    deleteOne: async ({ _id }) => { const index = records.findIndex(record => record._id === _id); if (index >= 0) records.splice(index, 1); },
    insertOne: async record => records.push(record),
  });
  const db = { collection: name => name === 'employees' ? collection(employees) : collection(changes) };
  await ensureNovemberSalaryEmploymentChanges(db);
  const corrected = changes[0];
  assert.equal(corrected.tasks.payroll.actionDate, '2026-11-20');
  assert.equal(corrected.tasks.payroll.finalReviewedAt, null);
  corrected.tasks.payroll.actionDate = '2026-11-25';
  await ensureNovemberSalaryEmploymentChanges(db);
  assert.equal(corrected.tasks.payroll.actionDate, '2026-11-25');
});
