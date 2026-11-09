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
