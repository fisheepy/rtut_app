function normalizedUsername(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildEarliestAcceptanceMap(acceptances = []) {
  const earliestByUsername = new Map();
  for (const acceptance of acceptances) {
    if (acceptance?.accepted !== true) continue;
    const username = normalizedUsername(acceptance.username);
    const timestamp = validDate(acceptance.timestamp);
    if (!username || !timestamp) continue;
    const current = earliestByUsername.get(username);
    if (!current || timestamp < current) earliestByUsername.set(username, timestamp);
  }
  return earliestByUsername;
}

function resolveAppRegistrationDate(employee, earliestAcceptanceByUsername = new Map()) {
  return validDate(employee?.['App Registration Date'])
    || validDate(employee?.activationDate)
    || earliestAcceptanceByUsername.get(normalizedUsername(employee?.username))
    || null;
}

function employeeForExport(employee, registrationDate) {
  const {
    'Activation Date': _legacyImportDate,
    activationDate: _legacyRegistrationDate,
    ...exported
  } = employee;
  return {
    ...exported,
    'App Registration Date': registrationDate || null,
  };
}

module.exports = {
  buildEarliestAcceptanceMap,
  employeeForExport,
  resolveAppRegistrationDate,
};
