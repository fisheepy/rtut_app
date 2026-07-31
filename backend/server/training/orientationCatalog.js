const { randomUUID } = require('node:crypto');

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeDefaultLibrary(id, name, accessCode, courses) {
  return {
    id,
    name,
    link: '',
    accessCode,
    courses: courses.map((title) => ({ id: slug(title), title })),
  };
}

const ORIENTATION_LIBRARIES = [
  makeDefaultLibrary('warehouse-parts', 'New Onboarding - Warehouse/Parts', '8SDFDFC5', [
    'Back Safety: Avoiding Back Injuries', 'Forklift Operator Safety', 'Ladder Safety',
    'New Employee Safety Orientation', 'Preventing Slips Trips and Falls - A Guide for Employees',
    'Warehouse Safety', 'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('technician', 'New Onboarding - Technician', 'Y3P3K9NP', [
    'Eye Protection', 'Hand Protection', 'Ladder Safety', 'New Employee Safety Orientation',
    'PPE - Foot Protection', 'Preventing Slips Trips and Falls - A Guide for Employees',
    'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('sales', 'New Onboarding - Sales', 'BVS2HULQ', [
    "Don't Drive Distracted", 'New Employee Safety Orientation', 'Business Ethics - What Employees Need to Know',
    'Communicating Through Social Media', 'Preventing Sexual Harassment - A Guide for Employees',
    'Telephone Etiquette', 'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('office', 'New Onboarding - Office', 'UKO4Z4GD', [
    'New Employee Safety Orientation', 'Office Ergonomics', 'Office Hazards',
    'Business Ethics - What Employees Need to Know', 'Communication Skills for Employees',
    'Time Management Skills for Employees', 'Workplace Diversity for Employees',
    'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('cmv-driver', 'New Onboarding - CMV Driver', 'GTPO8MM5', [
    'CMV - Accident Procedures', 'CMV - Inspections', 'CMV - Safe Vehicle Entry and Exit',
    'Defensive Driving - Commercial Motor Vehicles', 'New Employee Safety Orientation',
    'Substance Abuse - What Employees Need to Know', 'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('maintenance-janitorial', 'New Onboarding - Maintenance/Janitorial', 'G3T6ETDO', [
    'Back Safety: Avoiding Back Injuries', 'Good Housekeeping', 'Hand Protection',
    'New Employee Safety Orientation', 'Preventing Slips Trips and Falls - A Guide for Employees',
    'Workplace Harassment - What Employees Need to Know',
  ]),
  makeDefaultLibrary('management', 'New Onboarding - Management', 'PNS9HPSK', [
    'New Employee Safety Orientation', 'Crash Course in Leadership Skills',
    'Diversity Fundamentals for Supervisors', 'Preventing Sexual Harassment - A Guide for Supervisors',
    'Reasonable Suspicion and Responding to Substance Abuse for Supervisors',
    'Workplace Harassment - What Employees Need to Know', 'Workplace Violence - Supervisors',
  ]),
];

function normalizeLibrary(library) {
  return {
    id: String(library.id),
    name: String(library.name || '').trim(),
    link: String(library.link || '').trim(),
    accessCode: String(library.accessCode || '').trim(),
    courses: (Array.isArray(library.courses) ? library.courses : []).map((course, index) => (
      typeof course === 'string'
        ? { id: slug(course) || `course-${index + 1}`, title: course.trim() }
        : { id: String(course.id || randomUUID()), title: String(course.title || '').trim() }
    )).filter((course) => course.title),
  };
}

async function getOrientationLibraries(db) {
  const collection = db.collection('orientation_libraries');
  const settings = db.collection('training_settings');
  const catalogSettings = await settings.findOne({ id: 'orientation-catalog' });
  if (!catalogSettings?.initialized) {
    await collection.bulkWrite(ORIENTATION_LIBRARIES.map((library, order) => ({
      updateOne: {
        filter: { id: library.id },
        update: { $setOnInsert: { ...library, order } },
        upsert: true,
      },
    })));
    await settings.updateOne(
      { id: 'orientation-catalog' },
      { $set: { initialized: true, initializedAt: new Date() } },
      { upsert: true },
    );
  }
  return (await collection.find({}).sort({ order: 1, name: 1 }).toArray()).map(normalizeLibrary);
}

function validateLibraryInput(body, existingLibrary = null) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'Library name is required.' };
  const link = String(body?.link || '').trim();
  if (link) {
    try {
      if (new URL(link).protocol !== 'https:') return { error: 'Library link must use HTTPS.' };
    } catch (_error) {
      return { error: 'Please enter a valid library link.' };
    }
  }
  const existingCourseIds = new Set((existingLibrary?.courses || []).map((course) => course.id));
  const courses = (Array.isArray(body?.courses) ? body.courses : [])
    .map((course) => ({
      id: existingCourseIds.has(String(course?.id)) ? String(course.id) : randomUUID(),
      title: String(course?.title || '').trim(),
    }))
    .filter((course) => course.title);
  if (!courses.length) return { error: 'Add at least one training course.' };
  return {
    library: {
      id: existingLibrary?.id || randomUUID(),
      name,
      link,
      accessCode: String(body?.accessCode || '').trim(),
      courses,
    },
  };
}

function courseKey(libraryId, courseId) {
  return `${libraryId}:${courseId}`;
}

function normalizeOrientation(record, libraries = ORIENTATION_LIBRARIES) {
  const source = record?.orientation || {};
  const libraryById = new Map(libraries.map((library) => [library.id, normalizeLibrary(library)]));
  const assignedLibraryIds = Array.from(new Set(
    (Array.isArray(source.assignedLibraryIds) ? source.assignedLibraryIds : [])
      .filter((id) => libraryById.has(id)),
  ));
  const storedProgress = source.courseProgress && typeof source.courseProgress === 'object'
    ? source.courseProgress
    : {};
  const courseProgress = {};
  const completionDates = [];
  let requiredCourseCount = 0;
  let completedCourseCount = 0;

  for (const libraryId of assignedLibraryIds) {
    const library = libraryById.get(libraryId);
    library.courses.forEach((course, courseIndex) => {
      const key = courseKey(libraryId, course.id);
      const progress = storedProgress[key] || storedProgress[`${libraryId}:${courseIndex}`] || {};
      const completedAt = typeof progress.completedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(progress.completedAt)
        ? progress.completedAt
        : null;
      const folderUpdated = progress.folderUpdated === true;
      courseProgress[key] = { completedAt, folderUpdated };
      requiredCourseCount += 1;
      if (completedAt && folderUpdated) {
        completedCourseCount += 1;
        completionDates.push(completedAt);
      }
    });
  }

  const status = !assignedLibraryIds.length
    ? 'Unassigned'
    : completedCourseCount === requiredCourseCount
      ? 'Finished'
      : 'In Process';

  return {
    status,
    completedAt: status === 'Finished' ? completionDates.sort().at(-1) || null : null,
    assignedLibraryIds,
    courseProgress,
    completedCourseCount,
    requiredCourseCount,
  };
}

function sanitizeOrientationInput(body, libraries = ORIENTATION_LIBRARIES) {
  return normalizeOrientation({
    orientation: {
      assignedLibraryIds: body?.assignedLibraryIds,
      courseProgress: body?.courseProgress,
    },
  }, libraries);
}

module.exports = {
  ORIENTATION_LIBRARIES,
  courseKey,
  getOrientationLibraries,
  normalizeOrientation,
  sanitizeOrientationInput,
  validateLibraryInput,
};
