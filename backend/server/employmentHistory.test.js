const test = require('node:test');
const assert = require('node:assert/strict');
const { completedOneYear, validatePreviousEmployment } = require('./employmentHistory');

test('requires both previous employment dates for a rehire', () => {
  assert.throws(() => validatePreviousEmployment({
    isRehire: true,
    hireDate: '2026-09-01',
    previousHireDate: '2024-01-01',
  }), /Previous Hire Date and Previous Termination Date/);
});

test('rejects previous employment dates that are out of order', () => {
  assert.throws(() => validatePreviousEmployment({
    isRehire: 'yes',
    hireDate: '2026-09-01',
    previousHireDate: '2025-06-01',
    previousTerminationDate: '2025-05-01',
  }), /cannot be before/);
  assert.throws(() => validatePreviousEmployment({
    isRehire: 'yes',
    hireDate: '2026-09-01',
    previousHireDate: '2025-06-01',
    previousTerminationDate: '2026-10-01',
  }), /cannot be after the current Hire Date/);
});

test('recognizes a prior employment period of at least one year', () => {
  assert.equal(completedOneYear('2024-02-29', '2025-02-28'), true);
  assert.equal(completedOneYear('2025-01-10', '2025-12-31'), false);
});

test('clears previous dates for a non-rehire', () => {
  assert.deepEqual(validatePreviousEmployment({
    isRehire: 'no',
    previousHireDate: '2020-01-01',
    previousTerminationDate: '2022-01-01',
  }), { isRehire: false, previousHireDate: '', previousTerminationDate: '' });
});
