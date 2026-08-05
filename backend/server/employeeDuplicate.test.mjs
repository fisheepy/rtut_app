import test from 'node:test';
import assert from 'node:assert/strict';
import { employeeMatchReasons } from './employeeDuplicate.mjs';

test('does not treat two blank phones or emails as a match', () => {
  assert.deepEqual(employeeMatchReasons(
    { 'First Name': 'Former', 'Last Name': 'Employee', Phone: '', Email: '' },
    { firstName: 'New', lastName: 'Employee', phone: '', email: '' },
  ), []);
});

test('reports each reliable non-empty match reason', () => {
  assert.deepEqual(employeeMatchReasons(
    { 'First Name': 'Test', 'Last Name': 'Person', Phone: '(313) 555-0100', Email: 'TEST@EXAMPLE.COM' },
    { firstName: ' test ', lastName: 'person', phone: '3135550100', email: 'test@example.com' },
  ), ['name', 'phone', 'email']);
});

test('a phone match alone is detectable for explicit admin confirmation', () => {
  assert.deepEqual(employeeMatchReasons(
    { 'First Name': 'Former', 'Last Name': 'Employee', Phone: '3135550100', Email: 'former@example.com' },
    { firstName: 'New', lastName: 'Employee', phone: '313-555-0100', email: 'new@example.com' },
  ), ['phone']);
});
