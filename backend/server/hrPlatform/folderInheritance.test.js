const test = require('node:test');
const assert = require('node:assert/strict');
const { findExistingEmployeeFolderUrl } = require('./folderInheritance');

function fakeDb(records = {}) {
  return {
    collection(name) {
      return {
        async findOne() { return records[name]?.[0] || null; },
        find() {
          return {
            sort() {
              return { limit() { return { async toArray() { return records[name] || []; } }; } };
            },
          };
        },
      };
    },
  };
}

test('uses the most recently saved employee folder link across HR workflows', async () => {
  const url = await findExistingEmployeeFolderUrl(fakeDb({
    employee_hr_platform: [{ employeeFolderUrl: 'https://example.com/new-hire', updatedAt: '2026-01-01' }],
    employee_hr_employment_change: [{ employeeFolderUrl: 'https://example.com/change', updatedAt: '2026-02-01' }],
    employee_hr_termination: [],
    employee_hr_leave: [],
  }), 'employee-1');
  assert.equal(url, 'https://example.com/change');
});

test('returns a New Hire folder when no later workflow has a saved link', async () => {
  const url = await findExistingEmployeeFolderUrl(fakeDb({
    employee_hr_platform: [{ employeeFolderUrl: ' https://example.com/new-hire ' }],
    employee_hr_employment_change: [],
    employee_hr_termination: [],
    employee_hr_leave: [],
  }), 'employee-1');
  assert.equal(url, 'https://example.com/new-hire');
});

test('uses the explicitly saved current link before workflow timestamps', async () => {
  const url = await findExistingEmployeeFolderUrl(fakeDb({
    employee_folder_links: [{ url: 'https://example.com/current' }],
    employee_hr_platform: [{ employeeFolderUrl: 'https://example.com/old', updatedAt: '2027-01-01' }],
    employee_hr_employment_change: [],
    employee_hr_termination: [],
    employee_hr_leave: [],
  }), 'employee-1');
  assert.equal(url, 'https://example.com/current');
});
