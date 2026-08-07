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
    if (!validWorkStatuses.includes(item.workStatusAfter)) {
      item.otherWorkStatusAfter = item.otherWorkStatusAfter || item.workStatusAfter;
      item.workStatusAfter = 'Other';
    }
    if (item.workStatusAfter === 'Other' && !item.otherWorkStatusAfter) return { error: 'Enter the other Work Status / Medical Restriction for the timeline entry.' };
    if (item.workStatusAfter !== 'Other') item.otherWorkStatusAfter = '';
    if (!validSecureLink(item.documentationLink)) return { error: 'Timeline documentation must use a secure SharePoint link.' };
  }
  return { value: items };
}

function withCurrentWorkStatus(record) {
  const timeline = Array.isArray(record?.timeline) ? record.timeline : [];
  const latest = [...timeline].filter(item => clean(item?.date)).sort((a, b) => clean(a.date).localeCompare(clean(b.date))).at(-1);
  if (!latest?.workStatusAfter) return record;
  return {
    ...record,
    initialWorkStatus: clean(record.workStatus),
    initialOtherWorkStatus: clean(record.otherWorkStatus),
    workStatus: clean(latest.workStatusAfter),
    otherWorkStatus: clean(latest.workStatusAfter) === 'Other' ? clean(latest.otherWorkStatusAfter) : '',
  };
}

function closureWarnings(record) {
  const current = withCurrentWorkStatus(record);
  const currentStatus = current.workStatus === 'Other' ? current.otherWorkStatus : current.workStatus;
  const warnings = [];
  if (current.workStatus !== 'Returned to Work - No Restrictions') warnings.push(`Current Work Status / Medical Restriction is "${currentStatus || 'Not entered'}", not "Returned to Work - No Restrictions".`);
  if (clean(record?.investigationStatus) !== 'Completed') warnings.push('The safety investigation is not completed.');
  if (!clean(record?.investigationDate)) warnings.push('Investigation Date is missing.');
  if (!clean(record?.rootCause)) warnings.push('Root Cause is missing.');
  if (record?.safetyViolation === 'Yes' && !clean(record?.safetyViolationDetails)) warnings.push('Safety Violation Details are missing.');
  if (record?.correctiveActionRequired === 'Yes' && !clean(record?.correctiveActionDetails)) warnings.push('Corrective Action Details are missing.');
  if (record?.injuryReportReceived === 'Yes' && !clean(record?.injuryReportLink)) warnings.push('The received Injury Report Link is missing.');
  if (record?.workersCompClaimed === 'Yes' && !clean(record?.workersCompCaseNumber)) warnings.push('Workers’ Compensation Case Number is missing.');
  return warnings;
}

function closureBlocker(record) {
  if (record?.injuryReportReceived !== 'Yes') return 'The Injury Report must be received before requesting case closure.';
  if (!clean(record?.injuryReportLink)) return 'The Injury Report Link is required before requesting case closure.';
  return '';
}

function totalCaseCost(record) {
  return (Array.isArray(record?.costs) ? record.costs : []).reduce((total, cost) => total + (Number(cost?.amount) || 0), 0);
}

function sanitizeCosts(value) {
  if (!Array.isArray(value)) return { value: [] };
  const items = value.map(item => ({ invoiceDate: clean(item?.invoiceDate), description: clean(item?.description), paidBy: clean(item?.paidBy), royalCostType: clean(item?.royalCostType), amount: Number(item?.amount), invoiceLink: clean(item?.invoiceLink) }))
    .filter(item => item.invoiceDate || item.description || item.paidBy || item.royalCostType || item.amount || item.invoiceLink);
  for (const item of items) {
    if (!item.description || !['Workers Compensation', 'Royal'].includes(item.paidBy) || !Number.isFinite(item.amount) || item.amount < 0) return { error: 'Every cost entry requires a description, valid payer, and non-negative amount.' };
    if (item.paidBy === 'Royal' && !['Lost Time', 'Medical Bill'].includes(item.royalCostType)) return { error: 'Every cost paid by Royal requires a Lost Time or Medical Bill classification.' };
    if (item.paidBy !== 'Royal') item.royalCostType = '';
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

function sanitizeCaseInput(input, employee, options = {}) {
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
  const workersCompContactName = clean(input?.workersCompContactName);
  const workersCompContactPhone = clean(input?.workersCompContactPhone);
  const workersCompContactEmail = clean(input?.workersCompContactEmail);
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
  if (options.requireEmployeeInjuryFolder && !employeeInjuryFolderLink) return { error: 'Employee Injury Folder Link is required for a new case.' };
  if (!validSecureLink(employeeInjuryFolderLink)) return { error: 'Employee Injury Folder must be a secure SharePoint link.' };
  if (!['Yes', 'No'].includes(injuryReportReceived)) return { error: 'Injury Report Received must be Yes or No.' };
  if (injuryReportReceived === 'Yes' && !injuryReportLink) return { error: 'Add the received injury report link.' };
  if (!validSecureLink(injuryReportLink)) return { error: 'Injury Report Link must be a secure SharePoint link.' };
  if (!['Yes', 'No'].includes(workersCompClaimed)) return { error: 'Workers’ Compensation Claimed must be Yes or No.' };
  if (workersCompClaimed === 'Yes' && !workersCompCaseNumber) return { error: 'Workers’ Compensation case number is required.' };

  if (timeline.error) return { error: timeline.error };
  if (costs.error) return { error: costs.error };

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
      workStatus,
      otherWorkStatus: workStatus === 'Other' ? otherWorkStatus : '',
      injuredBodyPart,
      oshaRecordable,
      employeeInjuryFolderLink,
      injuryReportReceived,
      injuryReportLink: injuryReportReceived === 'Yes' ? injuryReportLink : '',
      workersCompClaimed,
      workersCompCaseNumber: workersCompClaimed === 'Yes' ? workersCompCaseNumber : '',
      workersCompContactName: workersCompClaimed === 'Yes' ? workersCompContactName : '',
      workersCompContactPhone: workersCompClaimed === 'Yes' ? workersCompContactPhone : '',
      workersCompContactEmail: workersCompClaimed === 'Yes' ? workersCompContactEmail : '',
      followUpIssues,
      timeline: timeline.value,
      costs: costs.value,
    },
  };
}

module.exports = { closureBlocker, closureWarnings, employeeSnapshot, sanitizeCaseInput, totalCaseCost, withCurrentWorkStatus };
