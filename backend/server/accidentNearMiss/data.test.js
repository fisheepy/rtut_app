const test = require('node:test');
const assert = require('node:assert/strict');
const { eventStatus, sanitizeEventInput } = require('./data');

test('sanitizes an accident with optional costs and follow-up work', () => {
  const result = sanitizeEventInput({ eventType: 'Accident', eventDateTime: '2026-08-07T09:30', reportedDate: '2026-08-07', location: 'Dearborn', eventNature: 'Property Damage', description: 'Trailer contacted a door', reportReceived: 'Yes', reportLink: 'https://royaltruck.sharepoint.com/report', costInvolved: 'Yes', estimatedCost: '250', followUps: [{ description: 'Inspect door', dueDate: '2026-08-10', completed: false }] });
  assert.equal(result.error, undefined);
  assert.equal(result.value.estimatedCost, 250);
  assert.equal(eventStatus(result.value), 'Open - Follow-up Required');
});

test('allows a near miss without cost or follow-up', () => {
  const result = sanitizeEventInput({ eventType: 'Near Miss', eventDateTime: '2026-08-07T09:30', reportedDate: '2026-08-07', location: 'Flint', eventNature: 'Safety Hazard', description: 'Blocked aisle observed', reportReceived: 'No', costInvolved: 'No' });
  assert.equal(result.error, undefined);
  assert.equal(result.value.finalCost, null);
  assert.equal(eventStatus(result.value), 'Open');
});

test('requires report link when a report was received', () => {
  const result = sanitizeEventInput({ eventType: 'Accident', eventDateTime: '2026-08-07T09:30', reportedDate: '2026-08-07', location: 'Flint', eventNature: 'Vehicle', description: 'Minor collision', reportReceived: 'Yes', costInvolved: 'No' });
  assert.match(result.error, /Report or Folder Link/);
});
