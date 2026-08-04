const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildEarliestAcceptanceMap,
  employeeForExport,
  resolveAppRegistrationDate,
} = require('./registrationDate');

test('uses the canonical date, then legacy registration date, then earliest disclaimer acceptance', () => {
  const acceptances = buildEarliestAcceptanceMap([
    { username: 'JSmith', accepted: true, timestamp: '2025-02-03T12:00:00Z' },
    { username: 'jsmith', accepted: true, timestamp: '2025-01-02T12:00:00Z' },
  ]);
  assert.equal(resolveAppRegistrationDate({ username: 'JSMITH' }, acceptances).toISOString(), '2025-01-02T12:00:00.000Z');
  assert.equal(resolveAppRegistrationDate({ username: 'jsmith', activationDate: '2025-03-04T12:00:00Z' }, acceptances).toISOString(), '2025-03-04T12:00:00.000Z');
  assert.equal(resolveAppRegistrationDate({ 'App Registration Date': '2025-04-05T12:00:00Z', activationDate: '2025-03-04T12:00:00Z' }, acceptances).toISOString(), '2025-04-05T12:00:00.000Z');
});

test('does not export the misleading import date or legacy field', () => {
  const exported = employeeForExport({
    _id: 'employee-1',
    'Activation Date': '2024-11-15T04:03:18Z',
    activationDate: '2025-01-02T12:00:00Z',
  }, new Date('2025-01-02T12:00:00Z'));
  assert.equal(exported['Activation Date'], undefined);
  assert.equal(exported.activationDate, undefined);
  assert.equal(exported['App Registration Date'].toISOString(), '2025-01-02T12:00:00.000Z');
});
