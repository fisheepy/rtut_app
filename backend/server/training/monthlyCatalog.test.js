const test = require('node:test');
const assert = require('node:assert/strict');
const { employeeMatchesAssignmentCriteria, normalizeMonthly, sanitizeMonthlyInput, validateTopicInput } = require('./monthlyCatalog');

const topic = {
  id: 'topic-1',
  name: 'August Safety Training',
  targetDate: '2026-08-31',
  link: 'https://example.com/training',
  accessCode: 'AUG2026',
  courses: [{ id: 'course-1', title: 'Heat Safety' }],
};

test('new monthly topics appear as unassigned for every employee', () => {
  const monthly = normalizeMonthly(null, [topic]);
  assert.equal(monthly.status, 'Unassigned');
  assert.equal(monthly.assignments[0].requirement, 'Unassigned');
});

test('required monthly training defaults to unfinished', () => {
  const result = sanitizeMonthlyInput({ topicAssignments: { 'topic-1': { requirement: 'Required' } } }, [topic]);
  assert.equal(result.monthly.status, 'In Process');
  assert.equal(result.monthly.assignments[0].completionStatus, 'Unfinished');
});

test('finished monthly training requires and keeps a completion date', () => {
  const missingDate = sanitizeMonthlyInput({ topicAssignments: {
    'topic-1': { requirement: 'Required', completionStatus: 'Finished' },
  } }, [topic]);
  assert.match(missingDate.error, /completion date/);

  const result = sanitizeMonthlyInput({ topicAssignments: {
    'topic-1': { requirement: 'Required', completionStatus: 'Finished', completionDate: '2026-08-15', folderUpdated: true },
  } }, [topic]);
  assert.equal(result.monthly.status, 'Finished');
  assert.equal(result.monthly.completedAt, '2026-08-15');
  assert.equal(result.monthly.assignments[0].folderUpdated, true);
});

test('not required blocks completion fields', () => {
  const result = sanitizeMonthlyInput({ topicAssignments: {
    'topic-1': { requirement: 'Not Required', completionStatus: 'Finished', completionDate: '2026-08-15', folderUpdated: true },
  } }, [topic]);
  const assignment = result.monthly.assignments[0];
  assert.equal(assignment.completionStatus, 'Unfinished');
  assert.equal(assignment.completionDate, null);
  assert.equal(assignment.folderUpdated, false);
});

test('assigned monthly topic snapshot survives catalog edits and deletion', () => {
  const firstSave = sanitizeMonthlyInput({ topicAssignments: { 'topic-1': { requirement: 'Required' } } }, [topic]);
  const existingRecord = { monthly: { topicAssignments: firstSave.topicAssignments } };
  const changedTopic = { ...topic, name: 'Changed Name', courses: [...topic.courses, { id: 'course-2', title: 'New Course' }] };
  const secondSave = sanitizeMonthlyInput({ topicAssignments: { 'topic-1': { requirement: 'Required' } } }, [changedTopic], existingRecord);
  const afterDeletion = normalizeMonthly({ monthly: { topicAssignments: secondSave.topicAssignments } }, []);
  assert.equal(secondSave.monthly.assignments[0].topic.name, topic.name);
  assert.equal(afterDeletion.assignments[0].topic.courses.length, 1);
});

test('validates monthly topic fields', () => {
  assert.match(validateTopicInput({ name: '', courses: [] }).error, /name/);
  assert.match(validateTopicInput({ name: 'Topic', link: 'http://example.com', courses: [{ title: 'Course' }] }).error, /HTTPS/);
  assert.equal(validateTopicInput({ name: 'Topic', targetDate: '2026-08-31', courses: [{ title: 'Course' }] }).topic.name, 'Topic');
});

test('matches active employees using selected job titles and locations', () => {
  const criteria = { jobTitles: ['Technician', 'Driver'], locations: ['Detroit'] };
  assert.equal(employeeMatchesAssignmentCriteria({ employmentStatus: 'Active', jobTitle: 'Technician', location: 'Detroit' }, criteria), true);
  assert.equal(employeeMatchesAssignmentCriteria({ employmentStatus: 'Active', jobTitle: 'Technician', location: 'Lansing' }, criteria), false);
  assert.equal(employeeMatchesAssignmentCriteria({ employmentStatus: 'Terminated', jobTitle: 'Technician', location: 'Detroit' }, criteria), false);
  assert.equal(employeeMatchesAssignmentCriteria({ employmentStatus: 'Active', jobTitle: 'Technician', location: 'Detroit' }, {}), false);
});
