const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const { SALARY_EMPLOYEES } = require('../compensation/salaryEmployees');
const { HOURLY_EMPLOYEES } = require('../compensation/hourlyEmployees');
const { answerWithSmartAi } = require('./smartAi');

const clean = value => value == null ? '' : String(value).trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const employeeName = employee => [clean(employee['First Name']), clean(employee['Last Name'])].filter(Boolean).join(' ');
const isTerminated = employee => /^(terminated|inactive)$/i.test(clean(employee['Position Status'])) || Boolean(clean(employee['Termination Date']));
const money = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value)) : '';
const dateOnly = value => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = clean(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};
const easternMonthKey = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`;
};
const easternDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}-${parts.find(part => part.type === 'day')?.value}`;
};
const TURNOVER_Q3_2026 = [
  { location: 'Corporate', denominator: 23, voluntary: 1, involuntary: 0 },
  { location: 'Dearborn', denominator: 66, voluntary: 5, involuntary: 4 },
  { location: 'East Michigan', denominator: 13, voluntary: 0, involuntary: 0 },
  { location: 'Gaylord', denominator: 9, voluntary: 2, involuntary: 0 },
  { location: 'Grand Rapids', denominator: 39, voluntary: 4, involuntary: 1 },
  { location: 'Hudsonville', denominator: 31, voluntary: 2, involuntary: 1 },
  { location: 'Cleveland', denominator: 7, voluntary: 0, involuntary: 0 },
  { location: 'Warren', denominator: 25, voluntary: 2, involuntary: 1 },
  { location: 'West Michigan', denominator: 11, voluntary: 0, involuntary: 3 },
  { location: 'Wixom', denominator: 9, voluntary: 0, involuntary: 1 },
];
const TURNOVER_Q3_2026_INCLUDED_NAMES = new Set([
  'zachary ghadieh', 'sean matatall', 'harold tackett', 'gary melletat', 'sean cullen', 'tristen kuprienko',
  'rebecca murphy', 'kimberlee arnold', 'micah herin', 'cordell wyatt', 'david schoenherr', 'nathan alda',
  'joshua rapley', 'wala baha', 'jeffrey ouellette', 'taylor flamard', 'michael dewater', 'amanda weber',
  'timothy leys jr', 'tyler revard', 'robert bright', 'nathan woods', 'james ray mcfarland', 'matthew hough',
  'steven chapman ii', 'vincent lisowski', 'brian trombley',
].map(normalize));
const TURNOVER_Q3_2026_EXCLUDED_EMPLOYEES = {
  deceased: ['Dale Day'],
  retired: ['Daniel Savat', 'Kenneth Allen', 'Leslie Carder', 'Mark Duimstra'],
};
const TURNOVER_Q3_2026_EVENTS = [
  ['Zachary Ghadieh', 'Involuntary', 'Dearborn'], ['Sean Matatall', 'Involuntary', 'Dearborn'],
  ['Harold Tackett', 'Involuntary', 'Dearborn'], ['Gary Melletat', 'Involuntary', 'Dearborn'],
  ['Sean Cullen', 'Involuntary', 'Grand Rapids'], ['Tristen Kuprienko', 'Involuntary', 'Hudsonville'],
  ['Rebecca Murphy', 'Involuntary', 'West Michigan'], ['Kimberlee Arnold', 'Involuntary', 'West Michigan'],
  ['Micah Herin', 'Involuntary', 'West Michigan'], ['Cordell Wyatt', 'Involuntary', 'Wixom'],
  ['David Schoenherr', 'Involuntary', 'Warren'], ['Nathan Alda', 'Voluntary', 'Dearborn'],
  ['Joshua Rapley', 'Voluntary', 'Dearborn'], ['Wala Baha', 'Voluntary', 'Dearborn'],
  ['Jeffrey Ouellette', 'Voluntary', 'Dearborn'], ['Taylor Flamard', 'Voluntary', 'Dearborn'],
  ['Michael Dewater', 'Voluntary', 'Gaylord'], ['Amanda Weber', 'Voluntary', 'Gaylord'],
  ['Timothy Leys Jr', 'Voluntary', 'Grand Rapids'], ['Tyler Revard', 'Voluntary', 'Grand Rapids'],
  ['Robert Bright', 'Voluntary', 'Grand Rapids'], ['Nathan Woods', 'Voluntary', 'Grand Rapids'],
  ['James Ray McFarland', 'Voluntary', 'Hudsonville'], ['Matthew Hough', 'Voluntary', 'Hudsonville'],
  ['Steven Chapman II', 'Voluntary', 'Warren'], ['Vincent Lisowski', 'Voluntary', 'Warren'],
  ['Brian Trombley', 'Voluntary', 'Corporate'],
].map(([name, type, location]) => ({ name, type, location, terminationDate: '', period: 'Q3 2026 baseline' }));
const canonicalTurnoverLocation = value => {
  const key = normalize(value);
  if (['corporate', 'northville'].includes(key)) return 'Corporate';
  if (['dearborn', 'dearborn warehouse'].includes(key)) return 'Dearborn';
  if (['ohio cleveland', 'cleveland'].includes(key)) return 'Cleveland';
  return clean(value) || 'Not Recorded';
};
const turnoverRate = (count, denominator) => denominator ? Math.round(count / denominator * 1000) / 10 : 0;
const turnoverSummary = rows => {
  const denominator = rows.reduce((sum, row) => sum + row.denominator, 0);
  const voluntary = rows.reduce((sum, row) => sum + row.voluntary, 0);
  const involuntary = rows.reduce((sum, row) => sum + row.involuntary, 0);
  return {
    denominator,
    voluntary,
    involuntary,
    total: voluntary + involuntary,
    totalRate: turnoverRate(voluntary + involuntary, denominator),
    voluntaryRate: turnoverRate(voluntary, denominator),
    involuntaryRate: turnoverRate(involuntary, denominator),
  };
};
const turnoverRowsWithRates = rows => rows.map(row => ({
  ...row,
  total: row.voluntary + row.involuntary,
  totalRate: turnoverRate(row.voluntary + row.involuntary, row.denominator),
  voluntaryRate: turnoverRate(row.voluntary, row.denominator),
  involuntaryRate: turnoverRate(row.involuntary, row.denominator),
}));
const isPreEmploymentCancellation = employee => {
  const hireDate = dateOnly(employee?.['Hire Date']);
  const terminationDate = dateOnly(employee?.['Termination Date']);
  const terminatedBeforeStartDate = isTerminated(employee) && hireDate && hireDate > easternDateKey();
  const terminationPrecedesHire = hireDate && terminationDate && terminationDate < hireDate;
  return Boolean(terminatedBeforeStartDate || terminationPrecedesHire);
};

function taskIncomplete(task = {}, finalRequired = false) {
  if (task.required !== true && task.applicable !== true) return false;
  return finalRequired ? !task.finalReviewedAt : !(task.checkedAt || task.completedAt);
}

function employmentChangeIncomplete(record = {}) {
  return taskIncomplete(record.tasks?.file, true)
    || taskIncomplete(record.tasks?.payroll, true)
    || taskIncomplete(record.tasks?.insurance)
    || taskIncomplete(record.tasks?.retirement)
    || taskIncomplete(record.tasks?.followUp || record.tasks?.other, true);
}

function employmentChangeDetails(record = {}) {
  const details = (Array.isArray(record.changes) ? record.changes : []).map(change => {
    const field = clean(change?.field) || 'Employee Information';
    const from = clean(change?.from);
    const to = clean(change?.to);
    return from && to ? `${field}: ${from} → ${to}` : to ? `${field}: ${to}` : field;
  });
  if (record.requestedTracking?.payroll === true) details.push('Payroll Change Requested');
  if (record.requestedTracking?.insurance === true) details.push('Insurance Change Requested');
  if (record.requestedTracking?.retirement === true) details.push('401(k) Change Requested');
  return [...new Set(details)].join(' | ') || 'Change details not recorded';
}

function compensationRecord(name) {
  const key = normalize(name);
  const salary = SALARY_EMPLOYEES.find(employee => normalize(employee.name) === key);
  if (salary) return { payType: 'Salary', rate: salary.regularPay, source: 'Compensation Analysis salary snapshot effective November 1, 2026' };
  const hourly = HOURLY_EMPLOYEES.find(employee => normalize(employee.name) === key);
  if (hourly) return { payType: 'Hourly', rate: hourly.hourlyRate, source: 'Compensation Analysis hourly-rate snapshot' };
  return null;
}

function findEmployeeMatches(employees, question) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const exact = employees.filter(employee => normalizedQuestion.includes(` ${normalize(employeeName(employee))} `));
  if (exact.length) {
    const longest = Math.max(...exact.map(employee => normalize(employeeName(employee)).length));
    return exact.filter(employee => normalize(employeeName(employee)).length === longest);
  }
  return employees.filter(employee => {
    const first = normalize(employee['First Name']);
    const last = normalize(employee['Last Name']);
    return first && last && normalizedQuestion.includes(` ${last} `) && normalizedQuestion.includes(` ${first} `);
  });
}

function findLocationMatch(employees, question) {
  const normalizedQuestion = ` ${normalize(question)} `;
  const locations = [...new Set(employees.map(employee => clean(employee.Location)).filter(Boolean))];
  const matches = locations.filter(location => normalizedQuestion.includes(` ${normalize(location)} `));
  if (!matches.length) return '';
  return matches.sort((a, b) => normalize(b).length - normalize(a).length)[0];
}

function locationEmployeeDetails(employee) {
  const jobTitle = clean(employee['Job Title']) || 'Job title not recorded';
  const department = clean(employee['Home Department'] || employee.Department) || 'Department not recorded';
  const status = clean(employee['Position Status']) || 'Status not recorded';
  const payType = clean(employee['Pay Category']) || 'Pay type not recorded';
  return `${employeeName(employee)} — ${jobTitle} | ${department} | ${status} | ${payType}`;
}

function createExecutiveRouter({ uri, databaseName, requireExecutiveSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
  router.use(requireExecutiveSession);

  router.get('/overview', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const trainingDataLive = easternDateKey() >= '2027-01-01';
      const [employees, leaves, injuries, changes, newHireRecords, terminationRecords, trainingTopics, trainingRecords] = await Promise.all([
        db.collection('employees').find({}).toArray(),
        db.collection('employee_hr_leave').find({}).toArray(),
        db.collection('work_injury_cases').find({}).toArray(),
        db.collection('employee_hr_employment_change').find({}).toArray(),
        db.collection('employee_hr_platform').find({}).toArray(),
        db.collection('employee_hr_termination').find({}).toArray(),
        trainingDataLive ? db.collection('monthly_training_topics').find({}).sort({ order: 1, targetDate: 1, name: 1 }).toArray() : Promise.resolve([]),
        trainingDataLive ? db.collection('employee_training').find({}).toArray() : Promise.resolve([]),
      ]);
      const activeEmployees = employees.filter(employee => !isTerminated(employee));
      const employeeById = new Map(employees.map(employee => [String(employee._id), employee]));
      const newHireByEmployeeId = new Map(newHireRecords.map(record => [clean(record.employeeId), record]));
      const currentMonth = easternMonthKey();
      const currentMonthNewHires = employees
        .filter(employee => !isPreEmploymentCancellation(employee) && dateOnly(employee['Hire Date']).slice(0, 7) === currentMonth)
        .map(employee => {
          const record = newHireByEmployeeId.get(String(employee._id)) || {};
          const tracker = record.fileTracker || {};
          return {
            id: String(employee._id),
            name: employeeName(employee) || 'Name Not Recorded',
            hireDate: dateOnly(employee['Hire Date']),
            jobTitle: clean(employee['Job Title']) || 'Not Recorded',
            department: clean(employee['Home Department'] || employee.Department) || 'Not Recorded',
            location: clean(employee.Location) || 'Not Recorded',
            employeeStatus: clean(employee['Position Status']) || 'Active',
            onboardingStatus: tracker.finalLockedAt || tracker.confirmedAt ? 'Completed' : tracker.submittedAt ? 'Final Review Needed' : 'In Progress',
          };
        })
        .sort((a, b) => a.hireDate.localeCompare(b.hireDate) || a.name.localeCompare(b.name));
      const currentMonthTerminations = employees
        .filter(employee => !isPreEmploymentCancellation(employee) && dateOnly(employee['Termination Date']).slice(0, 7) === currentMonth)
        .map(employee => {
          return {
            id: String(employee._id),
            name: employeeName(employee) || 'Name Not Recorded',
            terminationDate: dateOnly(employee['Termination Date']),
            jobTitle: clean(employee['Job Title']) || 'Not Recorded',
            department: clean(employee['Home Department'] || employee.Department) || 'Not Recorded',
            location: clean(employee.Location) || 'Not Recorded',
            terminationType: clean(employee['Termination Type'] || terminationRecords.find(record => clean(record.employeeId) === String(employee._id))?.terminationType) || 'Not Recorded',
          };
        })
        .sort((a, b) => a.terminationDate.localeCompare(b.terminationDate) || a.name.localeCompare(b.name));
      const terminationByEmployeeId = new Map(terminationRecords.map(record => [clean(record.employeeId), record]));
      const currentTurnoverEmployees = employees.filter(employee => {
        const status = normalize(employee['Position Status']);
        return !dateOnly(employee['Termination Date']) && ['active', 'leave'].includes(status);
      });
      const ytdTurnoverByLocation = new Map(TURNOVER_Q3_2026.map(row => [row.location, { ...row, denominator: row.voluntary + row.involuntary }]));
      for (const employee of currentTurnoverEmployees) {
        const location = canonicalTurnoverLocation(employee.Location);
        if (location === 'Not Recorded') continue;
        const row = ytdTurnoverByLocation.get(location) || { location, denominator: 0, voluntary: 0, involuntary: 0 };
        row.denominator += 1;
        ytdTurnoverByLocation.set(location, row);
      }
      const unclassifiedTurnovers = [];
      const ytdTurnoverEvents = TURNOVER_Q3_2026_EVENTS.map(event => ({ ...event }));
      const turnoverYear = Number(easternDateKey().slice(0, 4));
      const excludedTurnoverEmployees = {
        deceased: new Set(turnoverYear === 2026 ? TURNOVER_Q3_2026_EXCLUDED_EMPLOYEES.deceased : []),
        retired: new Set(turnoverYear === 2026 ? TURNOVER_Q3_2026_EXCLUDED_EMPLOYEES.retired : []),
      };
      for (const employee of employees) {
        const terminationDate = dateOnly(employee['Termination Date']);
        if (!terminationDate.startsWith(`${turnoverYear}-`)) continue;
        const terminationType = clean(employee['Termination Type'] || terminationByEmployeeId.get(String(employee._id))?.terminationType);
        const exclusionType = normalize(terminationType || employee['Position Status']);
        if (['deceased', 'dead'].includes(exclusionType)) excludedTurnoverEmployees.deceased.add(employeeName(employee) || 'Name Not Recorded');
        if (exclusionType === 'retired') excludedTurnoverEmployees.retired.add(employeeName(employee) || 'Name Not Recorded');
      }
      for (const employee of employees) {
        const hireDate = dateOnly(employee['Hire Date']);
        const terminationDate = dateOnly(employee['Termination Date']);
        if (!terminationDate || terminationDate < '2026-10-01' || terminationDate > easternDateKey() || (hireDate && terminationDate < hireDate)) continue;
        if (TURNOVER_Q3_2026_INCLUDED_NAMES.has(normalize(employeeName(employee)))) continue;
        const terminationType = clean(employee['Termination Type'] || terminationByEmployeeId.get(String(employee._id))?.terminationType);
        const exclusionType = normalize(terminationType || employee['Position Status']);
        if (['deceased', 'dead'].includes(exclusionType)) {
          excludedTurnoverEmployees.deceased.add(employeeName(employee) || 'Name Not Recorded');
          continue;
        }
        if (exclusionType === 'retired') {
          excludedTurnoverEmployees.retired.add(employeeName(employee) || 'Name Not Recorded');
          continue;
        }
        const location = canonicalTurnoverLocation(employee.Location);
        if (location === 'Not Recorded') continue;
        if (!['Voluntary', 'Involuntary'].includes(terminationType)) {
          unclassifiedTurnovers.push(employeeName(employee) || 'Name Not Recorded');
          continue;
        }
        const row = ytdTurnoverByLocation.get(location) || { location, denominator: 0, voluntary: 0, involuntary: 0 };
        row.denominator += 1;
        row[terminationType.toLowerCase()] += 1;
        ytdTurnoverByLocation.set(location, row);
        ytdTurnoverEvents.push({ name: employeeName(employee) || 'Name Not Recorded', type: terminationType, location, terminationDate, period: 'After Q3 2026' });
      }
      const q3TurnoverRows = turnoverRowsWithRates(TURNOVER_Q3_2026);
      const ytdTurnoverRows = turnoverRowsWithRates([...ytdTurnoverByLocation.values()].sort((a, b) => a.location.localeCompare(b.location)));
      const currentMonthEmploymentChanges = changes
        .filter(record => dateOnly(record.effectiveDate).slice(0, 7) === currentMonth)
        .map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || {};
          return {
            id: String(record._id),
            employeeId: clean(record.employeeId),
            name: clean(record.employeeName) || employeeName(employee) || 'Name Not Recorded',
            effectiveDate: dateOnly(record.effectiveDate),
            jobTitle: clean(employee['Job Title']) || 'Not Recorded',
            department: clean(employee['Home Department'] || employee.Department) || 'Not Recorded',
            location: clean(employee.Location) || 'Not Recorded',
            changes: employmentChangeDetails(record),
            reason: clean(record.reason) || 'Not Recorded',
          };
        })
        .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.name.localeCompare(b.name));
      const currentLeaveCases = leaves
        .filter(record => {
          const startDate = dateOnly(record.leaveStartedAt || record.createdAt);
          const endDate = dateOnly(record.actualReturnDate || record.closedAt);
          return record.active === true || startDate.slice(0, 7) === currentMonth || endDate.slice(0, 7) === currentMonth;
        })
        .map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || record.employeeSnapshot || {};
          return {
            id: String(record._id),
            employeeId: clean(record.employeeId),
            name: employeeName(employee) || 'Name Not Recorded',
            leaveStartDate: dateOnly(record.leaveStartedAt || record.createdAt),
            anticipatedReturnDate: dateOnly(record.anticipatedReturnDate),
            actualReturnDate: dateOnly(record.actualReturnDate),
            closedDate: dateOnly(record.closedAt),
            jobTitle: clean(employee['Job Title']) || 'Not Recorded',
            department: clean(employee['Home Department'] || employee.Department) || 'Not Recorded',
            location: clean(employee.Location) || 'Not Recorded',
            companyStatus: clean(employee['Position Status'] || record.employeeStatus) || 'Not Recorded',
            caseStatus: record.active === true ? 'Open' : 'Closed',
          };
        })
        .sort((a, b) => (a.caseStatus === b.caseStatus ? a.leaveStartDate.localeCompare(b.leaveStartDate) : a.caseStatus === 'Open' ? -1 : 1) || a.name.localeCompare(b.name));
      const injuryDataLive = easternDateKey() >= '2027-01-01';
      const currentInjuryCases = injuryDataLive ? injuries
        .filter(record => {
          const injuryDate = dateOnly(record.injuryDateTime);
          const closedDate = dateOnly(record.closedAt);
          return !closedDate || injuryDate.slice(0, 7) === currentMonth || closedDate.slice(0, 7) === currentMonth;
        })
        .map(record => ({
          id: String(record._id),
          name: clean(record.employeeName) || 'Name Not Recorded',
          injuryDate: dateOnly(record.injuryDateTime),
          jobTitle: clean(record.jobTitle) || 'Not Recorded',
          department: clean(record.department) || 'Not Recorded',
          location: clean(record.location) || 'Not Recorded',
          workStatus: clean(record.workStatus === 'Other' ? record.otherWorkStatus : record.workStatus) || 'Pending Medical Evaluation',
          oshaRecordable: clean(record.oshaRecordable) || 'No',
          caseStatus: record.closedAt ? 'Closed' : 'Open',
        }))
        .sort((a, b) => (a.caseStatus === b.caseStatus ? a.injuryDate.localeCompare(b.injuryDate) : a.caseStatus === 'Open' ? -1 : 1) || a.name.localeCompare(b.name)) : [];
      const currentTrainingTopics = trainingDataLive
        ? trainingTopics.filter(topic => dateOnly(topic.targetDate).slice(0, 7) === currentMonth)
        : [];
      const trainingByEmployeeId = new Map(trainingRecords.map(record => [clean(record.employeeId), record]));
      const trainingPrograms = currentTrainingTopics.map(topic => ({
        id: clean(topic.id),
        name: clean(topic.name) || 'Monthly Training Program',
        targetDate: dateOnly(topic.targetDate),
        courseCount: Array.isArray(topic.courses) ? topic.courses.length : 0,
        assigned: 0,
        completed: 0,
        completionRate: null,
      }));
      const trainingLocations = new Map();
      let trainingAssigned = 0;
      let trainingCompleted = 0;
      if (trainingDataLive && currentTrainingTopics.length) {
        for (const employee of activeEmployees) {
          const location = clean(employee.Location) || 'Not Recorded';
          const record = trainingByEmployeeId.get(String(employee._id)) || {};
          for (const program of trainingPrograms) {
            const topic = currentTrainingTopics.find(item => clean(item.id) === program.id) || {};
            const assignment = record.monthly?.topicAssignments?.[program.id];
            if (assignment?.requirement !== 'Required') continue;
            const courses = Array.isArray(topic.courses) ? topic.courses : [];
            const completed = assignment.completionStatus === 'Finished'
              || Boolean(courses.length && courses.every(course => clean(assignment.courseProgress?.[clean(course.id)]?.completedAt)));
            program.assigned += 1;
            trainingAssigned += 1;
            const locationStats = trainingLocations.get(location) || { location, assigned: 0, completed: 0, completionRate: null };
            locationStats.assigned += 1;
            if (completed) {
              program.completed += 1;
              trainingCompleted += 1;
              locationStats.completed += 1;
            }
            trainingLocations.set(location, locationStats);
          }
        }
      }
      trainingPrograms.forEach(program => { program.completionRate = program.assigned ? Math.round(program.completed / program.assigned * 100) : null; });
      const trainingLocationRows = [...trainingLocations.values()].map(row => ({ ...row, completionRate: row.assigned ? Math.round(row.completed / row.assigned * 100) : null })).sort((a, b) => a.location.localeCompare(b.location));
      const locations = Object.entries(activeEmployees.reduce((result, employee) => {
        const location = clean(employee.Location) || 'Not Recorded';
        result[location] = (result[location] || 0) + 1;
        return result;
      }, {})).sort((a, b) => b[1] - a[1]).map(([location, count]) => ({ location, count }));
      return res.json({
        email: clean(req.adminSession?.email).toLowerCase(),
        generatedAt: new Date(),
        headcount: activeEmployees.length,
        locations,
        employees: activeEmployees
          .map(employee => ({
            id: String(employee._id),
            name: employeeName(employee) || 'Name Not Recorded',
            jobTitle: clean(employee['Job Title']) || 'Not Recorded',
            department: clean(employee['Home Department'] || employee.Department) || 'Not Recorded',
            location: clean(employee.Location) || 'Not Recorded',
            status: clean(employee['Position Status']) || 'Active',
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        currentMonth,
        currentMonthNewHires,
        currentMonthTerminations,
        currentMonthEmploymentChanges,
        currentLeaveCases,
        injuryDataLive,
        injuryLaunchDate: '2027-01-01',
        currentInjuryCases,
        trainingDataLive,
        trainingLaunchDate: '2027-01-01',
        trainingOverview: {
          programs: trainingPrograms,
          assigned: trainingAssigned,
          completed: trainingCompleted,
          completionRate: trainingAssigned ? Math.round(trainingCompleted / trainingAssigned * 100) : null,
          locations: trainingLocationRows,
        },
        turnover: {
          year: turnoverYear,
          q1: { status: 'Not Loaded', label: 'Q1 2026' },
          q2: { status: 'Not Loaded', label: 'Q2 2026' },
          q3: { status: 'Final', label: 'Q3 2026', asOf: '2026-09-30', summary: turnoverSummary(q3TurnoverRows), locations: q3TurnoverRows, events: TURNOVER_Q3_2026_EVENTS },
          q4: { status: easternDateKey() >= '2026-12-31' ? 'Ready for Review' : 'Pending Quarter End', label: 'Q4 2026' },
          ytd: { status: 'Current', label: '2026 Year to Date', asOf: easternDateKey(), summary: turnoverSummary(ytdTurnoverRows), locations: ytdTurnoverRows, events: ytdTurnoverEvents },
          excluded: {
            leave: 'Leave-status employees remain in the employee denominator and are not counted as turnover.',
            retiredOrDeceased: 'Retired and deceased employees are excluded from turnover events.',
            preEmployment: 'Employees terminated before their Hire Date are excluded.',
          },
          excludedEmployees: {
            deceased: [...excludedTurnoverEmployees.deceased].sort((a, b) => a.localeCompare(b)),
            retired: [...excludedTurnoverEmployees.retired].sort((a, b) => a.localeCompare(b)),
          },
          unclassifiedTurnovers,
        },
        openLeaveCases: leaves.filter(record => record.active === true).length,
        openInjuryCases: injuryDataLive ? injuries.filter(record => !record.closedAt).length : 0,
        unfinishedEmploymentChanges: changes.filter(employmentChangeIncomplete).length,
        smartAiEnabled: Boolean(clean(process.env.OPENAI_API_KEY)),
      });
    } catch (error) {
      console.error('Unable to load Executive Intelligence overview:', error);
      return res.status(500).json({ error: 'Executive overview could not be loaded.' });
    } finally { await client.close(); }
  });

  router.post('/ask', async (req, res) => {
    const question = clean(req.body?.question).slice(0, 500);
    if (question.length < 3) return res.status(400).json({ error: 'Enter a question.' });
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({}).toArray();
      const activeEmployees = employees.filter(employee => !isTerminated(employee));
      const q = normalize(question);
      const location = findLocationMatch(activeEmployees, question);
      let response;
      let smartAiError = '';

      if (clean(process.env.OPENAI_API_KEY)) {
        try {
          response = await answerWithSmartAi({ question, db, employees, compensationRecord, employmentChangeIncomplete });
        } catch (error) {
          smartAiError = clean(error?.message).slice(0, 180);
          console.error('Smart AI unavailable; using guided assistant fallback:', smartAiError);
        }
      }

      if (response) {
        // Smart AI already produced a source-backed response.
      } else if (location && /employee|people|staff|headcount|team|who works|who is|list|show/.test(q)) {
        const locationEmployees = activeEmployees
          .filter(employee => normalize(employee.Location) === normalize(location))
          .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
        response = {
          answer: `${location} currently has ${locationEmployees.length} active or leave-status employees.`,
          details: locationEmployees.map(locationEmployeeDetails),
          sources: ['Company App employee roster'],
          dataAsOf: new Date(),
        };
      } else if (/headcount|how many employees|employee count|total employees/.test(q)) {
        const locationCounts = Object.entries(activeEmployees.reduce((result, employee) => {
          const location = clean(employee.Location) || 'Not Recorded'; result[location] = (result[location] || 0) + 1; return result;
        }, {})).sort((a, b) => b[1] - a[1]);
        response = { answer: `Royal currently has ${activeEmployees.length} active or leave-status employees.`, details: locationCounts.map(([label, value]) => `${label}: ${value}`), sources: ['Company App employee roster'], dataAsOf: new Date() };
      } else if (/leave|fmla|medical/.test(q) && !findEmployeeMatches(employees, question).length) {
        const leaves = await db.collection('employee_hr_leave').find({ active: true }).toArray();
        response = { answer: `There are ${leaves.length} open FMLA / ADA / Medical Leave cases.`, details: [], sources: ['HR Platform medical leave cases'], dataAsOf: new Date() };
      } else if (/injury|osha/.test(q) && !findEmployeeMatches(employees, question).length) {
        const injuries = await db.collection('work_injury_cases').find({ closedAt: { $in: [null, ''] } }).toArray();
        const osha = injuries.filter(record => /^yes$/i.test(clean(record.oshaRecordable))).length;
        response = { answer: `There are ${injuries.length} open injury cases, including ${osha} marked OSHA recordable.`, details: [], sources: ['Work-Related Injury platform'], dataAsOf: new Date() };
      } else {
        const matches = findEmployeeMatches(employees, question);
        if (!matches.length) {
          response = { answer: 'I could not identify an employee in that question. Please enter the employee’s first and last name.', details: [], sources: [], dataAsOf: new Date() };
        } else if (matches.length > 1) {
          response = { answer: 'More than one employee matched. Please use the employee’s full name.', details: matches.slice(0, 8).map(employeeName), sources: ['Company App employee roster'], dataAsOf: new Date() };
        } else {
          const employee = matches[0];
          const id = String(employee._id);
          const [onboarding, changes] = await Promise.all([
            db.collection('employee_hr_platform').findOne({ employeeId: id }),
            db.collection('employee_hr_employment_change').find({ employeeId: id }).sort({ effectiveDate: -1, createdAt: -1 }).toArray(),
          ]);
          const comp = compensationRecord(employeeName(employee));
          const payRate = clean(onboarding?.payRate || employee['Pay Rate']) || (comp?.rate != null ? String(comp.rate) : '');
          const payType = clean(onboarding?.payRateType || employee['Pay Rate Type']) || comp?.payType || clean(employee['Pay Category']);
          const lastPayrollChange = changes.find(record => record.requestedTracking?.payroll === true || (record.changes || []).some(change => /pay|salary|rate/i.test(clean(change.field))));
          const details = [
            `Job Title: ${clean(employee['Job Title']) || 'Not recorded'}`,
            `Location: ${clean(employee.Location) || 'Not recorded'}`,
            `Home Department: ${clean(employee['Home Department'] || employee.Department) || 'Not recorded'}`,
            `Company Status: ${clean(employee['Position Status']) || 'Not recorded'}`,
            `Pay Type: ${payType || 'Not recorded'}`,
            `Current Pay Rate: ${payRate ? money(payRate) : 'Not available in the current structured records'}`,
          ];
          if (lastPayrollChange) {
            details.push(`Last Payroll Change Date: ${clean(lastPayrollChange.effectiveDate || lastPayrollChange.tasks?.payroll?.actionDate) || 'Not recorded'}`);
            details.push(`Change Reason: ${clean(lastPayrollChange.reason) || 'Not recorded'}`);
            details.push('Previous Rate / Increase Amount: Not recorded in this change record');
          } else {
            details.push('Last Pay Increase: No structured payroll-change history was found');
          }
          const sources = ['Company App employee roster'];
          if (onboarding?.payRate) sources.push('HR Platform onboarding record');
          else if (employee['Pay Rate']) sources.push('Company App restricted compensation record');
          if (comp) sources.push(comp.source);
          if (lastPayrollChange) sources.push('HR Platform employment change history');
          response = { answer: `${employeeName(employee)} — executive employee summary`, details, sources, dataAsOf: new Date(), employeeId: id };
        }
      }

      await db.collection('executive_assistant_audit').insertOne({
        askedBy: clean(req.adminSession?.email).toLowerCase(), question, responseType: response.employeeId ? 'employee' : 'summary', employeeId: response.employeeId || '', sources: response.sources, askedAt: new Date(), readOnly: true,
        assistantMode: response.assistantMode || 'guided-fallback', model: response.model || '', toolsUsed: response.toolsUsed || [], smartAiError,
      });
      response.assistantMode = response.assistantMode || 'guided-fallback';
      return res.json(response);
    } catch (error) {
      console.error('Unable to answer Executive Intelligence question:', error);
      return res.status(500).json({ error: 'The Executive Data Assistant could not answer this question.' });
    } finally { await client.close(); }
  });

  return router;
}

module.exports = { compensationRecord, createExecutiveRouter, employmentChangeIncomplete, findEmployeeMatches, findLocationMatch, locationEmployeeDetails };
