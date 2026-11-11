const clean = value => value == null ? '' : String(value).trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const employeeName = employee => [clean(employee?.['First Name']), clean(employee?.['Last Name'])].filter(Boolean).join(' ') || clean(employee?.name);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

const NOVEMBER_1_2026_SALARY_CHANGES = Object.freeze([
  ['Tommy Westfall', 130000, '2026-09-16', '2026-09-16', true], ['Ken Bumgardner', 420000], ['Stratos Dallis', 104750],
  ['Mike Morrison', 150000], ['Anthony Sciara', 210000], ['Adam Pigeon', 315000],
  ['Abbie Sack', 165000], ['Myra Yu', 135000], ['Phil Barnhart', 130000],
  ['April Ouding', 100000], ['Julie Igielski', 262500], ['Ashley Cooper', 70000],
  ['Robert Smoke', 72500], ['Carole Vandawalker', 60000], ['Robert Pelkey', 75000],
  ['Alyssa Sowders', 55000], ['Cherie Lynch', 75000], ['Jim Malone', 85000],
  ['Mike Griffiths', 95000], ['John Eurich', 95000], ['Keith Kline', 100000],
  ['Charles Vanover', 110000], ['Paul Rodriguez', 110000], ['Mary Ling', 110000],
  ['Russell Mullen', 75000], ['Jeffrey Guldenstein', 67000], ['Joey Smith', 55000],
  ['Scott Chapman', 103000],
].map(([name, annualSalary, effectiveDate = '2026-11-01', payrollDate = '2026-11-20', payrollCompleted = false]) => Object.freeze({ name, annualSalary, effectiveDate, payrollDate, payrollCompleted })));

const NAME_ALIASES = new Map([
  ['myra yu', ['myra yu', 'xuan yu']],
  ['ken bumgardner', ['ken bumgardner', 'kenneth bumgardner', 'kenneth carl bumgardner']],
  ['tommy westfall', ['tommy westfall', 'thomas westfall']],
  ['mike morrison', ['mike morrison', 'michael morrison']],
  ['phil barnhart', ['phil barnhart', 'philip barnhart']],
  ['jim malone', ['jim malone', 'james malone']],
  ['mike griffiths', ['mike griffiths', 'michael griffiths']],
  ['paul rodriguez', ['paul rodriguez', 'paul rodriguez jr']],
  ['jeffrey guldenstein', ['jeffrey guldenstein', 'jeffery guldenstein']],
  ['joey smith', ['joey smith', 'joseph smith']],
]);

const targetNames = target => NAME_ALIASES.get(normalize(target.name)) || [normalize(target.name)];
function findEmployeeForSalaryTarget(target, employees) {
  const directNames = new Set(targetNames(target));
  const direct = employees.find(employee => directNames.has(normalize(employeeName(employee))));
  if (direct) return direct;
  const targetParts = normalize(target.name).split(' ');
  const first = targetParts[0];
  const last = targetParts[targetParts.length - 1];
  const candidates = employees.filter(employee => {
    const parts = normalize(employeeName(employee)).split(' ');
    return parts[0] === first && parts[parts.length - 1] === last;
  });
  return candidates.length === 1 ? candidates[0] : null;
}
const payrollChangeRecorded = record => record?.requestedTracking?.payroll === true
  || Number(record?.requestedPayRate?.amount) > 0
  || (Array.isArray(record?.changes) && record.changes.some(change => /pay rate|salary/i.test(clean(change?.field))));
const recordedSalary = record => {
  const requested = Number(record?.requestedPayRate?.amount);
  if (Number.isFinite(requested) && requested > 0) return requested;
  const payChange = Array.isArray(record?.changes) ? record.changes.find(change => /pay rate|salary/i.test(clean(change?.field))) : null;
  const parsed = Number(clean(payChange?.to).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function historicalImportTasks(target, existingTasks = {}) {
  const completedAt = target.payrollCompleted ? new Date(`${target.payrollDate}T12:00:00.000Z`) : null;
  const systemActor = 'System migration — confirmed 2026 salary adjustment list';
  const existingPayroll = existingTasks.payroll || {};
  return {
    ...existingTasks,
    file: {
      ...(existingTasks.file || {}), required: false,
      checkedAt: null, checkedBy: '', finalReviewedAt: null, finalReviewedBy: '',
    },
    payroll: {
      ...existingPayroll, required: true, applicable: true, actionDate: target.payrollDate,
      checkedAt: completedAt, checkedBy: completedAt ? systemActor : '',
      finalReviewedAt: completedAt, finalReviewedBy: completedAt ? systemActor : '',
      completedAt: null, completedBy: '',
    },
    insurance: existingTasks.insurance || { required: false, applicable: false, actionDate: '', checkedAt: null, checkedBy: '' },
    retirement: existingTasks.retirement || { required: false, applicable: false, actionDate: '', checkedAt: null, checkedBy: '' },
    followUp: existingTasks.followUp || existingTasks.other || { required: false, checkedAt: null, checkedBy: '', finalReviewedAt: null, finalReviewedBy: '' },
  };
}

async function ensureNovemberSalaryEmploymentChanges(db) {
  const employeeCollection = db.collection('employees');
  const changeCollection = db.collection('employee_hr_employment_change');
  const [employees, existingChanges] = await Promise.all([
    employeeCollection.find({}).toArray(),
    changeCollection.find({ effectiveDate: { $in: [...new Set(NOVEMBER_1_2026_SALARY_CHANGES.map(target => target.effectiveDate).concat('2026-11-01'))] } }).toArray(),
  ]);
  const existingByEmployeeId = existingChanges.reduce((records, record) => {
    const employeeId = clean(record.employeeId);
    records.set(employeeId, [...(records.get(employeeId) || []), record]);
    return records;
  }, new Map());
  const summary = { total: NOVEMBER_1_2026_SALARY_CHANGES.length, alreadyRecorded: 0, updated: 0, inserted: 0, employeesNotFound: [] };

  for (const target of NOVEMBER_1_2026_SALARY_CHANGES) {
    const employee = findEmployeeForSalaryTarget(target, employees);
    if (!employee) {
      summary.employeesNotFound.push(target.name);
      continue;
    }
    const employeeId = String(employee._id);
    const employeeChanges = existingByEmployeeId.get(employeeId) || [];
    const exactRecord = employeeChanges.find(record => clean(record.effectiveDate) === target.effectiveDate);
    const staleBackfill = employeeChanges.find(record => record.historicalBackfill === true && clean(record.effectiveDate) === '2026-11-01');
    const existing = exactRecord || staleBackfill;
    if (exactRecord && staleBackfill && String(exactRecord._id) !== String(staleBackfill._id)) {
      await changeCollection.deleteOne({ _id: staleBackfill._id });
    }
    const needsEffectiveDateCorrection = existing?.historicalBackfill === true && clean(existing.effectiveDate) !== target.effectiveDate;
    const needsWorkflowCorrection = existing?.historicalBackfill === true && Number(existing.salaryHistoryVersion || 0) < 2;
    if (existing && !needsEffectiveDateCorrection && !needsWorkflowCorrection && payrollChangeRecorded(existing) && recordedSalary(existing) === target.annualSalary) {
      summary.alreadyRecorded += 1;
      continue;
    }
    const salaryDescription = `Annual Salary: ${money(target.annualSalary)}`;
    const change = { field: 'Pay Rate', from: 'Prior salary not retained in this historical import', to: salaryDescription };
    if (existing) {
      const changes = Array.isArray(existing.changes) ? existing.changes.filter(item => !/pay rate|salary/i.test(clean(item?.field))) : [];
      changes.push(change);
      await changeCollection.updateOne({ _id: existing._id }, { $set: {
        changes,
        requestedPayRate: { type: 'Annual Salary', amount: target.annualSalary },
        requestedTracking: { ...(existing.requestedTracking || {}), payroll: true },
        effectiveDate: target.effectiveDate,
        reason: `Confirmed ${target.effectiveDate === '2026-11-01' ? 'November 1' : 'September 16'}, 2026 compensation adjustment`,
        tasks: existing.historicalBackfill === true && (needsEffectiveDateCorrection || needsWorkflowCorrection) ? historicalImportTasks(target, existing.tasks) : existing.tasks,
        ...(existing.historicalBackfill === true ? { salaryHistoryVersion: 2 } : {}),
        updatedAt: new Date(), updatedBy: 'System migration — confirmed 2026 salary adjustment list',
      } });
      summary.updated += 1;
      continue;
    }
    await changeCollection.insertOne({
      employeeId,
      employeeName: employeeName(employee),
      employeeEmail: clean(employee.Email),
      payCategory: clean(employee['Pay Category']) || 'Salary',
      effectiveDate: target.effectiveDate,
      reason: `Confirmed ${target.effectiveDate === '2026-11-01' ? 'November 1' : 'September 16'}, 2026 compensation adjustment`,
      employeeFolderUrl: '', followUpIssues: false, followUpNotes: '', followUpUntil: '',
      changes: [change],
      requestedPayRate: { type: 'Annual Salary', amount: target.annualSalary },
      requestedTracking: { payroll: true, insurance: false, retirement: false },
      tasks: historicalImportTasks(target),
      historicalBackfill: true, salaryHistoryVersion: 2,
      createdAt: new Date(), createdBy: 'System migration — confirmed 2026 salary adjustment list',
    });
    summary.inserted += 1;
  }
  return summary;
}

module.exports = { NOVEMBER_1_2026_SALARY_CHANGES, findEmployeeForSalaryTarget, ensureNovemberSalaryEmploymentChanges };
