const clean = value => value == null ? '' : String(value).trim();
const normalize = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const employeeName = employee => [clean(employee['First Name']), clean(employee['Last Name'])].filter(Boolean).join(' ');
const isTerminated = employee => /^(terminated|inactive)$/i.test(clean(employee['Position Status'])) || Boolean(clean(employee['Termination Date']));
const { findEmployeeMatches } = require('./employeeMatcher');
const dateOnly = value => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = clean(value);
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
};
const isExcludedTestEmployee = employee => normalize(employeeName(employee)) === 'yang yang';
const isPreEmploymentCancellation = employee => {
  const hireDate = dateOnly(employee['Hire Date']);
  const terminationDate = dateOnly(employee['Termination Date']);
  return Boolean(hireDate && terminationDate && terminationDate < hireDate);
};

const nullableString = { type: ['string', 'null'] };

const EXECUTIVE_TOOLS = [
  {
    type: 'function',
    name: 'search_employees',
    description: 'Search the current Company App employee roster using one or more workforce filters. Use this for lists such as employees at a location or in a department.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        name: nullableString, location: nullableString, department: nullableString,
        jobTitle: nullableString, manager: nullableString, status: nullableString,
        payType: nullableString, limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      required: ['name', 'location', 'department', 'jobTitle', 'manager', 'status', 'payType', 'limit'],
    },
  },
  {
    type: 'function',
    name: 'get_employee_profile',
    description: 'Get a read-only executive profile for one employee, including current structured pay information and the latest structured payroll change.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { employeeName: { type: 'string', minLength: 2 } },
      required: ['employeeName'],
    },
  },
  {
    type: 'function',
    name: 'get_workforce_summary',
    description: 'Count current active or leave-status employees and break the count out by a selected business dimension.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { groupBy: { type: 'string', enum: ['location', 'department', 'status', 'payType'] } },
      required: ['groupBy'],
    },
  },
  {
    type: 'function',
    name: 'get_monthly_workforce_activity',
    description: 'Get verified historical workforce activity for a specific calendar month using Hire Date, Termination Date, and Employment Change Effective Date. Use this for monthly new-hire, termination, or employment-change questions.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
        category: { type: 'string', enum: ['new_hires', 'terminations', 'employment_changes', 'all'] },
      },
      required: ['month', 'category'],
    },
  },
  {
    type: 'function',
    name: 'get_open_case_summary',
    description: 'Get counts for open HR or Safety workflows. This returns counts only and never exposes medical details.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { category: { type: 'string', enum: ['leave', 'injury', 'employment_change', 'all'] } },
      required: ['category'],
    },
  },
  {
    type: 'function',
    name: 'get_employee_hr_process_status',
    description: 'Get the current read-only New Hire, Employment Change, Termination, COBRA, and Leave workflow status for one employee. This excludes medical details and private comments.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { employeeName: { type: 'string', minLength: 2 } },
      required: ['employeeName'],
    },
  },
  {
    type: 'function',
    name: 'get_monthly_hr_safety_summary',
    description: 'Get the verified HR and Safety summary for a calendar month, including new hires, terminations, employment changes, leave cases overlapping the month, and injury cases overlapping the month.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' } },
      required: ['month'],
    },
  },
  {
    type: 'function',
    name: 'get_termination_cobra_leave_status',
    description: 'Get read-only Termination, COBRA, or Leave status. Employee name may be omitted to list current/open records. Medical details and private comments are excluded.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        employeeName: nullableString,
        category: { type: 'string', enum: ['termination', 'cobra', 'leave', 'all'] },
      },
      required: ['employeeName', 'category'],
    },
  },
  {
    type: 'function',
    name: 'get_employee_employment_change_history',
    description: 'Get the read-only Employment Change history for one employee, including effective dates, recorded changes, reason, and workflow task status.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { employeeName: { type: 'string', minLength: 2 } },
      required: ['employeeName'],
    },
  },
  {
    type: 'function',
    name: 'request_clarification',
    description: 'Use when the question cannot be answered safely without one missing detail.',
    strict: true,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: { missingDetail: { type: 'string', minLength: 2 } },
      required: ['missingDetail'],
    },
  },
];

function match(value, requested) {
  return !requested || normalize(value).includes(normalize(requested));
}

function exactMatch(value, requested) {
  return !requested || normalize(value) === normalize(requested);
}

function safeEmployee(employee) {
  return {
    name: employeeName(employee),
    jobTitle: clean(employee['Job Title']) || 'Not recorded',
    location: clean(employee.Location) || 'Not recorded',
    department: clean(employee['Home Department'] || employee.Department) || 'Not recorded',
    manager: clean(employee['Reports To'] || employee.Supervisor || employee.Manager) || 'Not recorded',
    status: clean(employee['Position Status']) || 'Not recorded',
    payType: clean(employee['Pay Category']) || 'Not recorded',
    hireDate: clean(employee['Hire Date']) || 'Not recorded',
  };
}

function trackerStatus(tracker = {}) {
  if (tracker.finalLockedAt || tracker.confirmedAt) return 'Final Reviewed / Locked';
  if (tracker.submittedAt) return 'Awaiting Final Review';
  return 'In Progress';
}

function taskStatus(task = {}) {
  if (task.applicable === false || task.required === false) return 'Not Applicable';
  if (task.finalReviewedAt || task.completedAt) return 'Completed';
  if (task.checkedAt) return 'Awaiting Final Review';
  return task.applicable === true || task.required === true ? 'Incomplete' : 'Not Assigned';
}

function employeeMatchResult(employees, requested) {
  const matches = findEmployeeMatches(employees, requested);
  if (matches.length === 1) return { employee: matches[0] };
  return { error: { matchCount: matches.length, candidates: matches.slice(0, 8).map(safeEmployee), message: matches.length ? 'More than one employee matched. Ask the user to choose a candidate.' : 'No employee matched that name.' } };
}

function extractOutputText(response = {}) {
  if (clean(response.output_text)) return clean(response.output_text);
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' && clean(item.text))
    .map(item => clean(item.text)).join('\n').trim();
}

async function callResponsesApi(payload, apiKey, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenAI Responses API returned ${response.status}`);
    return response.json();
  } finally { clearTimeout(timeout); }
}

function createToolResolver({ db, employees, compensationRecord, employmentChangeIncomplete }) {
  const activeEmployees = employees.filter(employee => !isTerminated(employee));
  return async (name, args = {}) => {
    if (name === 'search_employees') {
      const nameMatches = args.name ? new Set(findEmployeeMatches(activeEmployees, args.name)) : null;
      const matches = activeEmployees.filter(employee => (!nameMatches || nameMatches.has(employee))
        && exactMatch(employee.Location, args.location)
        && exactMatch(employee['Home Department'] || employee.Department, args.department)
        && match(employee['Job Title'], args.jobTitle)
        && match(employee['Reports To'] || employee.Supervisor || employee.Manager, args.manager)
        && exactMatch(employee['Position Status'], args.status)
        && exactMatch(employee['Pay Category'], args.payType));
      return { count: matches.length, employees: matches.slice(0, args.limit || 50).map(safeEmployee), truncated: matches.length > (args.limit || 50) };
    }
    if (name === 'get_workforce_summary') {
      const field = { location: 'Location', department: 'Home Department', status: 'Position Status', payType: 'Pay Category' }[args.groupBy];
      const groups = activeEmployees.reduce((result, employee) => {
        const value = clean(employee[field] || (args.groupBy === 'department' ? employee.Department : '')) || 'Not Recorded';
        result[value] = (result[value] || 0) + 1; return result;
      }, {});
      return { total: activeEmployees.length, groupBy: args.groupBy, groups: Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count })) };
    }
    if (name === 'get_monthly_workforce_activity') {
      const month = clean(args.month);
      const validEmployees = employees.filter(employee => !isExcludedTestEmployee(employee) && !isPreEmploymentCancellation(employee));
      const result = { month };
      if (['new_hires', 'all'].includes(args.category)) {
        const newHires = validEmployees.filter(employee => dateOnly(employee['Hire Date']).slice(0, 7) === month);
        result.newHires = { count: newHires.length, employees: newHires.map(employee => ({ ...safeEmployee(employee), hireDate: dateOnly(employee['Hire Date']) })).sort((a, b) => a.hireDate.localeCompare(b.hireDate) || a.name.localeCompare(b.name)) };
      }
      if (['terminations', 'all'].includes(args.category)) {
        const terminations = validEmployees.filter(employee => dateOnly(employee['Termination Date']).slice(0, 7) === month);
        result.terminations = { count: terminations.length, employees: terminations.map(employee => ({ ...safeEmployee(employee), terminationDate: dateOnly(employee['Termination Date']), terminationType: clean(employee['Termination Type']) || 'Not recorded' })).sort((a, b) => a.terminationDate.localeCompare(b.terminationDate) || a.name.localeCompare(b.name)) };
      }
      if (['employment_changes', 'all'].includes(args.category)) {
        const changes = await db.collection('employee_hr_employment_change').find({}).toArray();
        const employeeById = new Map(employees.map(employee => [String(employee._id), employee]));
        const monthlyChanges = changes.filter(record => dateOnly(record.effectiveDate).slice(0, 7) === month).map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || {};
          return { employeeName: clean(record.employeeName) || employeeName(employee) || 'Name not recorded', effectiveDate: dateOnly(record.effectiveDate), reason: clean(record.reason) || 'Not recorded' };
        });
        result.employmentChanges = { count: monthlyChanges.length, records: monthlyChanges.sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.employeeName.localeCompare(b.employeeName)) };
      }
      return result;
    }
    if (name === 'get_open_case_summary') {
      const result = {};
      if (['leave', 'all'].includes(args.category)) result.openLeaveCases = await db.collection('employee_hr_leave').countDocuments({ active: true });
      if (['injury', 'all'].includes(args.category)) {
        const injuries = await db.collection('work_injury_cases').find({ closedAt: { $in: [null, ''] } }, { projection: { oshaRecordable: 1 } }).toArray();
        result.openInjuryCases = injuries.length;
        result.oshaRecordable = injuries.filter(record => /^yes$/i.test(clean(record.oshaRecordable))).length;
      }
      if (['employment_change', 'all'].includes(args.category)) {
        const changes = await db.collection('employee_hr_employment_change').find({}).toArray();
        result.unfinishedEmploymentChanges = changes.filter(employmentChangeIncomplete).length;
      }
      return result;
    }
    if (name === 'get_employee_hr_process_status') {
      const matched = employeeMatchResult(employees, args.employeeName);
      if (matched.error) return matched.error;
      const employee = matched.employee;
      const employeeId = String(employee._id);
      const [newHires, termination, changes, leaves] = await Promise.all([
        db.collection('employee_hr_platform').find({ employeeId }).sort({ onboardingCycleStartedAt: -1, createdAt: -1 }).toArray(),
        db.collection('employee_hr_termination').findOne({ employeeId }),
        db.collection('employee_hr_employment_change').find({ employeeId }).sort({ effectiveDate: -1, createdAt: -1 }).toArray(),
        db.collection('employee_hr_leave').find({ employeeId }).sort({ leaveStartedAt: -1, createdAt: -1 }).toArray(),
      ]);
      const latestHire = newHires[0] || null;
      const latestChange = changes[0] || null;
      const latestLeave = leaves[0] || null;
      return {
        employee: safeEmployee(employee), companyStatus: clean(employee['Position Status']) || 'Not recorded',
        newHire: latestHire ? { hireDate: dateOnly(employee['Hire Date']), status: trackerStatus(latestHire.fileTracker) } : null,
        employmentChange: latestChange ? { recordCount: changes.length, effectiveDate: dateOnly(latestChange.effectiveDate), reason: clean(latestChange.reason) || 'Not recorded', status: employmentChangeIncomplete(latestChange) ? 'In Progress' : 'Completed' } : null,
        termination: termination || clean(employee['Termination Date']) ? { terminationDate: dateOnly(employee['Termination Date'] || termination?.terminationDate), terminationType: clean(employee['Termination Type'] || termination?.terminationType) || 'Not recorded', status: trackerStatus(termination?.fileTracker) } : null,
        cobra: termination?.cobraStartDate ? { startDate: dateOnly(termination.cobraStartDate), endDate: dateOnly(termination.cobraEndDate), status: termination.cobraClosedAt ? 'Closed' : termination.cobraEndDate ? 'Ready to Close' : 'Active' } : null,
        leave: latestLeave ? { startDate: dateOnly(latestLeave.leaveStartedAt || latestLeave.createdAt), anticipatedReturnDate: dateOnly(latestLeave.anticipatedReturnDate), returnToWorkDate: dateOnly(latestLeave.actualReturnDate || latestLeave.returnedAt), status: latestLeave.active === false || latestLeave.actualReturnDate || latestLeave.returnedAt ? 'Closed' : 'Open', insuranceStatus: clean(latestLeave.insuranceStatus) || 'Not recorded' } : null,
      };
    }
    if (name === 'get_employee_employment_change_history') {
      const matched = employeeMatchResult(employees, args.employeeName);
      if (matched.error) return matched.error;
      const employee = matched.employee;
      const records = await db.collection('employee_hr_employment_change').find({ employeeId: String(employee._id) }).sort({ effectiveDate: -1, createdAt: -1 }).toArray();
      return {
        employee: safeEmployee(employee), count: records.length,
        history: records.map(record => ({
          effectiveDate: dateOnly(record.effectiveDate), reason: clean(record.reason) || 'Not recorded', status: employmentChangeIncomplete(record) ? 'In Progress' : 'Completed',
          changes: (record.changes || []).map(change => ({ field: clean(change.field), from: clean(change.from) || 'Not recorded', to: clean(change.to) || 'Not recorded' })),
          requestedTracking: record.requestedTracking || {},
          tasks: Object.fromEntries(Object.entries(record.tasks || {}).map(([key, value]) => [key, taskStatus(value)])),
        })),
      };
    }
    if (name === 'get_termination_cobra_leave_status') {
      let selectedEmployee = null;
      if (clean(args.employeeName)) {
        const matched = employeeMatchResult(employees, args.employeeName);
        if (matched.error) return matched.error;
        selectedEmployee = matched.employee;
      }
      const employeeById = new Map(employees.map(employee => [String(employee._id), employee]));
      const filter = selectedEmployee ? { employeeId: String(selectedEmployee._id) } : {};
      const result = { category: args.category, employee: selectedEmployee ? safeEmployee(selectedEmployee) : null };
      if (['termination', 'all'].includes(args.category)) {
        const records = await db.collection('employee_hr_termination').find(filter).toArray();
        result.terminations = records.map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || {};
          return { employeeName: employeeName(employee) || clean(record.employeeName) || 'Name not recorded', terminationDate: dateOnly(employee['Termination Date'] || record.terminationDate), terminationType: clean(employee['Termination Type'] || record.terminationType) || 'Not recorded', workflowStatus: trackerStatus(record.fileTracker) };
        });
      }
      if (['cobra', 'all'].includes(args.category)) {
        const records = await db.collection('employee_hr_termination').find(filter).toArray();
        const manualRecords = selectedEmployee ? [] : await db.collection('hr_manual_cobra').find({}).toArray();
        result.cobra = records.filter(record => record.cobraStartDate).map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || {};
          return { employeeName: employeeName(employee) || clean(record.employeeName) || 'Name not recorded', startDate: dateOnly(record.cobraStartDate), endDate: dateOnly(record.cobraEndDate), status: record.cobraClosedAt ? 'Closed' : record.cobraEndDate ? 'Ready to Close' : 'Active' };
        }).concat(manualRecords.map(record => ({ employeeName: clean(record.name) || 'Name not recorded', startDate: dateOnly(record.cobraStartDate), endDate: dateOnly(record.cobraEndDate), status: record.cobraClosedAt ? 'Closed' : record.cobraEndDate ? 'Ready to Close' : 'Active', source: 'Manual COBRA record' })));
      }
      if (['leave', 'all'].includes(args.category)) {
        let records = await db.collection('employee_hr_leave').find(filter).toArray();
        if (!selectedEmployee) records = records.filter(record => record.active !== false && !record.actualReturnDate && !record.returnedAt);
        result.leave = records.map(record => {
          const employee = employeeById.get(clean(record.employeeId)) || {};
          return { employeeName: employeeName(employee) || clean(record.employeeName) || 'Name not recorded', startDate: dateOnly(record.leaveStartedAt || record.createdAt), anticipatedReturnDate: dateOnly(record.anticipatedReturnDate), returnToWorkDate: dateOnly(record.actualReturnDate || record.returnedAt), status: record.active === false || record.actualReturnDate || record.returnedAt ? 'Closed' : 'Open', insuranceStatus: clean(record.insuranceStatus) || 'Not recorded' };
        });
      }
      return result;
    }
    if (name === 'get_monthly_hr_safety_summary') {
      const month = clean(args.month);
      const monthStart = `${month}-01`;
      const [year, monthNumber] = month.split('-').map(Number);
      const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
      const validEmployees = employees.filter(employee => !isExcludedTestEmployee(employee) && !isPreEmploymentCancellation(employee));
      const employeeById = new Map(validEmployees.map(employee => [String(employee._id), employee]));
      const [changes, leaves, injuries] = await Promise.all([
        db.collection('employee_hr_employment_change').find({}).toArray(),
        db.collection('employee_hr_leave').find({}).toArray(),
        db.collection('work_injury_cases').find({}).toArray(),
      ]);
      const overlaps = (start, end) => Boolean(start && start <= monthEnd && (!end || end >= monthStart));
      const newHires = validEmployees.filter(employee => dateOnly(employee['Hire Date']).slice(0, 7) === month);
      const terminations = validEmployees.filter(employee => dateOnly(employee['Termination Date']).slice(0, 7) === month);
      const monthlyChanges = changes.filter(record => dateOnly(record.effectiveDate).slice(0, 7) === month);
      const monthlyLeaves = leaves.filter(record => overlaps(dateOnly(record.leaveStartedAt || record.createdAt), dateOnly(record.actualReturnDate || record.returnedAt || record.closedAt)));
      const monthlyInjuries = injuries.filter(record => overlaps(dateOnly(record.injuryDate || record.createdAt), dateOnly(record.closedAt)));
      const headcountEmployees = validEmployees.filter(employee => !isTerminated(employee));
      const headcountByLocation = headcountEmployees.reduce((groups, employee) => { const location = clean(employee.Location) || 'Not Recorded'; groups[location] = (groups[location] || 0) + 1; return groups; }, {});
      const named = employee => employeeName(employee) || 'Name not recorded';
      return {
        month, currentHeadcount: headcountEmployees.length, headcountByLocation,
        newHires: { count: newHires.length, records: newHires.map(employee => ({ employeeName: named(employee), hireDate: dateOnly(employee['Hire Date']), location: clean(employee.Location) || 'Not recorded', department: clean(employee['Home Department'] || employee.Department) || 'Not recorded' })) },
        terminations: { count: terminations.length, records: terminations.map(employee => ({ employeeName: named(employee), terminationDate: dateOnly(employee['Termination Date']), terminationType: clean(employee['Termination Type']) || 'Not recorded', location: clean(employee.Location) || 'Not recorded' })) },
        employmentChanges: { count: monthlyChanges.length, records: monthlyChanges.map(record => ({ employeeName: clean(record.employeeName) || named(employeeById.get(clean(record.employeeId)) || {}), effectiveDate: dateOnly(record.effectiveDate), reason: clean(record.reason) || 'Not recorded' })) },
        leaveCases: { count: monthlyLeaves.length, records: monthlyLeaves.map(record => ({ employeeName: named(employeeById.get(clean(record.employeeId)) || {}) || clean(record.employeeName), startDate: dateOnly(record.leaveStartedAt || record.createdAt), returnToWorkDate: dateOnly(record.actualReturnDate || record.returnedAt), status: record.active === false || record.actualReturnDate || record.returnedAt ? 'Closed' : 'Open' })) },
        injuryCases: { count: monthlyInjuries.length, records: monthlyInjuries.map(record => ({ employeeName: clean(record.employeeName) || named(employeeById.get(clean(record.employeeId)) || {}), injuryDate: dateOnly(record.injuryDate || record.createdAt), status: record.closedAt ? 'Closed' : 'Open', oshaRecordable: clean(record.oshaRecordable) || 'Not recorded' })) },
      };
    }
    if (name === 'get_employee_profile') {
      const matches = findEmployeeMatches(employees, args.employeeName);
      if (matches.length !== 1) return { matchCount: matches.length, candidates: matches.slice(0, 8).map(safeEmployee), message: matches.length ? 'More than one employee matched. Ask the user to choose a candidate.' : 'No employee matched that name.' };
      const employee = matches[0];
      const employeeId = String(employee._id);
      const [onboarding, changes] = await Promise.all([
        db.collection('employee_hr_platform').findOne({ employeeId }),
        db.collection('employee_hr_employment_change').find({ employeeId }).sort({ effectiveDate: -1, createdAt: -1 }).toArray(),
      ]);
      const comp = compensationRecord(employeeName(employee));
      const payrollChange = changes.find(record => record.requestedTracking?.payroll === true || (record.changes || []).some(change => /pay|salary|rate/i.test(clean(change.field))));
      return {
        matchCount: 1, employee: safeEmployee(employee),
        currentPay: {
          payType: clean(onboarding?.payRateType || employee['Pay Rate Type']) || comp?.payType || clean(employee['Pay Category']) || 'Not recorded',
          rate: clean(onboarding?.payRate || employee['Pay Rate']) || (comp?.rate != null ? comp.rate : null),
          source: onboarding?.payRate ? 'HR Platform onboarding record' : employee['Pay Rate'] ? 'Company App restricted compensation record' : comp?.source || 'No structured current-pay source',
        },
        latestPayrollChange: payrollChange ? {
          effectiveDate: clean(payrollChange.effectiveDate || payrollChange.tasks?.payroll?.actionDate) || 'Not recorded',
          reason: clean(payrollChange.reason) || 'Not recorded',
          previousRateOrIncrease: 'Not recorded in this structured change record',
        } : null,
      };
    }
    if (name === 'request_clarification') return { clarificationNeeded: args.missingDetail };
    throw new Error(`Unsupported executive tool: ${name}`);
  };
}

async function answerWithSmartAi({ question, db, employees, compensationRecord, employmentChangeIncomplete }) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) return null;
  const model = clean(process.env.OPENAI_EXECUTIVE_MODEL || process.env.OPENAI_MODEL) || 'gpt-6.1-sol';
  const instructions = 'You are Royal Executive Intelligence, a concise read-only business data assistant. Always use exactly one provided tool before answering. Never guess, calculate missing pay history, expose personal contact information, or provide medical details. Treat tool results as the only source of truth.';
  const first = await callResponsesApi({ model, instructions, input: question, tools: EXECUTIVE_TOOLS, tool_choice: 'required', parallel_tool_calls: false, store: false }, apiKey);
  const calls = (first.output || []).filter(item => item.type === 'function_call');
  if (!calls.length) throw new Error('Smart AI did not select a read-only data tool.');
  const resolveTool = createToolResolver({ db, employees, compensationRecord, employmentChangeIncomplete });
  const toolResults = [];
  for (const call of calls.slice(0, 2)) {
    let args = {};
    try { args = JSON.parse(call.arguments || '{}'); } catch { throw new Error('Smart AI returned invalid tool arguments.'); }
    toolResults.push({ tool: call.name, result: await resolveTool(call.name, args) });
  }
  const final = await callResponsesApi({
    model, store: false,
    instructions: 'Answer the executive question only from the verified Royal tool results supplied below. Be concise and direct. If clarification is needed, ask one precise question. Do not infer missing facts. Do not mention internal tool names. Return plain text, using short bullets only when useful.',
    input: `Executive question:\n${question}\n\nVerified Royal data:\n${JSON.stringify(toolResults)}`,
  }, apiKey);
  const answer = extractOutputText(final);
  if (!answer) throw new Error('Smart AI returned an empty answer.');
  return { answer, details: [], sources: ['Royal Company App and authorized HR/Safety records'], dataAsOf: new Date(), assistantMode: 'smart-ai', model, toolsUsed: toolResults.map(item => item.tool) };
}

module.exports = { EXECUTIVE_TOOLS, answerWithSmartAi, createToolResolver, extractOutputText };
