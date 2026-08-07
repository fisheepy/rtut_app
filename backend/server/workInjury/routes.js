const express = require('express');
const ExcelJS = require('exceljs');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { closureBlocker, closureWarnings, sanitizeCaseInput, totalCaseCost, withCurrentWorkStatus } = require('./data');

const FINAL_APPROVER_EMAIL = 'myu@royaltrailersales.com';

function createWorkInjuryRouter({ uri, databaseName, requireTrainingSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
  router.use(requireTrainingSession);

  async function sendWorkbook(res, workbook, fileName) {
    workbook.eachSheet(sheet => { sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC2410C' } }; });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(buffer));
  }

  router.get('/cases', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const cases = await client.db(databaseName).collection('work_injury_cases').find({}).sort({ injuryDateTime: -1 }).toArray();
      return res.json({ cases: cases.map(record => ({ ...withCurrentWorkStatus(record), closeRequestedAt: record.closedAt ? null : record.closeRequestedAt, id: String(record._id), _id: undefined })) });
    } catch (error) {
      console.error('Unable to load work injury cases:', error);
      return res.status(500).json({ error: 'Work injury cases could not be loaded.' });
    } finally { await client.close(); }
  });

  router.get('/cases/:caseId', async (req, res) => {
    const client = createClient();
    try {
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const record = await client.db(databaseName).collection('work_injury_cases').findOne({ _id: new ObjectId(req.params.caseId) });
      if (!record) return res.status(404).json({ error: 'Work injury case not found.' });
      return res.json({ case: { ...record, id: String(record._id), _id: undefined } });
    } catch (error) {
      console.error('Unable to load work injury case:', error);
      return res.status(500).json({ error: 'The work injury case could not be loaded.' });
    } finally { await client.close(); }
  });

  async function findEmployee(db, employeeId) {
    return ObjectId.isValid(employeeId) ? db.collection('employees').findOne({ _id: new ObjectId(employeeId) }) : null;
  }

  router.post('/cases', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employee = await findEmployee(db, req.body?.employeeId);
      const result = sanitizeCaseInput(req.body, employee, { requireEmployeeInjuryFolder: true });
      if (result.error) return res.status(400).json({ error: result.error });
      const now = new Date();
      const record = { ...result.value, closedAt: null, closedBy: null, createdAt: now, createdBy: req.adminSession?.email || null, updatedAt: now, updatedBy: req.adminSession?.email || null };
      const inserted = await db.collection('work_injury_cases').insertOne(record);
      return res.status(201).json({ case: { ...record, id: String(inserted.insertedId) } });
    } catch (error) {
      console.error('Unable to create work injury case:', error);
      return res.status(500).json({ error: 'The work injury case could not be created.' });
    } finally { await client.close(); }
  });

  router.put('/cases/:caseId', async (req, res) => {
    const client = createClient();
    try {
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const db = client.db(databaseName);
      const existing = await db.collection('work_injury_cases').findOne({ _id: new ObjectId(req.params.caseId), closedAt: null });
      if (!existing) return res.status(404).json({ error: 'Open work injury case not found.' });
      const employee = await findEmployee(db, existing.employeeId);
      const result = sanitizeCaseInput({ ...req.body, employeeId: existing.employeeId }, employee);
      if (result.error) return res.status(400).json({ error: result.error });
      const update = { ...result.value, workStatus: existing.workStatus, otherWorkStatus: existing.otherWorkStatus || '', updatedAt: new Date(), updatedBy: req.adminSession?.email || null };
      await db.collection('work_injury_cases').updateOne({ _id: existing._id }, { $set: update });
      return res.json({ case: { ...existing, ...update, id: String(existing._id) } });
    } catch (error) {
      console.error('Unable to update work injury case:', error);
      return res.status(500).json({ error: 'The work injury case could not be updated.' });
    } finally { await client.close(); }
  });

  router.post('/cases/:caseId/close-request', async (req, res) => {
    const client = createClient();
    try {
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null });
      if (!record) return res.status(404).json({ error: 'Open work injury case not found.' });
      const blocker = closureBlocker(record);
      if (blocker) return res.status(400).json({ error: blocker });
      const warnings = closureWarnings(record);
      if (warnings.length && req.body?.confirmWarnings !== true) return res.status(409).json({ requiresConfirmation: true, warnings });
      const now = new Date();
      await collection.updateOne({ _id: record._id }, { $set: { closeRequestedAt: now, closeRequestedBy: req.adminSession?.email || null, closeWarnings: warnings, updatedAt: now, updatedBy: req.adminSession?.email || null } });
      return res.json({ ok: true, pendingFinalApproval: true, warnings });
    } catch (error) {
      console.error('Unable to request work injury case closure:', error);
      return res.status(500).json({ error: 'The work injury case closure request could not be saved.' });
    } finally { await client.close(); }
  });

  router.post('/cases/:caseId/close-final-approval', async (req, res) => {
    const client = createClient();
    try {
      if ((req.adminSession?.email || '').toLowerCase() !== FINAL_APPROVER_EMAIL) return res.status(403).json({ error: 'Only the authorized final approver can close this case.' });
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null, closeRequestedAt: { $ne: null } });
      if (!record) return res.status(404).json({ error: 'Pending case closure request not found.' });
      const warnings = closureWarnings(record);
      if (warnings.length && req.body?.confirmWarnings !== true) return res.status(409).json({ requiresConfirmation: true, warnings });
      const now = new Date();
      await collection.updateOne({ _id: record._id }, { $set: { closedAt: now, closedBy: req.adminSession.email, closeFinalApprovedAt: now, closeFinalApprovedBy: req.adminSession.email, closeRequestedAt: null, closeRequestedBy: null, closeWarnings: warnings, updatedAt: now, updatedBy: req.adminSession.email } });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Unable to approve work injury case closure:', error);
      return res.status(500).json({ error: 'The work injury case could not be closed.' });
    } finally { await client.close(); }
  });

  router.post('/cases/:caseId/close-decline', async (req, res) => {
    const client = createClient();
    try {
      if ((req.adminSession?.email || '').toLowerCase() !== FINAL_APPROVER_EMAIL) return res.status(403).json({ error: 'Only the authorized final approver can decline this closure request.' });
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null, closeRequestedAt: { $ne: null } });
      if (!record) return res.status(404).json({ error: 'Pending case closure request not found.' });
      const now = new Date();
      const declinedBy = req.adminSession.email;
      await collection.updateOne({ _id: record._id }, {
        $set: { closeRequestedAt: null, closeRequestedBy: null, closeWarnings: [], closeDeclinedAt: now, closeDeclinedBy: declinedBy, updatedAt: now, updatedBy: declinedBy },
        $push: { closeDecisionHistory: { decision: 'Declined', decidedAt: now, decidedBy: declinedBy, requestedAt: record.closeRequestedAt, requestedBy: record.closeRequestedBy || null } }
      });
      return res.json({ ok: true, reopenedForEditing: true });
    } catch (error) {
      console.error('Unable to decline work injury case closure:', error);
      return res.status(500).json({ error: 'The closure request could not be declined.' });
    } finally { await client.close(); }
  });

  router.get('/reports/case-details.xlsx', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const records = await client.db(databaseName).collection('work_injury_cases').find({}).sort({ injuryDateTime: -1 }).toArray();
      const workbook = new ExcelJS.Workbook(); const cases = workbook.addWorksheet('Case Details'); const timeline = workbook.addWorksheet('Step by Step Log'); const costs = workbook.addWorksheet('Case Costs'); const contacts = workbook.addWorksheet('WC Contacts');
      cases.columns = [{ header: 'Case ID', key: 'id', width: 26 }, { header: 'Employee', key: 'employee', width: 28 }, { header: 'Hire Date', key: 'hire', width: 14 }, { header: 'Department', key: 'department', width: 22 }, { header: 'Location', key: 'location', width: 20 }, { header: 'Supervisor', key: 'supervisor', width: 24 }, { header: 'Job Title', key: 'title', width: 24 }, { header: 'Phone', key: 'phone', width: 18 }, { header: 'Email', key: 'email', width: 30 }, { header: 'Injury Date / Time', key: 'injuryDate', width: 22 }, { header: 'First Notice Date', key: 'notice', width: 18 }, { header: 'Injury Description', key: 'description', width: 45 }, { header: 'Injury Location', key: 'injuryLocation', width: 24 }, { header: 'Body Part', key: 'bodyPart', width: 20 }, { header: 'Initial Work Status', key: 'initialStatus', width: 32 }, { header: 'Current Work Status', key: 'currentStatus', width: 32 }, { header: 'OSHA Recordable', key: 'osha', width: 18 }, { header: 'Safety Violation', key: 'violation', width: 18 }, { header: 'Violation Details', key: 'violationDetails', width: 40 }, { header: 'Investigation Status', key: 'investigationStatus', width: 22 }, { header: 'Investigation Date', key: 'investigationDate', width: 20 }, { header: 'Root Cause', key: 'rootCause', width: 40 }, { header: 'Corrective Action Required', key: 'correctiveRequired', width: 26 }, { header: 'Corrective Action Details', key: 'correctiveDetails', width: 40 }, { header: 'Corrective Action Target Date', key: 'correctiveDate', width: 28 }, { header: 'Injury Folder Link', key: 'folder', width: 45 }, { header: 'Injury Report Link', key: 'report', width: 45 }, { header: 'Workers Compensation Claimed', key: 'wcClaimed', width: 30 }, { header: 'Workers Compensation Case Number', key: 'wcNumber', width: 34 }, { header: 'Total Cost', key: 'total', width: 16 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Closed At', key: 'closedAt', width: 22 }, { header: 'Closed By', key: 'closedBy', width: 30 }];
      timeline.columns = [{ header: 'Case ID', key: 'id', width: 26 }, { header: 'Employee', key: 'employee', width: 28 }, { header: 'Date', key: 'date', width: 16 }, { header: 'Description', key: 'description', width: 55 }, { header: 'Work Status After Event', key: 'status', width: 34 }, { header: 'Documentation Link', key: 'link', width: 50 }];
      costs.columns = [{ header: 'Case ID', key: 'id', width: 26 }, { header: 'Employee', key: 'employee', width: 28 }, { header: 'Invoice Date', key: 'date', width: 16 }, { header: 'Description', key: 'description', width: 45 }, { header: 'Paid By', key: 'paidBy', width: 24 }, { header: 'Royal Cost Type', key: 'royalCostType', width: 22 }, { header: 'Amount', key: 'amount', width: 16 }, { header: 'Invoice Link', key: 'link', width: 50 }];
      contacts.columns = [{ header: 'Case ID', key: 'id', width: 26 }, { header: 'Employee', key: 'employee', width: 28 }, { header: 'WC Case Number', key: 'caseNumber', width: 24 }, { header: 'WC Contact Name', key: 'name', width: 28 }, { header: 'WC Contact Phone', key: 'phone', width: 22 }, { header: 'WC Contact Email', key: 'email', width: 32 }];
      records.forEach(record => { const current = withCurrentWorkStatus(record); const id = String(record._id); cases.addRow({ id, employee: record.employeeName, hire: record.hireDate, department: record.department, location: record.location, supervisor: record.supervisor, title: record.jobTitle, phone: record.employeePhone, email: record.employeeEmail, injuryDate: record.injuryDateTime, notice: record.firstNoticeDate, description: record.injuryDescription, injuryLocation: record.injuryLocation, bodyPart: record.injuredBodyPart, initialStatus: record.workStatus === 'Other' ? record.otherWorkStatus : record.workStatus, currentStatus: current.workStatus === 'Other' ? current.otherWorkStatus : current.workStatus, osha: record.oshaRecordable, violation: record.safetyViolation, violationDetails: record.safetyViolationDetails, investigationStatus: record.investigationStatus, investigationDate: record.investigationDate, rootCause: record.rootCause, correctiveRequired: record.correctiveActionRequired, correctiveDetails: record.correctiveActionDetails, correctiveDate: record.correctiveActionTargetDate, folder: record.employeeInjuryFolderLink, report: record.injuryReportLink, wcClaimed: record.workersCompClaimed, wcNumber: record.workersCompCaseNumber, total: totalCaseCost(record), status: record.closedAt ? 'Closed' : 'Open', closedAt: record.closedAt || '', closedBy: record.closedBy || '' }); (record.timeline || []).forEach(entry => timeline.addRow({ id, employee: record.employeeName, date: entry.date, description: entry.description, status: entry.workStatusAfter === 'Other' ? entry.otherWorkStatusAfter : entry.workStatusAfter, link: entry.documentationLink })); (record.costs || []).forEach(cost => costs.addRow({ id, employee: record.employeeName, date: cost.invoiceDate, description: cost.description, paidBy: cost.paidBy, royalCostType: cost.paidBy === 'Royal' ? cost.royalCostType || 'Uncategorized' : '', amount: Number(cost.amount) || 0, link: cost.invoiceLink })); });
      records.filter(record => record.workersCompClaimed === 'Yes').forEach(record => contacts.addRow({ id: String(record._id), employee: record.employeeName, caseNumber: record.workersCompCaseNumber, name: record.workersCompContactName || '', phone: record.workersCompContactPhone || '', email: record.workersCompContactEmail || '' }));
      cases.getColumn('total').numFmt = '$#,##0.00'; costs.getColumn('amount').numFmt = '$#,##0.00'; return await sendWorkbook(res, workbook, `Work_Injury_All_Case_Details_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) { console.error('Unable to create work injury details report:', error); return res.status(500).json({ error: 'The work injury details report could not be created.' }); } finally { await client.close(); }
  });

  router.get('/reports/case-costs.xlsx', async (req, res) => {
    const from = String(req.query.from || ''); const to = String(req.query.to || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to) return res.status(400).json({ error: 'Select a valid Injury Date From and To.' });
    const client = createClient();
    try { await client.connect(); const records = await client.db(databaseName).collection('work_injury_cases').find({ injuryDateTime: { $gte: from, $lte: `${to}T23:59:59.999` } }).sort({ injuryDateTime: 1 }).toArray(); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Case Cost Summary'); sheet.columns = [{ header: 'Case ID', key: 'id', width: 26 }, { header: 'Employee', key: 'employee', width: 28 }, { header: 'Injury Date / Time', key: 'date', width: 22 }, { header: 'Department', key: 'department', width: 22 }, { header: 'Location', key: 'location', width: 20 }, { header: 'Status', key: 'status', width: 14 }, { header: 'Paid by Workers Compensation', key: 'wc', width: 30 }, { header: 'Royal - Lost Time', key: 'lostTime', width: 22 }, { header: 'Royal - Medical Bill', key: 'medicalBill', width: 24 }, { header: 'Royal - Uncategorized', key: 'uncategorized', width: 26 }, { header: 'Paid by Royal', key: 'royal', width: 20 }, { header: 'Total Case Cost', key: 'total', width: 20 }]; records.forEach(record => { const entries = Array.isArray(record.costs) ? record.costs : []; const wc = entries.filter(cost => cost.paidBy === 'Workers Compensation').reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0); const lostTime = entries.filter(cost => cost.paidBy === 'Royal' && cost.royalCostType === 'Lost Time').reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0); const medicalBill = entries.filter(cost => cost.paidBy === 'Royal' && cost.royalCostType === 'Medical Bill').reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0); const uncategorized = entries.filter(cost => cost.paidBy === 'Royal' && !['Lost Time', 'Medical Bill'].includes(cost.royalCostType)).reduce((sum, cost) => sum + (Number(cost.amount) || 0), 0); const royal = lostTime + medicalBill + uncategorized; sheet.addRow({ id: String(record._id), employee: record.employeeName, date: record.injuryDateTime, department: record.department, location: record.location, status: record.closedAt ? 'Closed' : 'Open', wc, lostTime, medicalBill, uncategorized, royal, total: wc + royal }); }); ['wc', 'lostTime', 'medicalBill', 'uncategorized', 'royal', 'total'].forEach(key => { sheet.getColumn(key).numFmt = '$#,##0.00'; }); return await sendWorkbook(res, workbook, `Work_Injury_Case_Costs_${from}_to_${to}.xlsx`); } catch (error) { console.error('Unable to create work injury cost report:', error); return res.status(500).json({ error: 'The work injury cost report could not be created.' }); } finally { await client.close(); }
  });

  return router;
}

module.exports = { createWorkInjuryRouter };

