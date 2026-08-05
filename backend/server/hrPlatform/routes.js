const express = require('express');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { isAllowedFolderUrl } = require('../training/folderLink');
const { clean, commentAudit, DEFAULT_FILE_TRACKER_FIELDS, employeeView, terminationEmployeeView, fileTrackerComplete, payrollChangeRequestChanged, sanitizeFileTracker, sanitizeTrackerCatalogField, validDate } = require('./data');

function createHrPlatformRouter({ uri, databaseName, requireHrToolsSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  const finalReviewerEmail = 'myu@royaltrailersales.com';

  async function getTrackerCatalog(db, includeInactive = false) {
    const collection = db.collection('hr_file_tracker_fields');
    const stored = await collection.find({ deleted: { $ne: true } }).sort({ order: 1, label: 1 }).toArray();
    if (stored.length) return stored.map(({ _id, ...field }) => field).filter(field => includeInactive || field.active);
    if (await collection.countDocuments({}) > 0) return [];
    return DEFAULT_FILE_TRACKER_FIELDS.filter(field => includeInactive || field.active);
  }

  async function ensureTrackerCatalog(db) {
    const collection = db.collection('hr_file_tracker_fields');
    if (await collection.countDocuments({}) === 0) await collection.insertMany(DEFAULT_FILE_TRACKER_FIELDS);
    return collection;
  }

  router.use(requireHrToolsSession);

  router.get('/new-hires', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({
        $and: [
          { 'HR Platform New Hire At': { $exists: true, $ne: null } },
          { 'Account Active': { $not: /^inactive$/i } },
          { 'Position Status': { $not: /^(inactive|terminated)$/i } },
          { $or: [{ 'Termination Date': { $exists: false } }, { 'Termination Date': '' }, { 'Termination Date': null }] },
        ],
      }).toArray();
      const ids = employees.map(employee => String(employee._id));
      const records = ids.length
        ? await db.collection('employee_hr_platform').find({ employeeId: { $in: ids } }).toArray()
        : [];
      const catalog = await getTrackerCatalog(db);
      const employeeById = new Map(employees.map(employee => [String(employee._id), employee]));
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const employee = employeeById.get(String(record.employeeId));
        const reactivationDate = employee?.['Reactivation Date'] ? new Date(employee['Reactivation Date']) : null;
        const lockedAtValue = record.fileTracker?.finalLockedAt || record.fileTracker?.confirmedAt;
        const lockedAt = lockedAtValue ? new Date(lockedAtValue) : null;
        if (reactivationDate && lockedAt && !Number.isNaN(reactivationDate.getTime()) && !Number.isNaN(lockedAt.getTime()) && lockedAt < reactivationDate) {
          const { _id: originalRecordId, ...historicalRecord } = record;
          await db.collection('employee_hr_platform_history').updateOne(
            { originalRecordId, reactivationDate },
            { $setOnInsert: { ...historicalRecord, originalRecordId, employeeSnapshot: employee, archivedAt: new Date(), archiveReason: 'Legacy onboarding cycle separated after employee reactivation', reactivationDate } },
            { upsert: true },
          );
          const freshRecord = { employeeId: String(record.employeeId), onboardingCycleStartedAt: reactivationDate, fileTracker: { fieldsSnapshot: catalog, responses: {}, handbookVersion: '', comments: '' } };
          await db.collection('employee_hr_platform').replaceOne({ _id: originalRecordId }, freshRecord);
          records[index] = freshRecord;
        }
      }
      const recordsWithoutSnapshot = records.filter(record => !record.fileTracker?.fieldsSnapshot);
      const existingIds = new Set(records.map(record => String(record.employeeId)));
      const missingEmployeeIds = ids.filter(id => !existingIds.has(id));
      const snapshotOperations = [
        ...recordsWithoutSnapshot.map(record => ({
          updateOne: {
            filter: { _id: record._id },
            update: { $set: { 'fileTracker.fieldsSnapshot': catalog } },
          },
        })),
        ...missingEmployeeIds.map(employeeId => ({
          updateOne: {
            filter: { employeeId },
            update: { $setOnInsert: { employeeId, fileTracker: { fieldsSnapshot: catalog, responses: {}, handbookVersion: '', comments: '' } } },
            upsert: true,
          },
        })),
      ];
      if (snapshotOperations.length) await db.collection('employee_hr_platform').bulkWrite(snapshotOperations);
      recordsWithoutSnapshot.forEach(record => { record.fileTracker = { ...(record.fileTracker || {}), fieldsSnapshot: catalog }; });
      missingEmployeeIds.forEach(employeeId => records.push({ employeeId, fileTracker: { fieldsSnapshot: catalog, responses: {}, handbookVersion: '', comments: '' } }));
      const byId = new Map(records.map(record => [String(record.employeeId), record]));
      return res.json(employees.map(employee => employeeView(employee, byId.get(String(employee._id))))
        .sort((left, right) => left.name.localeCompare(right.name)));
    } catch (error) {
      console.error('Unable to load HR Platform new hires:', error);
      return res.status(500).json({ error: 'New Hire records could not be loaded.' });
    } finally {
      await client.close();
    }
  });

  function styleReportSheet(sheet) {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = { from: 'A1', to: sheet.getRow(1).getCell(sheet.columnCount).address };
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
      cell.alignment = { vertical: 'middle' };
    });
    sheet.getRow(1).height = 24;
  }

  async function sendWorkbook(res, workbook, fileName) {
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(Buffer.from(buffer));
  }

  router.get('/new-hires/reports/file-tracker.xlsx', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({ 'HR Platform New Hire At': { $exists: true, $ne: null } }).toArray();
      const ids = employees.map(employee => String(employee._id));
      const records = ids.length ? await db.collection('employee_hr_platform').find({ employeeId: { $in: ids } }).toArray() : [];
      const historicalRecords = ids.length ? await db.collection('employee_hr_platform_history').find({ employeeId: { $in: ids } }).toArray() : [];
      const byId = new Map(records.map(record => [String(record.employeeId), record]));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('File Tracker History');
      sheet.columns = [
        { header: 'Employee', key: 'employee', width: 26 }, { header: 'Onboarding Cycle', key: 'cycle', width: 20 }, { header: 'Hire Date', key: 'hireDate', width: 14 },
        { header: 'Employment Status', key: 'employmentStatus', width: 20 }, { header: 'Termination Date', key: 'terminationDate', width: 18 },
        { header: 'Checklist Item', key: 'item', width: 34 }, { header: 'File Status', key: 'status', width: 22 },
        { header: 'Tracker Stage', key: 'stage', width: 24 }, { header: 'Comments', key: 'comments', width: 48 },
        { header: 'Comment By', key: 'commentsBy', width: 30 }, { header: 'Comment Updated At', key: 'commentsUpdatedAt', width: 22 },
        { header: 'Confirmation Date', key: 'confirmationDate', width: 18 }, { header: 'Admin Confirmed By', key: 'submittedBy', width: 30 },
        { header: 'Final Locked By', key: 'lockedBy', width: 30 }, { header: 'Final Locked At', key: 'lockedAt', width: 22 },
      ];
      const appendTrackerRows = (employee, record, cycle) => {
        const tracker = record.fileTracker || {};
        const locked = tracker.finalLockedAt || tracker.confirmedAt;
        const stage = locked ? 'Locked' : tracker.submittedAt ? 'Confirmed for Review' : 'Draft';
        const fields = tracker.fieldsSnapshot || [];
        const base = {
          employee: [clean(employee['Last Name']), clean(employee['First Name'])].filter(Boolean).join(', '),
          cycle, hireDate: clean(employee['Hire Date']), employmentStatus: clean(employee['Position Status']), terminationDate: clean(employee['Termination Date']), stage, comments: clean(tracker.comments),
          commentsBy: clean(tracker.commentsBy), commentsUpdatedAt: tracker.commentsUpdatedAt || '',
          confirmationDate: clean(tracker.confirmationDate), submittedBy: clean(tracker.submittedBy),
          lockedBy: clean(tracker.finalLockedBy || tracker.confirmedBy), lockedAt: tracker.finalLockedAt || tracker.confirmedAt || '',
        };
        if (fields.length) fields.forEach(field => sheet.addRow({ ...base, item: clean(field.label), status: clean(tracker.responses?.[field.id]) || 'Missing' }));
        else sheet.addRow({ ...base, item: 'No checklist snapshot', status: 'Missing' });
      };
      employees.sort((a, b) => clean(a['Last Name']).localeCompare(clean(b['Last Name']))).forEach(employee => {
        appendTrackerRows(employee, byId.get(String(employee._id)) || {}, 'Current');
      });
      historicalRecords.forEach(record => appendTrackerRows(record.employeeSnapshot || {}, record, 'Archived Rehire Cycle'));
      styleReportSheet(sheet);
      return await sendWorkbook(res, workbook, `New_Hire_File_Tracker_History_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Unable to create File Tracker report:', error);
      return res.status(500).json({ error: 'The File Tracker history report could not be created.' });
    } finally {
      await client.close();
    }
  });

  router.get('/new-hires/reports/action-items.xlsx', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({
        $and: [
          { 'HR Platform New Hire At': { $exists: true, $ne: null } },
          { 'Account Active': { $not: /^inactive$/i } }, { 'Position Status': { $not: /^(inactive|terminated)$/i } },
          { $or: [{ 'Termination Date': { $exists: false } }, { 'Termination Date': '' }, { 'Termination Date': null }] },
        ],
      }).toArray();
      const ids = employees.map(employee => String(employee._id));
      const records = ids.length ? await db.collection('employee_hr_platform').find({ employeeId: { $in: ids } }).toArray() : [];
      const byId = new Map(records.map(record => [String(record.employeeId), record]));
      const rows = [];
      employees.forEach(employee => {
        const record = byId.get(String(employee._id)) || {};
        const employeeName = [clean(employee['Last Name']), clean(employee['First Name'])].filter(Boolean).join(', ');
        const base = { employee: employeeName, hireDate: clean(employee['Hire Date']), department: clean(employee['Home Department']), location: clean(employee.Location) };
        if (record.firstPayrollDate && !record.payrollFinalReviewedAt) rows.push({ ...base, action: 'First Payroll', actionDate: record.firstPayrollDate, status: record.payrollCheckedAt ? 'Admin Checked - Final Review Needed' : 'Admin Action Needed', reason: '' });
        if (record.payRateChangePending && record.payrollChangeDate) rows.push({ ...base, action: 'Payroll Change', actionDate: record.payrollChangeDate, status: record.payrollChangeCheckedAt ? 'Admin Checked - Final Review Needed' : 'Admin Action Needed', reason: clean(record.payrollChangeReason) });
        if (record.insuranceEffectiveDate && !record.insuranceCheckedAt) rows.push({ ...base, action: 'Insurance', actionDate: record.insuranceEffectiveDate, status: 'Action Needed', reason: '' });
        if (record.retirementEffectiveDate && !record.retirementCheckedAt) rows.push({ ...base, action: '401(k)', actionDate: record.retirementEffectiveDate, status: 'Action Needed', reason: '' });
      });
      rows.sort((a, b) => clean(a.actionDate).localeCompare(clean(b.actionDate)) || a.employee.localeCompare(b.employee));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Current and Future Actions');
      sheet.columns = [
        { header: 'Action Date', key: 'actionDate', width: 16 }, { header: 'Action Type', key: 'action', width: 20 },
        { header: 'Employee', key: 'employee', width: 28 }, { header: 'Status', key: 'status', width: 34 },
        { header: 'Reason / Notes', key: 'reason', width: 42 }, { header: 'Hire Date', key: 'hireDate', width: 14 },
        { header: 'Department', key: 'department', width: 24 }, { header: 'Location', key: 'location', width: 20 },
      ];
      rows.forEach(row => sheet.addRow(row));
      styleReportSheet(sheet);
      return await sendWorkbook(res, workbook, `HR_Current_and_Future_Actions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Unable to create HR action report:', error);
      return res.status(500).json({ error: 'The current and future action report could not be created.' });
    } finally {
      await client.close();
    }
  });

  router.get('/new-hires/reports/completed-actions.xlsx', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({ 'HR Platform New Hire At': { $exists: true, $ne: null } }).toArray();
      const ids = employees.map(employee => String(employee._id));
      const records = ids.length ? await db.collection('employee_hr_platform').find({ employeeId: { $in: ids } }).toArray() : [];
      const historicalRecords = ids.length ? await db.collection('employee_hr_platform_history').find({ employeeId: { $in: ids } }).toArray() : [];
      const byId = new Map(records.map(record => [String(record.employeeId), record]));
      const completedRowsFor = (employee, record, cycle) => {
        const base = {
          employee: [clean(employee['Last Name']), clean(employee['First Name'])].filter(Boolean).join(', '),
          cycle, hireDate: clean(employee['Hire Date']), employmentStatus: clean(employee['Position Status']), terminationDate: clean(employee['Termination Date']), department: clean(employee['Home Department']), location: clean(employee.Location),
        };
        const completed = [];
        if (record.firstPayrollDate && record.payrollFinalReviewedAt) completed.push({ ...base, actionDate: clean(record.firstPayrollDate), actionType: 'First Payroll', status: 'Completed', adminCheckedBy: clean(record.payrollCheckedBy), finalReviewedBy: clean(record.payrollFinalReviewedBy), reason: '' });
        if (record.payrollChangeDate && record.payrollChangeFinalReviewedAt) completed.push({ ...base, actionDate: clean(record.payrollChangeDate), actionType: 'Payroll Change', status: 'Completed', adminCheckedBy: clean(record.payrollChangeCheckedBy), finalReviewedBy: clean(record.payrollChangeFinalReviewedBy), reason: clean(record.payrollChangeReason) });
        if (record.insuranceEffectiveDate && record.insuranceCheckedAt) completed.push({ ...base, actionDate: clean(record.insuranceEffectiveDate), actionType: 'Insurance', status: 'Action Taken', adminCheckedBy: clean(record.insuranceCheckedBy), finalReviewedBy: '', reason: '' });
        if (record.retirementEffectiveDate && record.retirementCheckedAt) completed.push({ ...base, actionDate: clean(record.retirementEffectiveDate), actionType: '401(k)', status: 'Action Taken', adminCheckedBy: clean(record.retirementCheckedBy), finalReviewedBy: '', reason: '' });
        return completed;
      };
      const rows = [
        ...employees.flatMap(employee => completedRowsFor(employee, byId.get(String(employee._id)) || {}, 'Current')),
        ...historicalRecords.flatMap(record => completedRowsFor(record.employeeSnapshot || {}, record, 'Archived Rehire Cycle')),
      ].sort((a, b) => a.employee.localeCompare(b.employee) || a.actionDate.localeCompare(b.actionDate) || a.actionType.localeCompare(b.actionType));
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Completed Employee Actions');
      sheet.columns = [
        { header: 'Employee', key: 'employee', width: 28 }, { header: 'Onboarding Cycle', key: 'cycle', width: 20 }, { header: 'Action Type', key: 'actionType', width: 20 },
        { header: 'Action / Effective Date', key: 'actionDate', width: 22 }, { header: 'Status', key: 'status', width: 18 },
        { header: 'Admin Checked By', key: 'adminCheckedBy', width: 30 }, { header: 'Final Reviewed By', key: 'finalReviewedBy', width: 30 },
        { header: 'Reason / Notes', key: 'reason', width: 38 }, { header: 'Hire Date', key: 'hireDate', width: 14 },
        { header: 'Employment Status', key: 'employmentStatus', width: 20 }, { header: 'Termination Date', key: 'terminationDate', width: 18 },
        { header: 'Department', key: 'department', width: 24 }, { header: 'Location', key: 'location', width: 20 },
      ];
      rows.forEach(row => sheet.addRow(row));
      styleReportSheet(sheet);
      return await sendWorkbook(res, workbook, `HR_Completed_Employee_Actions_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (error) {
      console.error('Unable to create completed HR action report:', error);
      return res.status(500).json({ error: 'The completed employee action report could not be created.' });
    } finally {
      await client.close();
    }
  });

  router.put('/new-hires/:employeeId', async (req, res) => {
    const employeeId = req.params.employeeId;
    const employeeFolderUrl = clean(req.body?.employeeFolderUrl);
    const payRateType = clean(req.body?.payRateType);
    const payRate = clean(req.body?.payRate);
    const payRateChangePending = req.body?.payRateChangePending === true;
    const payrollChangeDate = clean(req.body?.payrollChangeDate);
    const payrollChangeReason = clean(req.body?.payrollChangeReason);
    const firstPayrollDate = clean(req.body?.firstPayrollDate);
    const insuranceEffectiveDate = clean(req.body?.insuranceEffectiveDate);
    const insuranceNotApplicable = req.body?.insuranceNotApplicable === true;
    const retirementEffectiveDate = clean(req.body?.retirementEffectiveDate);
    const retirementNotApplicable = req.body?.retirementNotApplicable === true;

    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    if (employeeFolderUrl && !isAllowedFolderUrl(employeeFolderUrl)) {
      return res.status(400).json({ error: 'Please enter a valid Royal Truck SharePoint employee folder link.' });
    }
    if (payRateType && !['Hourly Rate', 'Annual Salary'].includes(payRateType)) {
      return res.status(400).json({ error: 'Select Hourly Rate or Annual Salary before entering a Pay Rate.' });
    }
    if (payRate && !/^\d+(\.\d{1,2})?$/.test(payRate)) {
      return res.status(400).json({ error: 'Please enter a valid Pay Rate with no more than two decimal places.' });
    }
    if (payRateChangePending && (!validDate(payrollChangeDate) || !payrollChangeDate || !payrollChangeReason)) {
      return res.status(400).json({ error: 'Pending to Change requires a Payroll Change Date and reason.' });
    }
    if (![firstPayrollDate, insuranceEffectiveDate, retirementEffectiveDate].every(validDate)) {
      return res.status(400).json({ error: 'Please enter valid dates.' });
    }

    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employee = await db.collection('employees').findOne({ _id: new ObjectId(employeeId) });
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });
      const values = {
        employeeFolderUrl, payRateType: payRate ? payRateType : '', payRate, firstPayrollDate,
        insuranceEffectiveDate: insuranceNotApplicable ? '' : insuranceEffectiveDate, insuranceNotApplicable,
        retirementEffectiveDate: retirementNotApplicable ? '' : retirementEffectiveDate, retirementNotApplicable,
        payRateChangePending, payrollChangeDate: payRateChangePending ? payrollChangeDate : '',
        payrollChangeReason: payRateChangePending ? payrollChangeReason : '',
      };
      const existingRecord = await db.collection('employee_hr_platform').findOne({ employeeId });
      const dateCorrection = Boolean(existingRecord && (
        clean(existingRecord.firstPayrollDate) !== firstPayrollDate ||
        clean(existingRecord.insuranceEffectiveDate) !== values.insuranceEffectiveDate ||
        (existingRecord.insuranceNotApplicable === true) !== insuranceNotApplicable ||
        clean(existingRecord.retirementEffectiveDate) !== values.retirementEffectiveDate ||
        (existingRecord.retirementNotApplicable === true) !== retirementNotApplicable
      ));
      if (!dateCorrection) {
        if (!payRateType || !payRate) return res.status(400).json({ error: 'Pay Type and Pay Rate are required.' });
        if (!firstPayrollDate) return res.status(400).json({ error: 'First Payroll Date is required.' });
        if ((!insuranceNotApplicable && !insuranceEffectiveDate) || (insuranceNotApplicable && insuranceEffectiveDate)) return res.status(400).json({ error: 'Insurance must have an Effective Date or be marked Not Applicable.' });
        if ((!retirementNotApplicable && !retirementEffectiveDate) || (retirementNotApplicable && retirementEffectiveDate)) return res.status(400).json({ error: '401(k) must have an Effective Date or be marked Not Applicable.' });
      } else if ((!insuranceNotApplicable && !insuranceEffectiveDate && (clean(existingRecord.insuranceEffectiveDate) !== values.insuranceEffectiveDate || (existingRecord.insuranceNotApplicable === true) !== insuranceNotApplicable)) || (insuranceNotApplicable && insuranceEffectiveDate)) {
        return res.status(400).json({ error: 'Insurance must have an Effective Date or be marked Not Applicable.' });
      } else if ((!retirementNotApplicable && !retirementEffectiveDate && (clean(existingRecord.retirementEffectiveDate) !== values.retirementEffectiveDate || (existingRecord.retirementNotApplicable === true) !== retirementNotApplicable)) || (retirementNotApplicable && retirementEffectiveDate)) {
        return res.status(400).json({ error: '401(k) must have an Effective Date or be marked Not Applicable.' });
      }
      const changeRequestChanged = payrollChangeRequestChanged(existingRecord || {}, payRateChangePending, payrollChangeDate, payrollChangeReason);
      const unsetReviewFields = {};
      const resetResponse = {};
      const resetReasons = [];
      const addResetFields = (fields) => fields.forEach(field => {
        unsetReviewFields[field] = '';
        resetResponse[field] = field.endsWith('At') ? null : '';
      });
      if (existingRecord && clean(existingRecord.firstPayrollDate) !== firstPayrollDate) {
        resetReasons.push('First Payroll Date changed');
        addResetFields(['payrollCheckedAt', 'payrollCheckedBy', 'payrollFinalReviewedAt', 'payrollFinalReviewedBy']);
      }
      if (existingRecord && (clean(existingRecord.insuranceEffectiveDate) !== values.insuranceEffectiveDate || (existingRecord.insuranceNotApplicable === true) !== insuranceNotApplicable)) {
        resetReasons.push('Insurance applicability or Effective Date changed');
        addResetFields(['insuranceCheckedAt', 'insuranceCheckedBy']);
      }
      if (existingRecord && (clean(existingRecord.retirementEffectiveDate) !== values.retirementEffectiveDate || (existingRecord.retirementNotApplicable === true) !== retirementNotApplicable)) {
        resetReasons.push('401(k) applicability or Effective Date changed');
        addResetFields(['retirementCheckedAt', 'retirementCheckedBy']);
      }
      if (changeRequestChanged) {
        resetReasons.push('Payroll Change request changed');
        addResetFields(['payrollChangeCheckedAt', 'payrollChangeCheckedBy', 'payrollChangeFinalReviewedAt', 'payrollChangeFinalReviewedBy']);
      }
      const reviewReset = Object.keys(unsetReviewFields).length ? { $unset: unsetReviewFields } : {};
      const reviewResetAudit = resetReasons.length ? { $push: { reviewResetHistory: {
        resetAt: new Date(), resetBy: req.adminSession?.email || null, reasons: resetReasons,
        previousReviewValues: Object.fromEntries(Object.keys(unsetReviewFields).map(field => [field, existingRecord?.[field] || null])),
      } } } : {};
      await db.collection('employee_hr_platform').updateOne(
        { employeeId },
        { $set: { ...values, updatedAt: new Date(), updatedBy: req.adminSession?.email || null }, ...reviewReset, ...reviewResetAudit },
        { upsert: true },
      );
      return res.json({ ...values, ...resetResponse });
    } catch (error) {
      console.error('Unable to save HR Platform new hire:', error);
      return res.status(500).json({ error: 'New Hire record could not be saved.' });
    } finally {
      await client.close();
    }
  });

  router.get('/file-tracker-fields', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const fields = await getTrackerCatalog(client.db(databaseName), req.query.includeInactive === 'true');
      return res.json({ fields });
    } catch (error) {
      console.error('Unable to load File Tracker fields:', error);
      return res.status(500).json({ error: 'File Tracker settings could not be loaded.' });
    } finally { await client.close(); }
  });

  router.post('/file-tracker-fields', async (req, res) => {
    const client = createClient();
    try {
      const result = sanitizeTrackerCatalogField({ ...req.body, id: crypto.randomUUID() });
      if (result.error) return res.status(400).json({ error: result.error });
      await client.connect();
      const db = client.db(databaseName);
      const collection = await ensureTrackerCatalog(db);
      result.field.order = await collection.countDocuments({});
      await collection.insertOne({ ...result.field, createdAt: new Date(), createdBy: req.adminSession?.email || null });
      return res.status(201).json({ field: result.field });
    } catch (error) {
      console.error('Unable to add File Tracker field:', error);
      return res.status(500).json({ error: 'The checklist item could not be added.' });
    } finally { await client.close(); }
  });

  router.put('/file-tracker-fields/:fieldId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = await ensureTrackerCatalog(db);
      const existing = await collection.findOne({ id: req.params.fieldId });
      if (!existing) return res.status(404).json({ error: 'Checklist item not found.' });
      const result = sanitizeTrackerCatalogField(req.body, existing);
      if (result.error) return res.status(400).json({ error: result.error });
      await collection.updateOne({ id: existing.id }, { $set: { ...result.field, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } });
      return res.json({ field: result.field });
    } catch (error) {
      console.error('Unable to update File Tracker field:', error);
      return res.status(500).json({ error: 'The checklist item could not be updated.' });
    } finally { await client.close(); }
  });

  router.delete('/file-tracker-fields/:fieldId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('hr_file_tracker_fields');
      const existing = await collection.findOne({ id: req.params.fieldId, deleted: { $ne: true } });
      if (!existing) return res.status(404).json({ error: 'Checklist item not found.' });
      await collection.updateOne(
        { id: existing.id },
        { $set: { deleted: true, deletedAt: new Date(), deletedBy: req.adminSession?.email || null } },
      );
      return res.json({ success: true, fieldId: existing.id });
    } catch (error) {
      console.error('Unable to delete File Tracker field:', error);
      return res.status(500).json({ error: 'The checklist item could not be deleted.' });
    } finally { await client.close(); }
  });

  router.put('/new-hires/:employeeId/file-tracker', async (req, res) => {
    const employeeId = req.params.employeeId;
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const action = clean(req.body?.action || 'save').toLowerCase();
    const confirmationDate = clean(req.body?.confirmationDate);

    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('employee_hr_platform');
      const existing = await collection.findOne({ employeeId });
      if (existing?.fileTracker?.finalLockedAt || existing?.fileTracker?.confirmedAt) {
        return res.status(409).json({ error: 'This File Tracker has been finally confirmed and can no longer be modified.' });
      }
      if (action === 'comment') {
        const comments = clean(req.body?.fileTracker?.comments);
        const commentFields = commentAudit(existing?.fileTracker || {}, comments, req.adminSession?.email || null);
        await collection.updateOne(
          { employeeId },
          { $set: { ...Object.fromEntries(Object.entries(commentFields).map(([key, value]) => [`fileTracker.${key}`, value])), updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
          { upsert: true },
        );
        return res.json({ fileTracker: { ...(existing?.fileTracker || {}), ...commentFields } });
      }
      if (action === 'lock') {
        if (clean(req.adminSession?.email).toLowerCase() !== finalReviewerEmail) return res.status(403).json({ error: 'Only the authorized upper-level manager can perform the final File Tracker lock.' });
        if (!existing?.fileTracker?.submittedAt) return res.status(400).json({ error: 'The File Tracker must be confirmed for review before final locking.' });
        const fileTracker = { ...existing.fileTracker, finalLockedAt: new Date(), finalLockedBy: finalReviewerEmail };
        await collection.updateOne({ employeeId }, { $set: { fileTracker, updatedAt: new Date(), updatedBy: finalReviewerEmail } });
        return res.json({ fileTracker });
      }
      if (existing?.fileTracker?.submittedAt) return res.status(409).json({ error: 'This File Tracker has already been confirmed for final review.' });
      const catalog = existing?.fileTracker?.fieldsSnapshot || await getTrackerCatalog(db);
      const tracker = sanitizeFileTracker(req.body?.fileTracker, catalog);
      const commentFields = commentAudit(existing?.fileTracker || {}, tracker.comments, req.adminSession?.email || null);
      const submit = action === 'submit';
      if (submit && (!fileTrackerComplete(tracker, catalog) || !validDate(confirmationDate) || !confirmationDate)) {
        return res.status(400).json({ error: 'Complete every checklist item, the handbook version when required, and the confirmation date before confirming for review.' });
      }
      const fileTracker = {
        ...tracker,
        ...commentFields,
        fieldsSnapshot: catalog,
        confirmationDate: submit ? confirmationDate : '',
        submittedAt: submit ? new Date() : null,
        submittedBy: submit ? (req.adminSession?.email || null) : null,
        finalLockedAt: null,
        finalLockedBy: null,
      };
      await collection.updateOne(
        { employeeId },
        { $set: { fileTracker, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
        { upsert: true },
      );
      return res.json({ fileTracker });
    } catch (error) {
      console.error('Unable to save HR Platform File Tracker:', error);
      return res.status(500).json({ error: 'The File Tracker could not be saved.' });
    } finally {
      await client.close();
    }
  });

  router.put('/new-hires/:employeeId/checks', async (req, res) => {
    const employeeId = req.params.employeeId;
    const action = clean(req.body?.action).toLowerCase();
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const fieldsByAction = {
      'payroll-check': ['payrollCheckedAt', 'payrollCheckedBy'],
      'payroll-final-review': ['payrollFinalReviewedAt', 'payrollFinalReviewedBy'],
      'insurance-check': ['insuranceCheckedAt', 'insuranceCheckedBy'],
      'retirement-check': ['retirementCheckedAt', 'retirementCheckedBy'],
      'payroll-final-review-undo': ['payrollFinalReviewedAt', 'payrollFinalReviewedBy'],
      'payroll-change-check': ['payrollChangeCheckedAt', 'payrollChangeCheckedBy'],
      'payroll-change-final-review': ['payrollChangeFinalReviewedAt', 'payrollChangeFinalReviewedBy'],
    };
    const fields = fieldsByAction[action];
    if (!fields) return res.status(400).json({ error: 'Invalid review action.' });
    const reviewerEmail = clean(req.adminSession?.email).toLowerCase();
    if (['payroll-final-review', 'payroll-final-review-undo', 'payroll-change-final-review'].includes(action) && reviewerEmail !== finalReviewerEmail) {
      return res.status(403).json({ error: 'Only the authorized upper-level manager can perform Payroll Final Review.' });
    }
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('employee_hr_platform');
      const existing = await collection.findOne({ employeeId });
      if (action === 'payroll-final-review-undo') {
        if (!existing?.payrollFinalReviewedAt) return res.status(409).json({ error: 'Payroll Final Review is not currently approved.' });
        await collection.updateOne(
          { employeeId },
          {
            $unset: { payrollFinalReviewedAt: '', payrollFinalReviewedBy: '' },
            $set: { payrollFinalReviewCorrectedAt: new Date(), payrollFinalReviewCorrectedBy: reviewerEmail, updatedAt: new Date(), updatedBy: reviewerEmail },
          },
        );
        return res.json({ payrollFinalReviewedAt: null, payrollFinalReviewedBy: '' });
      }
      if (action === 'payroll-final-review' && !existing?.payrollCheckedAt) {
        return res.status(400).json({ error: 'Payroll Check must be completed before Payroll Final Review.' });
      }
      if (action === 'payroll-change-check' && !existing?.payRateChangePending) {
        return res.status(400).json({ error: 'This employee does not have a pending Pay Rate change.' });
      }
      if (action === 'payroll-change-final-review' && (!existing?.payRateChangePending || !existing?.payrollChangeCheckedAt)) {
        return res.status(400).json({ error: 'Payroll Change Check must be completed before final review.' });
      }
      if (existing?.[fields[0]]) return res.status(409).json({ error: 'This review has already been completed.' });
      const values = { [fields[0]]: new Date(), [fields[1]]: reviewerEmail };
      if (action === 'payroll-change-final-review') values.payRateChangePending = false;
      await collection.updateOne({ employeeId }, { $set: { ...values, updatedAt: new Date(), updatedBy: reviewerEmail } }, { upsert: true });
      return res.json(values);
    } catch (error) {
      console.error('Unable to save HR Platform review check:', error);
      return res.status(500).json({ error: 'The review check could not be saved.' });
    } finally { await client.close(); }
  });

  router.get('/terminations', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({
        $or: [
          { 'Position Status': /^terminated$/i },
          { 'Termination Date': { $exists: true, $nin: ['', null] } },
        ],
      }).toArray();
      const ids = employees.map(employee => String(employee._id));
      const records = ids.length ? await db.collection('employee_hr_termination').find({ employeeId: { $in: ids } }).toArray() : [];
      const existingIds = new Set(records.map(record => String(record.employeeId)));
      const missingIds = ids.filter(id => !existingIds.has(id));
      if (missingIds.length) {
        await db.collection('employee_hr_termination').bulkWrite(missingIds.map(employeeId => ({
          updateOne: { filter: { employeeId }, update: { $setOnInsert: { employeeId, createdAt: new Date() } }, upsert: true },
        })));
        missingIds.forEach(employeeId => records.push({ employeeId }));
      }
      const byId = new Map(records.map(record => [String(record.employeeId), record]));
      return res.json(employees.map(employee => terminationEmployeeView(employee, byId.get(String(employee._id))))
        .sort((left, right) => clean(right.terminationDate).localeCompare(clean(left.terminationDate)) || left.name.localeCompare(right.name)));
    } catch (error) {
      console.error('Unable to load HR Platform terminations:', error);
      return res.status(500).json({ error: 'Termination records could not be loaded.' });
    } finally { await client.close(); }
  });

  router.put('/terminations/:employeeId', async (req, res) => {
    const employeeId = req.params.employeeId;
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const values = {
      employeeFolderUrl: clean(req.body?.employeeFolderUrl),
      finalPayrollDate: clean(req.body?.finalPayrollDate),
      pendingIssues: req.body?.pendingIssues === true,
      pendingIssuesNotes: clean(req.body?.pendingIssuesNotes),
      payrollFollowThroughUntil: clean(req.body?.payrollFollowThroughUntil),
      insuranceParticipation: clean(req.body?.insuranceParticipation).toLowerCase(),
      insuranceEndingDate: clean(req.body?.insuranceEndingDate),
      retirementParticipation: clean(req.body?.retirementParticipation).toLowerCase(),
      retirementEndingDate: clean(req.body?.retirementEndingDate),
    };
    if (!values.employeeFolderUrl) return res.status(400).json({ error: 'Employee Folder Link is required.' });
    if (!/^https:\/\//i.test(values.employeeFolderUrl)) return res.status(400).json({ error: 'Employee Folder Link must be a secure https:// link.' });
    const dates = [values.finalPayrollDate, values.payrollFollowThroughUntil, values.insuranceEndingDate, values.retirementEndingDate];
    if (dates.some(value => !validDate(value))) return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
    if (!values.finalPayrollDate) return res.status(400).json({ error: 'Final Payroll Date is required.' });
    if (values.pendingIssues && (!values.payrollFollowThroughUntil || !values.pendingIssuesNotes)) return res.status(400).json({ error: 'Pending Issues require a follow-through date and notes.' });
    if (!['participated', 'not-participated'].includes(values.insuranceParticipation)) return res.status(400).json({ error: 'Select whether the employee participated in Insurance.' });
    if (values.insuranceParticipation === 'participated' && !values.insuranceEndingDate) return res.status(400).json({ error: 'Insurance Ending Date is required for participating employees.' });
    if (!['participated', 'not-participated'].includes(values.retirementParticipation)) return res.status(400).json({ error: 'Select whether the employee participated in 401(k).' });
    if (values.retirementParticipation === 'participated' && !values.retirementEndingDate) return res.status(400).json({ error: '401(k) Ending Date is required for participating employees.' });
    if (values.insuranceParticipation === 'not-participated') values.insuranceEndingDate = '';
    if (values.retirementParticipation === 'not-participated') values.retirementEndingDate = '';
    if (!values.pendingIssues) { values.pendingIssuesNotes = ''; values.payrollFollowThroughUntil = ''; }
    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('employee_hr_termination');
      const existing = await collection.findOne({ employeeId }) || {};
      const unset = {};
      if (clean(existing.finalPayrollDate) !== values.finalPayrollDate) Object.assign(unset, { payrollCheckedAt: '', payrollCheckedBy: '', payrollFinalReviewedAt: '', payrollFinalReviewedBy: '' });
      if (existing.pendingIssues !== values.pendingIssues || clean(existing.payrollFollowThroughUntil) !== values.payrollFollowThroughUntil) Object.assign(unset, { payrollCheckedAt: '', payrollCheckedBy: '', payrollFinalReviewedAt: '', payrollFinalReviewedBy: '' });
      if (clean(existing.insuranceParticipation) !== values.insuranceParticipation || clean(existing.insuranceEndingDate) !== values.insuranceEndingDate) Object.assign(unset, { insuranceCobraCheckedAt: '', insuranceCobraCheckedBy: '' });
      if (clean(existing.retirementParticipation) !== values.retirementParticipation || clean(existing.retirementEndingDate) !== values.retirementEndingDate) Object.assign(unset, { retirementCheckedAt: '', retirementCheckedBy: '' });
      const update = { $set: { ...values, updatedAt: new Date(), updatedBy: clean(req.adminSession?.email).toLowerCase() } };
      if (Object.keys(unset).length) update.$unset = unset;
      await collection.updateOne({ employeeId }, update, { upsert: true });
      return res.json({ ...values, reviewsReset: Object.keys(unset) });
    } catch (error) {
      console.error('Unable to save HR Platform termination:', error);
      return res.status(500).json({ error: 'Termination record could not be saved.' });
    } finally { await client.close(); }
  });

  router.put('/terminations/:employeeId/file-tracker', async (req, res) => {
    const employeeId = req.params.employeeId;
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const action = clean(req.body?.action || 'save').toLowerCase();
    const confirmationDate = clean(req.body?.confirmationDate);
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('employee_hr_termination');
      const existing = await collection.findOne({ employeeId }) || {};
      if (existing.fileTracker?.finalLockedAt) return res.status(409).json({ error: 'This Termination File Tracker is locked and cannot be modified.' });
      if (action === 'lock') {
        if (clean(req.adminSession?.email).toLowerCase() !== finalReviewerEmail) return res.status(403).json({ error: 'Only the upper-level manager can lock the Termination File Tracker.' });
        if (!existing.fileTracker?.submittedAt) return res.status(400).json({ error: 'An administrator must confirm the tracker before it can be locked.' });
        const fileTracker = { ...existing.fileTracker, finalLockedAt: new Date(), finalLockedBy: finalReviewerEmail };
        await collection.updateOne({ employeeId }, { $set: { fileTracker, updatedAt: new Date(), updatedBy: finalReviewerEmail } }, { upsert: true });
        return res.json({ fileTracker });
      }
      if (existing.fileTracker?.submittedAt) return res.status(409).json({ error: 'This tracker has been confirmed and is awaiting final lock.' });
      const catalog = existing.fileTracker?.fieldsSnapshot || await getTrackerCatalog(db);
      const tracker = sanitizeFileTracker(req.body?.fileTracker, catalog);
      const commentFields = commentAudit(existing.fileTracker || {}, tracker.comments, req.adminSession?.email || null);
      const submit = action === 'submit';
      if (submit && (!fileTrackerComplete(tracker, catalog) || !validDate(confirmationDate) || !confirmationDate)) return res.status(400).json({ error: 'Complete every checklist item and enter the confirmation date before confirming.' });
      const fileTracker = { ...tracker, ...commentFields, fieldsSnapshot: catalog, confirmationDate: submit ? confirmationDate : '', submittedAt: submit ? new Date() : null, submittedBy: submit ? req.adminSession?.email : null, finalLockedAt: null, finalLockedBy: null };
      await collection.updateOne({ employeeId }, { $set: { fileTracker, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } }, { upsert: true });
      return res.json({ fileTracker });
    } catch (error) {
      console.error('Unable to save Termination File Tracker:', error);
      return res.status(500).json({ error: 'The Termination File Tracker could not be saved.' });
    } finally { await client.close(); }
  });

  router.put('/terminations/:employeeId/checks', async (req, res) => {
    const employeeId = req.params.employeeId;
    const action = clean(req.body?.action).toLowerCase();
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const fieldsByAction = {
      'payroll-check': ['payrollCheckedAt', 'payrollCheckedBy'],
      'payroll-final-review': ['payrollFinalReviewedAt', 'payrollFinalReviewedBy'],
      'payroll-final-review-undo': ['payrollFinalReviewedAt', 'payrollFinalReviewedBy'],
      'insurance-cobra-check': ['insuranceCobraCheckedAt', 'insuranceCobraCheckedBy'],
      'retirement-check': ['retirementCheckedAt', 'retirementCheckedBy'],
    };
    const fields = fieldsByAction[action];
    if (!fields) return res.status(400).json({ error: 'Invalid review action.' });
    const reviewerEmail = clean(req.adminSession?.email).toLowerCase();
    if (['payroll-final-review', 'payroll-final-review-undo'].includes(action) && reviewerEmail !== finalReviewerEmail) return res.status(403).json({ error: 'Only the authorized upper-level manager can perform Payroll Final Review.' });
    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('employee_hr_termination');
      const existing = await collection.findOne({ employeeId });
      if (!existing?.finalPayrollDate) return res.status(400).json({ error: 'Complete Termination Details before taking action.' });
      if (action === 'payroll-final-review' && !existing.payrollCheckedAt) return res.status(400).json({ error: 'Payroll Check must be completed first.' });
      if (action === 'payroll-final-review-undo') {
        await collection.updateOne({ employeeId }, { $unset: { payrollFinalReviewedAt: '', payrollFinalReviewedBy: '' }, $set: { updatedAt: new Date(), updatedBy: reviewerEmail } });
        return res.json({ payrollFinalReviewedAt: null, payrollFinalReviewedBy: '' });
      }
      if (existing?.[fields[0]]) return res.status(409).json({ error: 'This action has already been completed.' });
      const values = { [fields[0]]: new Date(), [fields[1]]: reviewerEmail, updatedAt: new Date(), updatedBy: reviewerEmail };
      await collection.updateOne({ employeeId }, { $set: values }, { upsert: true });
      return res.json(values);
    } catch (error) {
      console.error('Unable to save termination action:', error);
      return res.status(500).json({ error: 'Termination action could not be saved.' });
    } finally { await client.close(); }
  });

  return router;
}

module.exports = { createHrPlatformRouter };
