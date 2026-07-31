const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ORIENTATION_LIBRARIES,
  courseKey,
  normalizeOrientation,
  sanitizeOrientationInput,
} = require('./orientationCatalog');

test('contains all seven orientation libraries and their access codes', () => {
  assert.equal(ORIENTATION_LIBRARIES.length, 7);
  assert.equal(ORIENTATION_LIBRARIES.find((library) => library.id === 'technician').accessCode, 'Y3P3K9NP');
  assert.equal(ORIENTATION_LIBRARIES.find((library) => library.id === 'management').courses.length, 7);
});

test('marks orientation as unassigned when no library is selected', () => {
  const orientation = normalizeOrientation();
  assert.equal(orientation.status, 'Unassigned');
  assert.equal(orientation.requiredCourseCount, 0);
});

test('marks an assigned but incomplete orientation as in process', () => {
  const orientation = sanitizeOrientationInput({
    assignedLibraryIds: ['maintenance-janitorial'],
    courseProgress: {},
  });
  assert.equal(orientation.status, 'In Process');
  assert.equal(orientation.requiredCourseCount, 6);
  assert.equal(orientation.completedCourseCount, 0);
});

test('marks orientation as finished only when every course has a date and folder update', () => {
  const library = ORIENTATION_LIBRARIES.find((item) => item.id === 'maintenance-janitorial');
  const courseProgress = Object.fromEntries(library.courses.map((_course, index) => [
    courseKey(library.id, index),
    { completedAt: `2026-07-${String(index + 1).padStart(2, '0')}`, folderUpdated: true },
  ]));
  const orientation = sanitizeOrientationInput({
    assignedLibraryIds: [library.id],
    courseProgress,
  });

  assert.equal(orientation.status, 'Finished');
  assert.equal(orientation.completedCourseCount, library.courses.length);
  assert.equal(orientation.completedAt, '2026-07-06');
});

test('ignores unknown libraries and progress entries', () => {
  const orientation = sanitizeOrientationInput({
    assignedLibraryIds: ['unknown'],
    courseProgress: {
      'unknown:0': { completedAt: '2026-07-01', folderUpdated: true },
    },
  });
  assert.deepEqual(orientation.assignedLibraryIds, []);
  assert.deepEqual(orientation.courseProgress, {});
});
