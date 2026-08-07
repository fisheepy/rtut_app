const clean = value => String(value ?? '').trim();

function validDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validDateTime(value) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
}

function validLink(value) {
  if (!value) return true;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

function sanitizeFollowUps(value) {
  if (!Array.isArray(value)) return { value: [] };
  const items = value.map(item => ({
    description: clean(item?.description),
    dueDate: clean(item?.dueDate),
    completed: Boolean(item?.completed),
    completedDate: Boolean(item?.completed) ? clean(item?.completedDate) : '',
  })).filter(item => item.description || item.dueDate || item.completed || item.completedDate);
  for (const item of items) {
    if (!item.description) return { error: 'Every follow-up item requires a description.' };
    if (!validDate(item.dueDate) || !validDate(item.completedDate)) return { error: 'Follow-up dates must be valid dates.' };
  }
  return { value: items };
}

function sanitizeEventInput(input) {
  const followUps = sanitizeFollowUps(input?.followUps);
  if (followUps.error) return followUps;
  const value = {
    eventType: clean(input?.eventType),
    eventDateTime: clean(input?.eventDateTime),
    reportedDate: clean(input?.reportedDate),
    location: clean(input?.location),
    department: clean(input?.department),
    reportedBy: clean(input?.reportedBy),
    peopleInvolved: clean(input?.peopleInvolved),
    eventNature: clean(input?.eventNature),
    otherEventNature: clean(input?.otherEventNature),
    description: clean(input?.description),
    reportReceived: clean(input?.reportReceived),
    reportLink: clean(input?.reportLink),
    costInvolved: clean(input?.costInvolved),
    estimatedCost: clean(input?.costInvolved) === 'Yes' && input?.estimatedCost !== '' && input?.estimatedCost != null ? Number(input?.estimatedCost) : null,
    finalCost: clean(input?.costInvolved) === 'Yes' && input?.finalCost !== '' && input?.finalCost != null ? Number(input?.finalCost) : null,
    followUps: followUps.value,
  };
  if (!['Accident', 'Near Miss'].includes(value.eventType)) return { error: 'Event Type must be Accident or Near Miss.' };
  if (!validDateTime(value.eventDateTime)) return { error: 'Event Date and Time is required.' };
  if (!validDate(value.reportedDate) || !value.reportedDate) return { error: 'Reported Date is required.' };
  if (!value.location || !value.eventNature || !value.description) return { error: 'Location, Event Nature, and Description are required.' };
  if (value.eventNature === 'Other' && !value.otherEventNature) return { error: 'Please describe the other event nature.' };
  if (!['Yes', 'No'].includes(value.reportReceived)) return { error: 'Report Received must be Yes or No.' };
  if (value.reportReceived === 'Yes' && !value.reportLink) return { error: 'A Report or Folder Link is required when the report is received.' };
  if (!validLink(value.reportLink)) return { error: 'The Report or Folder Link must be a secure HTTPS link.' };
  if (!['Yes', 'No'].includes(value.costInvolved)) return { error: 'Cost Involved must be Yes or No.' };
  if (value.costInvolved === 'Yes' && value.estimatedCost === null && value.finalCost === null) return { error: 'Enter an estimated or final cost when Cost Involved is Yes.' };
  if ([value.estimatedCost, value.finalCost].some(cost => cost !== null && (!Number.isFinite(cost) || cost < 0))) return { error: 'Costs must be non-negative numbers.' };
  return { value };
}

function eventStatus(record) {
  if (record?.closedAt) return 'Closed';
  return (record?.followUps || []).some(item => !item.completed) ? 'Open - Follow-up Required' : 'Open';
}

module.exports = { eventStatus, sanitizeEventInput };
