const TRAINING_TYPES = ['orientation', 'monthly'];
const { normalizeOrientation } = require('./orientationCatalog');
const { normalizeMonthly } = require('./monthlyCatalog');

function text(value) {
  return value == null ? '' : String(value).trim();
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

function normalizeEmployee(employee, trainingRecord, orientationLibraries, monthlyTopics) {
  const firstName = text(employee['First Name']);
  const lastName = text(employee['Last Name']);
  const terminationDay = dateValue(employee, ['Termination Date', 'Termination Day']);
  const accountStatus = text(employee['Account Active']).toLowerCase();
  const positionStatus = text(employee['Position Status']).toLowerCase();
  const isTerminated = Boolean(terminationDay)
    || ['inactive', 'terminated'].includes(accountStatus)
    || ['inactive', 'terminated'].includes(positionStatus);

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
    employmentStatus: isTerminated ? 'Terminated' : 'Active',
    training: normalizeTraining(trainingRecord, orientationLibraries, monthlyTopics),
  };
}

module.exports = {
  normalizeEmployee,
  normalizeTraining,
  TRAINING_TYPES,
};
