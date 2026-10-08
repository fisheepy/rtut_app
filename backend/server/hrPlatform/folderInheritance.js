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

  const current = await db.collection('employee_folder_links').findOne({ employeeId: id });
  if (current && clean(current.url)) return clean(current.url);

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

async function saveCurrentEmployeeFolderUrl(db, employeeId, url, source, updatedBy = '') {
  const id = clean(employeeId);
  const value = clean(url);
  if (!id || !value) return;
  await db.collection('employee_folder_links').updateOne(
    { employeeId: id },
    { $set: { employeeId: id, url: value, source: clean(source), updatedAt: new Date(), updatedBy: clean(updatedBy) } },
    { upsert: true },
  );
}

module.exports = { findExistingEmployeeFolderUrl, saveCurrentEmployeeFolderUrl };
