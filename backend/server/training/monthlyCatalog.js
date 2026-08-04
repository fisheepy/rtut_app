const { randomUUID } = require('node:crypto');
const { cleanEmployeeFieldLabel, normalizeEmployeeFieldValue } = require('./employeeFieldFormat');

function normalizeTopic(topic) {
  return {
    id: String(topic.id),
    name: String(topic.name || '').trim(),
    targetDate: String(topic.targetDate || '').trim(),
    link: String(topic.link || '').trim(),
    accessCode: String(topic.accessCode || '').trim(),
    autoAssign: {
      jobTitles: Array.isArray(topic.autoAssign?.jobTitles) ? topic.autoAssign.jobTitles.map(cleanEmployeeFieldLabel).filter(Boolean) : [],
      locations: Array.isArray(topic.autoAssign?.locations) ? topic.autoAssign.locations.map(cleanEmployeeFieldLabel).filter(Boolean) : [],
    },
    courses: (Array.isArray(topic.courses) ? topic.courses : []).map((course) => (
      typeof course === 'string'
        ? { id: randomUUID(), title: course.trim() }
        : { id: String(course.id || randomUUID()), title: String(course.title || '').trim() }
    )).filter((course) => course.title),
  };
}

async function getMonthlyTopics(db) {
  return (await db.collection('monthly_training_topics').find({}).sort({ order: 1, targetDate: 1, name: 1 }).toArray())
    .map(normalizeTopic);
}

function validateTopicInput(body, existingTopic = null) {
  const name = String(body?.name || '').trim();
  if (!name) return { error: 'Training topic name is required.' };
  const targetDate = String(body?.targetDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return { error: 'Target date is required.' };
  const link = String(body?.link || '').trim();
  if (link) {
    try {
      if (new URL(link).protocol !== 'https:') return { error: 'Training link must use HTTPS.' };
    } catch (_error) {
      return { error: 'Please enter a valid training link.' };
    }
  }
  const existingCourseIds = new Set((existingTopic?.courses || []).map((course) => String(course.id)));
  const courses = (Array.isArray(body?.courses) ? body.courses : []).map((course) => ({
    id: existingCourseIds.has(String(course?.id)) ? String(course.id) : randomUUID(),
    title: String(course?.title || '').trim(),
  })).filter((course) => course.title);
  if (!courses.length) return { error: 'Add at least one training course.' };
  return {
    topic: {
      id: existingTopic?.id || randomUUID(),
      name,
      targetDate,
      link,
      accessCode: String(body?.accessCode || '').trim(),
      autoAssign: {
        jobTitles: Array.isArray(body?.autoAssign?.jobTitles) ? body.autoAssign.jobTitles.map(cleanEmployeeFieldLabel).filter(Boolean) : [],
        locations: Array.isArray(body?.autoAssign?.locations) ? body.autoAssign.locations.map(cleanEmployeeFieldLabel).filter(Boolean) : [],
      },
      courses,
    },
  };
}

function employeeMatchesAssignmentCriteria(employee, criteria = {}) {
  if (employee?.employmentStatus !== 'Active') return false;
  const jobTitles = Array.isArray(criteria.jobTitles) ? criteria.jobTitles.map(normalizeEmployeeFieldValue).filter(Boolean) : [];
  const locations = Array.isArray(criteria.locations) ? criteria.locations.map(normalizeEmployeeFieldValue).filter(Boolean) : [];
  if (!jobTitles.length && !locations.length) return false;
  const matchesJobTitle = !jobTitles.length || jobTitles.includes(normalizeEmployeeFieldValue(employee.jobTitle));
  const matchesLocation = !locations.length || locations.includes(normalizeEmployeeFieldValue(employee.location));
  return matchesJobTitle && matchesLocation;
}

function normalizeMonthly(record, currentTopics = []) {
  const source = record?.monthly || {};
  const storedAssignments = source.topicAssignments && typeof source.topicAssignments === 'object'
    ? source.topicAssignments
    : {};
  const currentById = new Map(currentTopics.map((topic) => [topic.id, normalizeTopic(topic)]));
  const topicIds = [...currentById.keys()];
  for (const [topicId, assignment] of Object.entries(storedAssignments)) {
    if (!topicIds.includes(topicId) && (assignment?.requirement !== 'Unassigned' || assignment?.completionStatus === 'Finished') && assignment?.topicSnapshot) topicIds.push(topicId);
  }

  const assignments = topicIds.map((topicId) => {
    const stored = storedAssignments[topicId] || {};
    const requirement = ['Required', 'Not Required'].includes(stored.requirement) ? stored.requirement : 'Unassigned';
    const topic = (requirement !== 'Unassigned' || stored.completionStatus === 'Finished') && stored.topicSnapshot
      ? normalizeTopic(stored.topicSnapshot)
      : currentById.get(topicId);
    if (!topic) return null;
    const legacyCompletionDate = stored.completionStatus === 'Finished' && /^\d{4}-\d{2}-\d{2}$/.test(String(stored.completionDate || ''))
      ? String(stored.completionDate)
      : null;
    const courseProgress = Object.fromEntries(topic.courses.map((course) => {
      const storedDate = stored.courseProgress?.[course.id]?.completedAt;
      const completedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(storedDate || '')) ? String(storedDate) : legacyCompletionDate;
      const folderUpdated = stored.courseProgress?.[course.id]?.folderUpdated === true
        || stored.folderUpdated === true && Boolean(completedAt);
      return [course.id, { completedAt: completedAt || null, folderUpdated }];
    }));
    const courseDates = Object.values(courseProgress).map((progress) => progress.completedAt).filter(Boolean).sort();
    const allCoursesFinished = topic.courses.length > 0
      && topic.courses.every((course) => courseProgress[course.id]?.completedAt && courseProgress[course.id]?.folderUpdated);
    const completionStatus = ['Required', 'Unassigned'].includes(requirement) && allCoursesFinished ? 'Finished' : 'Unfinished';
    const completionDate = completionStatus === 'Finished' ? courseDates.at(-1) : null;
    return {
      topic,
      requirement,
      completionStatus,
      completionDate,
      courseProgress,
    };
  }).filter(Boolean);

  const requiredAssignments = assignments.filter((assignment) => assignment.requirement === 'Required');
  const status = !assignments.length || assignments.every((assignment) => assignment.requirement === 'Unassigned')
    ? 'Unassigned'
    : assignments.some((assignment) => assignment.requirement === 'Unassigned')
      || requiredAssignments.some((assignment) => assignment.completionStatus !== 'Finished' || !assignment.completionDate)
      ? 'In Process'
      : 'Finished';
  const completionDates = requiredAssignments.map((assignment) => assignment.completionDate).filter(Boolean).sort();
  return {
    status,
    completedAt: status === 'Finished' ? completionDates.at(-1) || null : null,
    assignments,
    requiredCount: requiredAssignments.length,
    finishedCount: requiredAssignments.filter((assignment) => assignment.completionStatus === 'Finished' && assignment.completionDate).length,
  };
}

function sanitizeMonthlyInput(body, currentTopics, existingRecord = null) {
  const incoming = body?.topicAssignments && typeof body.topicAssignments === 'object' ? body.topicAssignments : {};
  const existingAssignments = existingRecord?.monthly?.topicAssignments || {};
  const currentById = new Map(currentTopics.map((topic) => [topic.id, normalizeTopic(topic)]));
  const topicIds = [...currentById.keys()];
  for (const [topicId, assignment] of Object.entries(existingAssignments)) {
    if (!topicIds.includes(topicId) && (assignment?.requirement !== 'Unassigned' || assignment?.completionStatus === 'Finished') && assignment?.topicSnapshot) topicIds.push(topicId);
  }
  const topicAssignments = {};

  for (const topicId of topicIds) {
    const value = incoming[topicId] || {};
    const requirement = ['Required', 'Not Required'].includes(value.requirement) ? value.requirement : 'Unassigned';
    const existing = existingAssignments[topicId] || {};
    const requestedFinished = value.completionStatus === 'Finished';
    const hasFinishedHistory = requestedFinished && /^\d{4}-\d{2}-\d{2}$/.test(String(value.completionDate || ''));
    const topicSnapshot = requirement !== 'Unassigned' || hasFinishedHistory
      ? existing.topicSnapshot || currentById.get(topicId)
      : null;
    if (!topicSnapshot && requirement !== 'Unassigned') continue;
    const normalizedTopic = topicSnapshot ? normalizeTopic(topicSnapshot) : currentById.get(topicId);
    const courseProgress = Object.fromEntries((normalizedTopic?.courses || []).map((course) => {
      const incomingDate = value.courseProgress?.[course.id]?.completedAt;
      const legacyDate = hasFinishedHistory ? String(value.completionDate) : null;
      const completedAt = /^\d{4}-\d{2}-\d{2}$/.test(String(incomingDate || '')) ? String(incomingDate) : legacyDate;
      const folderUpdated = Boolean(completedAt) && (value.courseProgress?.[course.id]?.folderUpdated === true
        || value.folderUpdated === true);
      return [course.id, { completedAt: completedAt || null, folderUpdated }];
    }));
    const courseDates = Object.values(courseProgress).map((progress) => progress.completedAt).filter(Boolean).sort();
    const allCoursesFinished = Boolean(normalizedTopic?.courses.length)
      && normalizedTopic.courses.every((course) => courseProgress[course.id]?.completedAt && courseProgress[course.id]?.folderUpdated);
    if (requirement === 'Required' && requestedFinished && !allCoursesFinished) {
      return { error: `Enter a completion date and confirm Folder Updated for every course in ${normalizedTopic.name}.` };
    }
    const keepCourseProgress = requirement === 'Required' || requirement === 'Unassigned' && allCoursesFinished;
    const completionStatus = keepCourseProgress && allCoursesFinished ? 'Finished' : 'Unfinished';
    const completionDate = completionStatus === 'Finished' ? courseDates.at(-1) : null;
    topicAssignments[topicId] = {
      requirement,
      completionStatus,
      completionDate,
      courseProgress: keepCourseProgress ? courseProgress : {},
      ...(requirement !== 'Unassigned' || completionStatus === 'Finished' ? { topicSnapshot: normalizedTopic } : {}),
    };
  }

  return { monthly: normalizeMonthly({ monthly: { topicAssignments } }, currentTopics), topicAssignments };
}

module.exports = {
  employeeMatchesAssignmentCriteria,
  getMonthlyTopics,
  normalizeMonthly,
  sanitizeMonthlyInput,
  validateTopicInput,
};
