function clean(value) {
  return value == null ? '' : String(value).trim();
}

function validDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function payrollChangeRequestChanged(existing = {}, pending, date, reason) {
  return pending === true && (
    existing.payRateChangePending !== true ||
    clean(existing.payrollChangeDate) !== clean(date) ||
    clean(existing.payrollChangeReason) !== clean(reason)
  );
}

function employeeView(employee, record) {
  return {
    id: String(employee._id),
    name: [clean(employee['First Name']), clean(employee['Last Name'])].filter(Boolean).join(' '),
    email: clean(employee.Email), phone: clean(employee.Phone),
    hireDate: clean(employee['Hire Date'] || employee['First Day']),
    homeDepartment: clean(employee['Home Department'] || employee.Department),
    jobTitle: clean(employee['Job Title']), location: clean(employee.Location),
    supervisor: [clean(employee['Supervisor First Name']), clean(employee['Supervisor Last Name'])].filter(Boolean).join(' '),
    eeoc: clean(employee['EEOC Establishment'] || employee.EEOC), employmentCategory: clean(employee['Worker Category']),
    payCategory: clean(employee['Pay Category']), positionStatus: clean(employee['Position Status']),
    accountActive: clean(employee['Account Active']), activated: clean(employee.isActivated),
    employeeFolderUrl: clean(record?.employeeFolderUrl), payRateType: clean(record?.payRateType), payRate: clean(record?.payRate), firstPayrollDate: clean(record?.firstPayrollDate),
    payRateChangePending: record?.payRateChangePending === true,
    payrollChangeDate: clean(record?.payrollChangeDate), payrollChangeReason: clean(record?.payrollChangeReason),
    insuranceEffectiveDate: clean(record?.insuranceEffectiveDate), insuranceNotApplicable: record?.insuranceNotApplicable === true,
    retirementEffectiveDate: clean(record?.retirementEffectiveDate), retirementNotApplicable: record?.retirementNotApplicable === true,
    fileTracker: record?.fileTracker || {},
    payrollCheckedAt: record?.payrollCheckedAt || null, payrollCheckedBy: clean(record?.payrollCheckedBy),
    payrollFinalReviewedAt: record?.payrollFinalReviewedAt || null, payrollFinalReviewedBy: clean(record?.payrollFinalReviewedBy),
    payrollChangeCheckedAt: record?.payrollChangeCheckedAt || null, payrollChangeCheckedBy: clean(record?.payrollChangeCheckedBy),
    payrollChangeFinalReviewedAt: record?.payrollChangeFinalReviewedAt || null, payrollChangeFinalReviewedBy: clean(record?.payrollChangeFinalReviewedBy),
    insuranceCheckedAt: record?.insuranceCheckedAt || null, insuranceCheckedBy: clean(record?.insuranceCheckedBy),
    retirementCheckedAt: record?.retirementCheckedAt || null, retirementCheckedBy: clean(record?.retirementCheckedBy),
  };
}

const DEFAULT_FILE_TRACKER_FIELDS = [
  ['resumeInformation', 'Resume / Information', ['Yes', 'No']], ['hiringApproval', 'Hiring Approval', ['Yes', 'No']],
  ['federalW4', 'Federal W-4', ['Yes', 'No']], ['stateW4', 'State W-4', ['Yes', 'No']],
  ['handbookSignoff', 'Handbook Signoff', ['Yes', 'No']], ['safetyPolicySignoff', 'Safety Policy Signoff', ['Yes', 'No']],
  ['confidentialityPolicySignoff', 'Confidentiality Policy Signoff', ['Yes', 'No']], ['offerLetter', 'Offer Letter', ['Yes', 'No']],
  ['nncdra', 'NNCDRA', ['Yes', 'No', 'Exempt']], ['backgroundCheck', 'Background Check', ['Yes', 'No', 'Not Applicable']],
  ['i9', 'I-9', ['Yes', 'No']],
].map(([id, label, options], order) => ({ id, label, options, order, active: true }));

function sanitizeTrackerCatalogField(input, existing = {}) {
  const label = clean(input?.label);
  const options = [...new Set((Array.isArray(input?.options) ? input.options : []).map(clean).filter(Boolean))];
  if (!label || options.length < 2) return { error: 'A checklist name and at least two response options are required.' };
  return { field: {
    id: clean(existing.id || input.id), label, options,
    order: Number.isFinite(Number(input.order)) ? Number(input.order) : Number(existing.order || 0),
    active: input.active !== false,
  } };
}

function sanitizeFileTracker(input = {}, catalog = DEFAULT_FILE_TRACKER_FIELDS) {
  const responses = input.responses && typeof input.responses === 'object' ? input.responses : input;
  const result = { responses: {} };
  for (const field of catalog) {
    const value = clean(responses[field.id]);
    result.responses[field.id] = field.options.includes(value) ? value : '';
  }
  result.handbookVersion = result.responses.handbookSignoff === 'Yes' ? clean(input.handbookVersion) : '';
  result.comments = clean(input.comments);
  return result;
}

function fileTrackerComplete(tracker, catalog = DEFAULT_FILE_TRACKER_FIELDS) {
  return catalog.every(field => tracker.responses?.[field.id])
    && (tracker.responses?.handbookSignoff !== 'Yes' || Boolean(tracker.handbookVersion));
}

module.exports = {
  clean, employeeView, DEFAULT_FILE_TRACKER_FIELDS, fileTrackerComplete,
  payrollChangeRequestChanged, sanitizeFileTracker, sanitizeTrackerCatalogField, validDate,
};
