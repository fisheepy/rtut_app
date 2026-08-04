function clean(value) {
  return value == null ? '' : String(value).trim();
}

function validDate(value) {
  return !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
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
    employeeFolderUrl: clean(record?.employeeFolderUrl), payRate: clean(record?.payRate), firstPayrollDate: clean(record?.firstPayrollDate),
    insuranceEffectiveDate: clean(record?.insuranceEffectiveDate), retirementEffectiveDate: clean(record?.retirementEffectiveDate),
    fileTracker: record?.fileTracker || {},
  };
}

const FILE_TRACKER_FIELDS = [
  'resumeInformation', 'hiringApproval', 'federalW4', 'stateW4', 'handbookSignoff',
  'safetyPolicySignoff', 'confidentialityPolicySignoff', 'offerLetter', 'nncdra',
  'backgroundCheck', 'i9',
];

function sanitizeFileTracker(input = {}) {
  const yesNo = new Set(['Yes', 'No']);
  const result = {};
  for (const field of FILE_TRACKER_FIELDS) {
    const allowed = field === 'nncdra' ? new Set(['Yes', 'No', 'Exempt'])
      : field === 'backgroundCheck' ? new Set(['Yes', 'No', 'Not Applicable']) : yesNo;
    result[field] = allowed.has(input[field]) ? input[field] : '';
  }
  result.handbookVersion = result.handbookSignoff === 'Yes' ? clean(input.handbookVersion) : '';
  return result;
}

function fileTrackerComplete(tracker) {
  return FILE_TRACKER_FIELDS.every(field => tracker[field])
    && (tracker.handbookSignoff !== 'Yes' || Boolean(tracker.handbookVersion));
}

module.exports = { clean, employeeView, FILE_TRACKER_FIELDS, fileTrackerComplete, sanitizeFileTracker, validDate };
