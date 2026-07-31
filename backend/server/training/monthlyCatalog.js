const { randomUUID } = require('node:crypto');

function normalizeTopic(topic) {
  return {
    id: String(topic.id),
    name: String(topic.name || '').trim(),
    targetDate: String(topic.targetDate || '').trim(),
    link: String(topic.link || '').trim(),
    accessCode: String(topic.accessCode || '').trim(),
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
  if (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return { error: 'Please enter a valid target date.' };
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
      courses,
    },
  };
}

function employeeMatchesAssignmentCriteria(employee, criteria = {}) {
  if (employee?.employmentStatus !== 'Active') return false;
  const jobTitles = Array.isArray(criteria.jobTitles) ? criteria.jobTitles.map(String) : [];
  const locations = Array.isArray(criteria.locations) ? criteria.locations.map(String) : [];
  if (!jobTitles.length && !locations.length) return false;
  const matchesJobTitle = !jobTitles.length || jobTitles.includes(String(employee.jobTitle || ''));
  const matchesLocation = !locations.length || locations.includes(String(employee.location || ''));
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
    if (!topicIds.includes(topicId) && assignment?.requirement !== 'Unassigned' && assignment?.topicSnapshot) topicIds.push(topicId);
  }

  const assignments = topicIds.map((topicId) => {
    const stored = storedAssignments[topicId] || {};
    const requirement = ['Required', 'Not Required'].includes(stored.requirement) ? stored.requirement : 'Unassigned';
    const topic = requirement !== 'Unassigned' && stored.topicSnapshot
      ? normalizeTopic(stored.topicSnapshot)
      : currentById.get(topicId);
    if (!topic) return null;
    const completionStatus = requirement === 'Required' && stored.completionStatus === 'Finished'
      ? 'Finished'
      : 'Unfinished';
    const completionDate = completionStatus === 'Finished'
      && typeof stored.completionDate === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(stored.completionDate)
      ? stored.completionDate
      : null;
    return {
      topic,
      requirement,
      completionStatus,
      completionDate,
      folderUpdated: requirement === 'Required' && stored.folderUpdated === true,
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
    if (!topicIds.includes(topicId) && assignment?.requirement !== 'Unassigned' && assignment?.topicSnapshot) topicIds.push(topicId);
  }
  const topicAssignments = {};

  for (const topicId of topicIds) {
    const value = incoming[topicId] || {};
    const requirement = ['Required', 'Not Required'].includes(value.requirement) ? value.requirement : 'Unassigned';
    const existing = existingAssignments[topicId] || {};
    const topicSnapshot = requirement !== 'Unassigned'
      ? existing.topicSnapshot || currentById.get(topicId)
      : null;
    if (!topicSnapshot && requirement !== 'Unassigned') continue;
    const completionStatus = requirement === 'Required' && value.completionStatus === 'Finished' ? 'Finished' : 'Unfinished';
    const completionDate = completionStatus === 'Finished' && /^\d{4}-\d{2}-\d{2}$/.test(String(value.completionDate || ''))
      ? String(value.completionDate)
      : null;
    if (completionStatus === 'Finished' && !completionDate) {
      return { error: `Enter a completion date for ${topicSnapshot.name}.` };
    }
    topicAssignments[topicId] = {
      requirement,
      completionStatus,
      completionDate,
      folderUpdated: requirement === 'Required' && value.folderUpdated === true,
      ...(topicSnapshot ? { topicSnapshot: normalizeTopic(topicSnapshot) } : {}),
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
