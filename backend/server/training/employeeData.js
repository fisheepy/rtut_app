const TRAINING_TYPES = ['orientation', 'monthly'];
const { normalizeOrientation } = require('./orientationCatalog');
const { normalizeMonthly } = require('./monthlyCatalog');
const { completedOneYear } = require('../employmentHistory');

function text(value) {
  return value == null ? '' : String(value).trim();
}

function isPartTimeCategory(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]/g, '') === 'parttime';
}

function dateValue(employee, names) {
  for (const name of names) {
    if (employee[name]) return employee[name];
  }
  return '';
}

function normalizeTraining(record, orientationLibraries, monthlyTopics) {
  return {
    orientation: normalizeOrientation(record, orientationLibraries),
    monthly: normalizeMonthly(record, monthlyTopics),
  };
}

function comparableDate(value) {
  if (!value) return '';
  const direct = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function completedAtLeastOneYear(employeeSnapshot) {
  const hireDate = comparableDate(dateValue(employeeSnapshot || {}, ['Hire Date', 'First Day']));
  const terminationDate = comparableDate(dateValue(employeeSnapshot || {}, ['Termination Date', 'Termination Day']));
  if (!hireDate || !terminationDate) return false;
  const [year, month, day] = hireDate.split('-').map(Number);
  const lastDayOfAnniversaryMonth = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  const anniversary = new Date(Date.UTC(year + 1, month - 1, Math.min(day, lastDayOfAnniversaryMonth)));
  return terminationDate >= anniversary.toISOString().slice(0, 10);
}

function explicitPriorServiceQualified(employee) {
  return employee?.['Is Rehire'] === true && completedOneYear(employee['Previous Hire Date'], employee['Previous Termination Date']);
}

function normalizeEmployee(employee, trainingRecord, orientationLibraries, monthlyTopics, employmentHistory = []) {
  const firstName = text(employee['First Name']);
  const lastName = text(employee['Last Name']);
  const terminationDay = dateValue(employee, ['Termination Date', 'Termination Day']);
  const accountStatus = text(employee['Account Active']).toLowerCase();
  const rawPositionStatus = text(employee['Position Status']);
  const positionStatus = rawPositionStatus.toLowerCase();
  const employmentCategory = text(employee['Worker Category']);
  const isTerminated = Boolean(terminationDay)
    || ['inactive', 'terminated'].includes(accountStatus)
    || ['inactive', 'terminated'].includes(positionStatus);
  const explicitRehire = employee?.['Is Rehire'] === true;
  const archivedCycles = employmentHistory
    .filter((record) => record?.employeeSnapshot)
    .sort((left, right) => new Date(right.archivedAt || 0) - new Date(left.archivedAt || 0));
  const displayedPreviousCycle = archivedCycles[0]?.employeeSnapshot || {};
  const qualifyingArchivedCycle = archivedCycles.find((record) => completedAtLeastOneYear(record.employeeSnapshot))?.employeeSnapshot;
  const explicitPriorQualified = explicitPriorServiceQualified(employee);
  const priorServiceQualified = explicitPriorQualified || Boolean(qualifyingArchivedCycle);
  const previousHireDate = explicitRehire
    ? dateValue(employee, ['Previous Hire Date'])
    : dateValue(displayedPreviousCycle, ['Hire Date', 'First Day']);
  const previousTerminationDate = explicitRehire
    ? dateValue(employee, ['Previous Termination Date'])
    : dateValue(displayedPreviousCycle, ['Termination Date', 'Termination Day']);

  return {
    id: String(employee._id),
    employeeName: [firstName, lastName].filter(Boolean).join(' '),
    email: text(employee.Email),
    contactNumber: text(employee.Phone),
    jobTitle: text(employee['Job Title']),
    location: text(employee.Location),
    department: text(employee['Home Department'] || employee.Department),
    firstDay: dateValue(employee, ['Hire Date', 'First Day']),
    terminationDay: terminationDay || null,
    reportingTo: [
      text(employee['Supervisor First Name']),
      text(employee['Supervisor Last Name']),
    ].filter(Boolean).join(' '),
    folderUrl: text(trainingRecord?.folderUrl),
    unsafeActs: Array.isArray(trainingRecord?.unsafeActs) ? trainingRecord.unsafeActs : [],
    orientationAssignedAt: trainingRecord?.orientationAssignedAt || null,
    isRehire: explicitRehire || archivedCycles.length > 0,
    previousHireDate: previousHireDate || null,
    previousTerminationDate: previousTerminationDate || null,
    priorServiceQualifiedForSafetyPto: priorServiceQualified,
    safetyPtoServiceBasis: priorServiceQualified
      ? 'Prior employment period satisfied the one-year requirement'
      : 'Current Hire Date must satisfy the one-year requirement',
    companyAppStatus: rawPositionStatus || (['active', 'true'].includes(accountStatus) ? 'Active' : (isTerminated ? 'Terminated' : 'Active')),
    employmentCategory,
    isPartTime: isPartTimeCategory(employmentCategory),
    employmentStatus: isTerminated ? 'Terminated' : 'Active',
    training: normalizeTraining(trainingRecord, orientationLibraries, monthlyTopics),
  };
}

module.exports = {
  normalizeEmployee,
  normalizeTraining,
  completedAtLeastOneYear,
  explicitPriorServiceQualified,
  isPartTimeCategory,
  TRAINING_TYPES,
};
