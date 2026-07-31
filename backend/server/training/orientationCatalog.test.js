const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ORIENTATION_LIBRARIES,
  courseKey,
  normalizeOrientation,
  sanitizeOrientationInput,
  validateLibraryInput,
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
  const courseProgress = Object.fromEntries(library.courses.map((course, index) => [
    courseKey(library.id, course.id),
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

test('migrates existing index-based course progress to stable course IDs', () => {
  const orientation = normalizeOrientation({
    orientation: {
      assignedLibraryIds: ['warehouse-parts'],
      courseProgress: {
        'warehouse-parts:0': { completedAt: '2026-07-01', folderUpdated: true },
      },
    },
  });
  const firstCourse = ORIENTATION_LIBRARIES[0].courses[0];
  assert.deepEqual(orientation.courseProgress[courseKey('warehouse-parts', firstCourse.id)], {
    completedAt: '2026-07-01',
    folderUpdated: true,
  });
});

test('keeps an assigned library snapshot unchanged when the catalog is edited or deleted', () => {
  const assignedLibrary = ORIENTATION_LIBRARIES.find((library) => library.id === 'maintenance-janitorial');
  const courseProgress = Object.fromEntries(assignedLibrary.courses.map((course) => [
    courseKey(assignedLibrary.id, course.id),
    { completedAt: '2026-07-01', folderUpdated: true },
  ]));
  const existingRecord = {
    orientation: {
      assignedLibraryIds: [assignedLibrary.id],
      assignedLibraries: [assignedLibrary],
      courseProgress,
    },
  };
  const changedCatalog = [{
    ...assignedLibrary,
    name: 'Changed Name',
    courses: [...assignedLibrary.courses, { id: 'new-course', title: 'New Course' }],
  }];

  const saved = sanitizeOrientationInput({
    assignedLibraryIds: [assignedLibrary.id],
    courseProgress,
  }, changedCatalog, existingRecord);
  const afterCatalogDeletion = normalizeOrientation({ orientation: saved }, []);

  assert.equal(saved.assignedLibraries[0].name, assignedLibrary.name);
  assert.equal(saved.requiredCourseCount, assignedLibrary.courses.length);
  assert.equal(saved.status, 'Finished');
  assert.equal(afterCatalogDeletion.status, 'Finished');
  assert.equal(afterCatalogDeletion.assignedLibraries[0].courses.length, assignedLibrary.courses.length);
});

test('validates editable library details and preserves existing course IDs', () => {
  const existing = ORIENTATION_LIBRARIES[0];
  const result = validateLibraryInput({
    name: 'Updated Warehouse Library',
    link: 'https://example.com/orientation',
    accessCode: 'NEWCODE',
    courses: [
      { id: existing.courses[0].id, title: 'Updated Back Safety' },
      { title: 'New Course' },
    ],
  }, existing);

  assert.equal(result.library.id, existing.id);
  assert.equal(result.library.courses[0].id, existing.courses[0].id);
  assert.equal(result.library.courses[1].title, 'New Course');
});

test('rejects an invalid library link or an empty course list', () => {
  assert.match(validateLibraryInput({ name: 'Library', link: 'http://example.com', courses: [{ title: 'Course' }] }).error, /HTTPS/);
  assert.match(validateLibraryInput({ name: 'Library', courses: [] }).error, /at least one/);
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
