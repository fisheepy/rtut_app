const clean = value => value == null ? '' : String(value).trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const employeeName = employee => [clean(employee?.['First Name']), clean(employee?.['Last Name'])].filter(Boolean).join(' ');
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

const NOVEMBER_1_2026_SALARY_CHANGES = Object.freeze([
  ['Tommy Westfall', 130000], ['Ken Bumgardner', 420000], ['Stratos Dallis', 104750],
  ['Mike Morrison', 150000], ['Anthony Sciara', 210000], ['Adam Pigeon', 315000],
  ['Abbie Sack', 165000], ['Myra Yu', 135000], ['Phil Barnhart', 130000],
  ['April Ouding', 100000], ['Julie Igielski', 262500], ['Ashley Cooper', 70000],
  ['Robert Smoke', 72500], ['Carole Vandawalker', 60000], ['Robert Pelkey', 75000],
  ['Alyssa Sowders', 55000], ['Cherie Lynch', 75000], ['Jim Malone', 85000],
  ['Mike Griffiths', 95000], ['John Eurich', 95000], ['Keith Kline', 100000],
  ['Charles Vanover', 110000], ['Paul Rodriguez', 110000], ['Mary Ling', 110000],
  ['Russell Mullen', 75000], ['Jeffrey Guldenstein', 67000], ['Joey Smith', 55000],
  ['Scott Chapman', 103000],
].map(([name, annualSalary]) => Object.freeze({ name, annualSalary })));

const NAME_ALIASES = new Map([
  ['myra yu', ['myra yu', 'xuan yu']],
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

function completedTasks(existingTasks = {}, effectiveDate = '2026-11-01') {
  const completedAt = new Date(`${effectiveDate}T12:00:00.000Z`);
  const systemActor = 'System migration — confirmed Nov. 1, 2026 salary list';
  return {
    ...existingTasks,
    file: existingTasks.file || { required: false, checkedAt: completedAt, checkedBy: systemActor, finalReviewedAt: completedAt, finalReviewedBy: systemActor },
    payroll: {
      ...(existingTasks.payroll || {}), required: true, applicable: true, actionDate: effectiveDate,
      checkedAt: existingTasks.payroll?.checkedAt || completedAt,
      checkedBy: existingTasks.payroll?.checkedBy || systemActor,
      finalReviewedAt: existingTasks.payroll?.finalReviewedAt || completedAt,
      finalReviewedBy: existingTasks.payroll?.finalReviewedBy || systemActor,
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
    changeCollection.find({ effectiveDate: '2026-11-01' }).toArray(),
  ]);
  const employeesByName = new Map(employees.map(employee => [normalize(employeeName(employee)), employee]));
  const existingByEmployeeId = new Map(existingChanges.map(record => [clean(record.employeeId), record]));
  const summary = { total: NOVEMBER_1_2026_SALARY_CHANGES.length, alreadyRecorded: 0, updated: 0, inserted: 0, employeesNotFound: [] };

  for (const target of NOVEMBER_1_2026_SALARY_CHANGES) {
    const employee = targetNames(target).map(name => employeesByName.get(name)).find(Boolean);
    if (!employee) {
      summary.employeesNotFound.push(target.name);
      continue;
    }
    const employeeId = String(employee._id);
    const existing = existingByEmployeeId.get(employeeId);
    if (existing && payrollChangeRecorded(existing) && recordedSalary(existing) === target.annualSalary) {
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
        tasks: completedTasks(existing.tasks),
        updatedAt: new Date(), updatedBy: 'System migration — confirmed Nov. 1, 2026 salary list',
      } });
      summary.updated += 1;
      continue;
    }
    await changeCollection.insertOne({
      employeeId,
      employeeName: employeeName(employee),
      employeeEmail: clean(employee.Email),
      payCategory: clean(employee['Pay Category']) || 'Salary',
      effectiveDate: '2026-11-01',
      reason: 'Confirmed November 1, 2026 compensation adjustment',
      employeeFolderUrl: '', followUpIssues: false, followUpNotes: '', followUpUntil: '',
      changes: [change],
      requestedPayRate: { type: 'Annual Salary', amount: target.annualSalary },
      requestedTracking: { payroll: true, insurance: false, retirement: false },
      tasks: completedTasks(),
      historicalBackfill: true,
      createdAt: new Date(), createdBy: 'System migration — confirmed Nov. 1, 2026 salary list',
    });
    summary.inserted += 1;
  }
  return summary;
}

module.exports = { NOVEMBER_1_2026_SALARY_CHANGES, ensureNovemberSalaryEmploymentChanges };
