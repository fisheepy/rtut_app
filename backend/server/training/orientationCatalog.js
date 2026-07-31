const ORIENTATION_LIBRARIES = [
  {
    id: 'warehouse-parts',
    name: 'New Onboarding - Warehouse/Parts',
    accessCode: '8SDFDFC5',
    courses: [
      'Back Safety: Avoiding Back Injuries',
      'Forklift Operator Safety',
      'Ladder Safety',
      'New Employee Safety Orientation',
      'Preventing Slips Trips and Falls - A Guide for Employees',
      'Warehouse Safety',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'technician',
    name: 'New Onboarding - Technician',
    accessCode: 'Y3P3K9NP',
    courses: [
      'Eye Protection',
      'Hand Protection',
      'Ladder Safety',
      'New Employee Safety Orientation',
      'PPE - Foot Protection',
      'Preventing Slips Trips and Falls - A Guide for Employees',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'sales',
    name: 'New Onboarding - Sales',
    accessCode: 'BVS2HULQ',
    courses: [
      "Don't Drive Distracted",
      'New Employee Safety Orientation',
      'Business Ethics - What Employees Need to Know',
      'Communicating Through Social Media',
      'Preventing Sexual Harassment - A Guide for Employees',
      'Telephone Etiquette',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'office',
    name: 'New Onboarding - Office',
    accessCode: 'UKO4Z4GD',
    courses: [
      'New Employee Safety Orientation',
      'Office Ergonomics',
      'Office Hazards',
      'Business Ethics - What Employees Need to Know',
      'Communication Skills for Employees',
      'Time Management Skills for Employees',
      'Workplace Diversity for Employees',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'cmv-driver',
    name: 'New Onboarding - CMV Driver',
    accessCode: 'GTPO8MM5',
    courses: [
      'CMV - Accident Procedures',
      'CMV - Inspections',
      'CMV - Safe Vehicle Entry and Exit',
      'Defensive Driving - Commercial Motor Vehicles',
      'New Employee Safety Orientation',
      'Substance Abuse - What Employees Need to Know',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'maintenance-janitorial',
    name: 'New Onboarding - Maintenance/Janitorial',
    accessCode: 'G3T6ETDO',
    courses: [
      'Back Safety: Avoiding Back Injuries',
      'Good Housekeeping',
      'Hand Protection',
      'New Employee Safety Orientation',
      'Preventing Slips Trips and Falls - A Guide for Employees',
      'Workplace Harassment - What Employees Need to Know',
    ],
  },
  {
    id: 'management',
    name: 'New Onboarding - Management',
    accessCode: 'PNS9HPSK',
    courses: [
      'New Employee Safety Orientation',
      'Crash Course in Leadership Skills',
      'Diversity Fundamentals for Supervisors',
      'Preventing Sexual Harassment - A Guide for Supervisors',
      'Reasonable Suspicion and Responding to Substance Abuse for Supervisors',
      'Workplace Harassment - What Employees Need to Know',
      'Workplace Violence - Supervisors',
    ],
  },
];

const LIBRARY_BY_ID = new Map(ORIENTATION_LIBRARIES.map((library) => [library.id, library]));

function courseKey(libraryId, courseIndex) {
  return `${libraryId}:${courseIndex}`;
}

function normalizeOrientation(record) {
  const source = record?.orientation || {};
  const assignedLibraryIds = Array.from(new Set(
    (Array.isArray(source.assignedLibraryIds) ? source.assignedLibraryIds : [])
      .filter((id) => LIBRARY_BY_ID.has(id)),
  ));
  const storedProgress = source.courseProgress && typeof source.courseProgress === 'object'
    ? source.courseProgress
    : {};
  const courseProgress = {};
  const completionDates = [];
  let requiredCourseCount = 0;
  let completedCourseCount = 0;

  for (const libraryId of assignedLibraryIds) {
    const library = LIBRARY_BY_ID.get(libraryId);
    library.courses.forEach((_course, courseIndex) => {
      const key = courseKey(libraryId, courseIndex);
      const progress = storedProgress[key] || {};
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

function sanitizeOrientationInput(body) {
  return normalizeOrientation({
    orientation: {
      assignedLibraryIds: body?.assignedLibraryIds,
      courseProgress: body?.courseProgress,
    },
  });
}

module.exports = {
  ORIENTATION_LIBRARIES,
  courseKey,
  normalizeOrientation,
  sanitizeOrientationInput,
};
