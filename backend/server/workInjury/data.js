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

  if (!snapshot.employeeId || !snapshot.employeeName) return { error: 'Select a valid employee.' };
  if (!injuryDateTime) return { error: 'Injury date and time is required.' };
  if (!firstNoticeDate) return { error: 'First notice date is required.' };
  if (!injuryDescription) return { error: 'Injury description is required.' };
  if (!injuryLocation) return { error: 'Injury location is required.' };
  if (!['Yes', 'No'].includes(safetyViolation)) return { error: 'Safety violation must be Yes or No.' };
  if (safetyViolation === 'Yes' && !safetyViolationDetails) return { error: 'Describe the safety violation.' };
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

  return {
    value: {
      ...snapshot,
      injuryDateTime,
      firstNoticeDate,
      injuryDescription,
      injuryLocation,
      safetyViolation,
      safetyViolationDetails: safetyViolation === 'Yes' ? safetyViolationDetails : '',
      workStatus,
      otherWorkStatus: workStatus === 'Other' ? otherWorkStatus : '',
      injuredBodyPart,
      oshaRecordable,
      employeeInjuryFolderLink,
      injuryReportReceived,
      injuryReportLink: injuryReportReceived === 'Yes' ? injuryReportLink : '',
      workersCompClaimed,
      workersCompCaseNumber: workersCompClaimed === 'Yes' ? workersCompCaseNumber : '',
      followUpIssues,
    },
  };
}

module.exports = { employeeSnapshot, sanitizeCaseInput };
