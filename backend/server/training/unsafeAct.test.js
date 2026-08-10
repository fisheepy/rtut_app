const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeUnsafeActs } = require('./unsafeAct');

test('sanitizes and sorts unsafe act records newest first', () => {
  const result = sanitizeUnsafeActs([
    { writeUpDate: '2026-01-02', description: 'First', documentationLink: 'https://royaltruck.sharepoint.com/first', repeated: 'No' },
    { writeUpDate: '2026-02-02', description: 'Repeat', documentationLink: 'https://royaltruck-my.sharepoint.com/repeat', repeated: 'Yes', lastSameUnsafeActDate: '2026-01-02' },
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.records[0].description, 'Repeat');
  assert.equal(result.records[0].repeated, true);
});

test('requires the earlier matching date for a repeated unsafe act', () => {
  const result = sanitizeUnsafeActs([{ writeUpDate: '2026-02-02', description: 'Repeat', documentationLink: 'https://royaltruck.sharepoint.com/repeat', repeated: 'Yes' }]);
  assert.match(result.error, /last same unsafe act date/i);
});

test('requires an explicit repeated unsafe act answer', () => {
  const result = sanitizeUnsafeActs([{ writeUpDate: '2026-02-02', description: 'Act', documentationLink: 'https://royaltruck.sharepoint.com/act' }]);
  assert.match(result.error, /confirm whether/i);
});

test('limits a repeated write-up reference to the current or previous year', () => {
  const result = sanitizeUnsafeActs([{ writeUpDate: '2026-02-02', description: 'Repeat', documentationLink: 'https://royaltruck.sharepoint.com/repeat', repeated: 'Yes', lastSameUnsafeActDate: '2024-12-31' }]);
  assert.match(result.error, /current year or previous year/i);
});
