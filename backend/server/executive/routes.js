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
      const [employees, leaves, injuries, changes] = await Promise.all([
        db.collection('employees').find({}).toArray(),
        db.collection('employee_hr_leave').find({ active: true }).toArray(),
        db.collection('work_injury_cases').find({ closedAt: { $in: [null, ''] } }).toArray(),
        db.collection('employee_hr_employment_change').find({}).toArray(),
      ]);
      const activeEmployees = employees.filter(employee => !isTerminated(employee));
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
        openLeaveCases: leaves.length,
        openInjuryCases: injuries.length,
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
