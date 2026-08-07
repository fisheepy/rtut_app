function clean(value) {
  return String(value ?? '').trim();
}

function validSecureLink(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname.endsWith('.sharepoint.com') || url.hostname.endsWith('.sharepoint.us'));
  } catch {
    return false;
  }
}

function sanitizeTimeline(value) {
  if (!Array.isArray(value)) return { value: [] };
  const validWorkStatuses = ['Off Work', 'Returned to Work - No Restrictions', 'Returned to Work - With Restrictions', 'Pending Medical Evaluation', 'Other'];
  const items = value.map(item => ({ date: clean(item?.date), description: clean(item?.description), workStatusAfter: clean(item?.workStatusAfter), otherWorkStatusAfter: clean(item?.otherWorkStatusAfter), documentationLink: clean(item?.documentationLink) }))
    .filter(item => Object.values(item).some(Boolean));
  for (const item of items) {
    if (!item.date || !item.description || !item.workStatusAfter) return { error: 'Every timeline entry requires a date, description, and employee work status.' };
    if (!validWorkStatuses.includes(item.workStatusAfter)) return { error: 'Select a valid Work Status / Medical Restriction for every timeline entry.' };
    if (item.workStatusAfter === 'Other' && !item.otherWorkStatusAfter) return { error: 'Enter the other Work Status / Medical Restriction for the timeline entry.' };
    if (item.workStatusAfter !== 'Other') item.otherWorkStatusAfter = '';
    if (!validSecureLink(item.documentationLink)) return { error: 'Timeline documentation must use a secure SharePoint link.' };
  }
  return { value: items };
}

function sanitizeCosts(value) {
  if (!Array.isArray(value)) return { value: [] };
  const items = value.map(item => ({ invoiceDate: clean(item?.invoiceDate), description: clean(item?.description), paidBy: clean(item?.paidBy), amount: Number(item?.amount), invoiceLink: clean(item?.invoiceLink) }))
    .filter(item => item.invoiceDate || item.description || item.paidBy || item.amount || item.invoiceLink);
  for (const item of items) {
    if (!item.description || !['Workers Compensation', 'Royal'].includes(item.paidBy) || !Number.isFinite(item.amount) || item.amount < 0) return { error: 'Every cost entry requires a description, valid payer, and non-negative amount.' };
    if (!validSecureLink(item.invoiceLink)) return { error: 'Invoice documentation must use a secure SharePoint link.' };
    item.amount = Math.round(item.amount * 100) / 100;
  }
  return { value: items };
}

function employeeSnapshot(employee) {
  return {
    employeeId: clean(employee?._id),
    employeeName: [clean(employee?.['First Name']), clean(employee?.['Last Name'])].filter(Boolean).join(' '),
    hireDate: clean(employee?.['Hire Date'] || employee?.['First Day']),
    department: clean(employee?.['Home Department'] || employee?.Department),
    location: clean(employee?.Location),
    supervisor: [clean(employee?.['Supervisor First Name']), clean(employee?.['Supervisor Last Name'])].filter(Boolean).join(' '),
    jobTitle: clean(employee?.['Job Title']),
    employeePhone: clean(employee?.Phone),
    employeeEmail: clean(employee?.Email),
    companyStatus: clean(employee?.['Position Status'] || 'Active'),
  };
}

function sanitizeCaseInput(input, employee) {
  const snapshot = employeeSnapshot(employee);
  const injuryDateTime = clean(input?.injuryDateTime);
  const firstNoticeDate = clean(input?.firstNoticeDate);
  const injuryDescription = clean(input?.injuryDescription);
  const injuryLocation = clean(input?.injuryLocation);
  const safetyViolation = clean(input?.safetyViolation);
  const safetyViolationDetails = clean(input?.safetyViolationDetails);
  const investigationStatus = clean(input?.investigationStatus || 'Not Started');
  const investigationDate = clean(input?.investigationDate);
  const rootCause = clean(input?.rootCause);
  const correctiveActionRequired = clean(input?.correctiveActionRequired || 'No');
  const correctiveActionDetails = clean(input?.correctiveActionDetails);
  const correctiveActionTargetDate = clean(input?.correctiveActionTargetDate);
  const workStatus = clean(input?.workStatus || input?.employeeStatus);
  const otherWorkStatus = clean(input?.otherWorkStatus);
  const injuredBodyPart = clean(input?.injuredBodyPart);
  const oshaRecordable = clean(input?.oshaRecordable);
  const employeeInjuryFolderLink = clean(input?.employeeInjuryFolderLink);
  const injuryReportReceived = clean(input?.injuryReportReceived);
  const injuryReportLink = clean(input?.injuryReportLink);
  const workersCompClaimed = clean(input?.workersCompClaimed);
  const workersCompCaseNumber = clean(input?.workersCompCaseNumber);
  const followUpIssues = clean(input?.followUpIssues);
  const timeline = sanitizeTimeline(input?.timeline);
  const costs = sanitizeCosts(input?.costs);

  if (!snapshot.employeeId || !snapshot.employeeName) return { error: 'Select a valid employee.' };
  if (!injuryDateTime) return { error: 'Injury date and time is required.' };
  if (!firstNoticeDate) return { error: 'First notice date is required.' };
  if (!injuryDescription) return { error: 'Injury description is required.' };
  if (!injuryLocation) return { error: 'Injury location is required.' };
  if (!['Yes', 'No'].includes(safetyViolation)) return { error: 'Safety violation must be Yes or No.' };
  if (safetyViolation === 'Yes' && !safetyViolationDetails) return { error: 'Describe the safety violation.' };
  if (!['Not Started', 'In Progress', 'Completed'].includes(investigationStatus)) return { error: 'Select a valid investigation status.' };
  if (investigationStatus === 'Completed' && (!investigationDate || !rootCause)) return { error: 'A completed investigation requires an investigation date and root cause.' };
  if (!['Yes', 'No'].includes(correctiveActionRequired)) return { error: 'Corrective action required must be Yes or No.' };
  if (correctiveActionRequired === 'Yes' && !correctiveActionDetails) return { error: 'Describe the corrective action needed.' };
  if (!['Off Work', 'Returned to Work - No Restrictions', 'Returned to Work - With Restrictions', 'Pending Medical Evaluation', 'Other'].includes(workStatus)) return { error: 'Select a valid Work Status / Medical Restriction.' };
  if (workStatus === 'Other' && !otherWorkStatus) return { error: 'Enter the other Work Status / Medical Restriction.' };
  if (!injuredBodyPart) return { error: 'Injured body part is required.' };
  if (!['Yes', 'No'].includes(oshaRecordable)) return { error: 'OSHA recordable must be Yes or No.' };
  if (!validSecureLink(employeeInjuryFolderLink)) return { error: 'Employee Injury Folder must be a secure SharePoint link.' };
  if (!['Yes', 'No'].includes(injuryReportReceived)) return { error: 'Injury Report Received must be Yes or No.' };
  if (injuryReportReceived === 'Yes' && !injuryReportLink) return { error: 'Add the received injury report link.' };
  if (!validSecureLink(injuryReportLink)) return { error: 'Injury Report Link must be a secure SharePoint link.' };
  if (!['Yes', 'No'].includes(workersCompClaimed)) return { error: 'Workers’ Compensation Claimed must be Yes or No.' };
  if (workersCompClaimed === 'Yes' && !workersCompCaseNumber) return { error: 'Workers’ Compensation case number is required.' };

  if (timeline.error) return { error: timeline.error };
  if (costs.error) return { error: costs.error };
  const latestTimelineEntry = [...timeline.value].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  const currentWorkStatus = latestTimelineEntry?.workStatusAfter || workStatus;
  const currentOtherWorkStatus = latestTimelineEntry?.workStatusAfter === 'Other' ? latestTimelineEntry.otherWorkStatusAfter : (latestTimelineEntry ? '' : otherWorkStatus);

  return {
    value: {
      ...snapshot,
      injuryDateTime,
      firstNoticeDate,
      injuryDescription,
      injuryLocation,
      safetyViolation,
      safetyViolationDetails: safetyViolation === 'Yes' ? safetyViolationDetails : '',
      investigationStatus,
      investigationDate,
      rootCause,
      correctiveActionRequired,
      correctiveActionDetails: correctiveActionRequired === 'Yes' ? correctiveActionDetails : '',
      correctiveActionTargetDate: correctiveActionRequired === 'Yes' ? correctiveActionTargetDate : '',
      workStatus: currentWorkStatus,
      otherWorkStatus: currentWorkStatus === 'Other' ? currentOtherWorkStatus : '',
      injuredBodyPart,
      oshaRecordable,
      employeeInjuryFolderLink,
      injuryReportReceived,
      injuryReportLink: injuryReportReceived === 'Yes' ? injuryReportLink : '',
      workersCompClaimed,
      workersCompCaseNumber: workersCompClaimed === 'Yes' ? workersCompCaseNumber : '',
      followUpIssues,
      timeline: timeline.value,
      costs: costs.value,
    },
  };
}

module.exports = { employeeSnapshot, sanitizeCaseInput };

