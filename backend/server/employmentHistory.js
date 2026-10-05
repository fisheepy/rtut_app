function clean(value) {
  return value == null ? '' : String(value).trim();
}

function dateOnly(value) {
  const match = clean(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '';
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  const normalized = Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  return normalized === `${match[1]}-${match[2]}-${match[3]}` ? normalized : '';
}

function isRehireValue(value) {
  return value === true || /^yes$/i.test(clean(value));
}

function oneYearAnniversary(hireDate) {
  const normalized = dateOnly(hireDate);
  if (!normalized) return '';
  const [year, month, day] = normalized.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year + 1, month, 0)).getUTCDate();
  return new Date(Date.UTC(year + 1, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

function completedOneYear(hireDate, terminationDate) {
  const anniversary = oneYearAnniversary(hireDate);
  const ended = dateOnly(terminationDate);
  return Boolean(anniversary && ended && ended >= anniversary);
}

function validatePreviousEmployment(input) {
  const isRehire = isRehireValue(input?.isRehire);
  const previousHireDate = dateOnly(input?.previousHireDate);
  const previousTerminationDate = dateOnly(input?.previousTerminationDate);
  const currentHireDate = dateOnly(input?.hireDate);
  if (!isRehire) return { isRehire: false, previousHireDate: '', previousTerminationDate: '' };
  if (!previousHireDate || !previousTerminationDate) throw new Error('Rehire employees require the Previous Hire Date and Previous Termination Date.');
  if (previousTerminationDate < previousHireDate) throw new Error('Previous Termination Date cannot be before Previous Hire Date.');
  if (currentHireDate && previousTerminationDate > currentHireDate) throw new Error('Previous Termination Date cannot be after the current Hire Date.');
  return { isRehire: true, previousHireDate, previousTerminationDate };
}

module.exports = { completedOneYear, dateOnly, isRehireValue, validatePreviousEmployment };
