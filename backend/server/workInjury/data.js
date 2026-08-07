function clean(value) {
  return String(value ?? '').trim();
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
  const employeeStatus = clean(input?.employeeStatus || snapshot.companyStatus);
  const injuredBodyPart = clean(input?.injuredBodyPart);
  const oshaRecordable = clean(input?.oshaRecordable);
  const followUpIssues = clean(input?.followUpIssues);
  const followUpDate = clean(input?.followUpDate);

  if (!snapshot.employeeId || !snapshot.employeeName) return { error: 'Select a valid employee.' };
  if (!injuryDateTime) return { error: 'Injury date and time is required.' };
  if (!firstNoticeDate) return { error: 'First notice date is required.' };
  if (!injuryDescription) return { error: 'Injury description is required.' };
  if (!injuryLocation) return { error: 'Injury location is required.' };
  if (!['Yes', 'No'].includes(safetyViolation)) return { error: 'Safety violation must be Yes or No.' };
  if (!employeeStatus) return { error: 'Employee status is required.' };
  if (!injuredBodyPart) return { error: 'Injured body part is required.' };
  if (!['Yes', 'No'].includes(oshaRecordable)) return { error: 'OSHA recordable must be Yes or No.' };
  if (followUpIssues && !followUpDate) return { error: 'Follow-up date is required when follow-up issues are entered.' };

  return {
    value: {
      ...snapshot,
      injuryDateTime,
      firstNoticeDate,
      injuryDescription,
      injuryLocation,
      safetyViolation,
      employeeStatus,
      injuredBodyPart,
      oshaRecordable,
      followUpIssues,
      followUpDate,
    },
  };
}

module.exports = { employeeSnapshot, sanitizeCaseInput };
