function clean(value) {
  return value == null ? '' : String(value).trim();
}

function savedAt(record = {}) {
  const value = record.updatedAt || record.createdAt || record.archivedAt || 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function findExistingEmployeeFolderUrl(db, employeeId) {
  const id = clean(employeeId);
  if (!id) return '';

  const [newHire, employmentChanges, termination, leaves] = await Promise.all([
    db.collection('employee_hr_platform').findOne({ employeeId: id }, { projection: { employeeFolderUrl: 1, updatedAt: 1, createdAt: 1 } }),
    db.collection('employee_hr_employment_change').find({ employeeId: id, employeeFolderUrl: { $nin: ['', null] } }).sort({ updatedAt: -1, createdAt: -1 }).limit(1).toArray(),
    db.collection('employee_hr_termination').findOne({ employeeId: id }, { projection: { employeeFolderUrl: 1, updatedAt: 1, createdAt: 1 } }),
    db.collection('employee_hr_leave').find({ employeeId: id, medicalFolderUrl: { $nin: ['', null] } }).sort({ updatedAt: -1, createdAt: -1 }).limit(1).toArray(),
  ]);

  return [
    { url: clean(newHire?.employeeFolderUrl), record: newHire },
    { url: clean(employmentChanges[0]?.employeeFolderUrl), record: employmentChanges[0] },
    { url: clean(termination?.employeeFolderUrl), record: termination },
    { url: clean(leaves[0]?.medicalFolderUrl), record: leaves[0] },
  ]
    .filter(candidate => candidate.url)
    .sort((left, right) => savedAt(right.record) - savedAt(left.record))[0]?.url || '';
}

module.exports = { findExistingEmployeeFolderUrl };
