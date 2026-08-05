­r‡^Ñf¥–Ø¦{N¬yÊ'vÃ®¶›­const express = require('express');
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
        ó^·¶‰žËkºwµçe¹…Ñ”¤°4(€€€ôì(€€€¥˜€ …Ù…±Õ•Ì¹•µÁ±½å••½±‘•ÉUÉ°¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€µÁ±½å•”½±‘•È1¥¹¬¥ÌÉ•ÅÕ¥É•¸œô¤ì(€€€¥˜€ „½y¡ÑÑÁÌép½p¼½¤¹Ñ•ÍÐ¡Ù…±Õ•Ì¹•µÁ±½å••½±‘•ÉUÉ°¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€µÁ±½å•”½±‘•È1¥¹¬µÕÍÐ‰”„Í•ÕÉ”¡ÑÑÁÌè¼¼±¥¹¬¸œô¤ì(€€€½¹ÍÐ‘…Ñ•Ì€ômÙ…±Õ•Ì¹™¥¹…±A…åÉ½±±…Ñ”°Ù…±Õ•Ì¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°°Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”°Ù…±Õ•Ì¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ•tì4(€€€¥˜€¡‘…Ñ•Ì¹Í½µ”¡Ù…±Õ”€ôø€…Ù…±¥‘…Ñ”¡Ù…±Õ”¤¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€…Ñ•ÌµÕÍÐÕÍ”eeedµ54µ™½Éµ…Ð¸œô¤ì4(€€€¥˜€ …Ù…±Õ•Ì¹™¥¹…±A…åÉ½±±…Ñ”¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€¥¹…°A…åÉ½±°…Ñ”¥ÌÉ•ÅÕ¥É•¸œô¤ì4(€€€¥˜€¡Ù…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Ì€˜˜€ …Ù…±Õ•Ì¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°ñð€…Ù…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Í9½Ñ•Ì¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€A•¹‘¥¹œ%ÍÍÕ•ÌÉ•ÅÕ¥É”„™½±±½ÜµÑ¡É½Õ ‘…Ñ”…¹¹½Ñ•Ì¸œô¤ì4(€€€¥˜€ …lÁ…ÉÑ¥¥Á…Ñ•œ°€¹½ÐµÁ…ÉÑ¥¥Á…Ñ•t¹¥¹±Õ‘•Ì¡Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€M•±•ÐÝ¡•Ñ¡•ÈÑ¡”•µÁ±½å•”Á…ÉÑ¥¥Á…Ñ•¥¸%¹ÍÕÉ…¹”¸œô¤ì4(€€€¥˜€¡Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸€ôôô€Á…ÉÑ¥¥Á…Ñ•œ€˜˜€…Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€%¹ÍÕÉ…¹”¹‘¥¹œ…Ñ”¥ÌÉ•ÅÕ¥É•™½ÈÁ…ÉÑ¥¥Á…Ñ¥¹œ•µÁ±½å••Ì¸œô¤ì4(€€€¥˜€ …lÁ…ÉÑ¥¥Á…Ñ•œ°€¹½ÐµÁ…ÉÑ¥¥Á…Ñ•t¹¥¹±Õ‘•Ì¡Ù…±Õ•Ì¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€M•±•ÐÝ¡•Ñ¡•ÈÑ¡”•µÁ±½å•”Á…ÉÑ¥¥Á…Ñ•¥¸€ÐÀÄ¡¬¤¸œô¤ì4(€€€¥˜€¡Ù…±Õ•Ì¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸€ôôô€Á…ÉÑ¥¥Á…Ñ•œ€˜˜€…Ù…±Õ•Ì¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ”¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€œÐÀÄ¡¬¤¹‘¥¹œ…Ñ”¥ÌÉ•ÅÕ¥É•™½ÈÁ…ÉÑ¥¥Á…Ñ¥¹œ•µÁ±½å••Ì¸œô¤ì4(€€€¥˜€¡Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸€ôôô€¹½ÐµÁ…ÉÑ¥¥Á…Ñ•œ¤Ù…±Õ•Ì¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”€ô€œœì4(€€€¥˜€¡Ù…±Õ•Ì¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸€ôôô€¹½ÐµÁ…ÉÑ¥¥Á…Ñ•œ¤Ù…±Õ•Ì¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ”€ô€œœì4(€€€¥˜€ …Ù…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Ì¤ìÙ…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Í9½Ñ•Ì€ô€œœìÙ…±Õ•Ì¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°€ô€œœìô4(€€€½¹ÍÐ±¥•¹Ð€ôÉ•…Ñ•±¥•¹Ð ¤ì4(€€€ÑÉäì4(€€€€€…Ý…¥Ð±¥•¹Ð¹½¹¹•Ð ¤ì4(€€€€€½¹ÍÐ½±±•Ñ¥½¸€ô±¥•¹Ð¹‘ˆ¡‘…Ñ…‰…Í•9…µ”¤¹½±±•Ñ¥½¸ •µÁ±½å••}¡É}Ñ•Éµ¥¹…Ñ¥½¸œ¤ì4(€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð½±±•Ñ¥½¸¹™¥¹‘=¹”¡ì•µÁ±½å••%ô¤ñðíôì4(€€€€€½¹ÍÐÕ¹Í•Ð€ôíôì4(€€€€€¥˜€¡±•…¸¡•á¥ÍÑ¥¹œ¹™¥¹…±A…åÉ½±±…Ñ”¤€„ôôÙ…±Õ•Ì¹™¥¹…±A…åÉ½±±…Ñ”¤=‰©•Ð¹…ÍÍ¥¸¡Õ¹Í•Ð°ìÁ…åÉ½±±¡•­•‘Ðè€œœ°Á…åÉ½±±¡•­•‘	äè€œœ°Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ðè€œœ°Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	äè€œœô¤ì4(€€€€€¥˜€¡•á¥ÍÑ¥¹œ¹Á•¹‘¥¹%ÍÍÕ•Ì€„ôôÙ…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Ìñð±•…¸¡•á¥ÍÑ¥¹œ¹Á•¹‘¥¹%ÍÍÕ•Í9½Ñ•Ì¤€„ôôÙ…±Õ•Ì¹Á•¹‘¥¹%ÍÍÕ•Í9½Ñ•Ìñð±•…¸¡•á¥ÍÑ¥¹œ¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°¤€„ôôÙ…±Õ•Ì¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°¤=‰©•Ð¹…ÍÍ¥¸¡Õ¹Í•Ð°ì™½±±½ÝUÁ¡•­•‘Ðè€œœ°™½±±½ÝUÁ¡•­•‘	äè€œœ°™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘Ðè€œœ°™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘	äè€œœô¤ì(€€€€€¥˜€¡±•…¸¡•á¥ÍÑ¥¹œ¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸¤€„ôôÙ…±Õ•Ì¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸ñð±•…¸¡•á¥ÍÑ¥¹œ¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”¤€„ôôÙ…±Õ•Ì¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”¤=‰©•Ð¹…ÍÍ¥¸¡Õ¹Í•Ð°ì¥¹ÍÕÉ…¹•½‰É…¡•­•‘Ðè€œœ°¥¹ÍÕÉ…¹•½‰É…¡•­•‘	äè€œœô¤ì4(€€€€€¥˜€¡±•…¸¡•á¥ÍÑ¥¹œ¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸¤€„ôôÙ…±Õ•Ì¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸ñð±•…¸¡•á¥ÍÑ¥¹œ¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ”¤€„ôôÙ…±Õ•Ì¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ”¤=‰©•Ð¹…ÍÍ¥¸¡Õ¹Í•Ð°ìÉ•Ñ¥É•µ•¹Ñ¡•­•‘Ðè€œœ°É•Ñ¥É•µ•¹Ñ¡•­•‘	äè€œœô¤ì4(€€€€€½¹ÍÐÕÁ‘…Ñ”€ôì€‘Í•Ðèì€¸¸¹Ù…±Õ•Ì°ÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤°ÕÁ‘…Ñ•‘	äè±•…¸¡É•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°¤¹Ñ½1½Ý•É…Í” ¤ôôì4(€€€€€¥˜€¡=‰©•Ð¹­•åÌ¡Õ¹Í•Ð¤¹±•¹Ñ ¤ÕÁ‘…Ñ”¸‘Õ¹Í•Ð€ôÕ¹Í•Ðì4(€€€€€…Ý…¥Ð½±±•Ñ¥½¸¹ÕÁ‘…Ñ•=¹”¡ì•µÁ±½å••%ô°ÕÁ‘…Ñ”°ìÕÁÍ•ÉÐèÑÉÕ”ô¤ì4(€€€€€É•ÑÕÉ¸É•Ì¹©Í½¸¡ì€¸¸¹Ù…±Õ•Ì°É•Ù¥•ÝÍI•Í•Ðè=‰©•Ð¹­•åÌ¡Õ¹Í•Ð¤ô¤ì4(€€€ô…Ñ €¡•ÉÉ½È¤ì4(€€€€€½¹Í½±”¹•ÉÉ½È U¹…‰±”Ñ¼Í…Ù”!HA±…Ñ™½É´Ñ•Éµ¥¹…Ñ¥½¸èœ°•ÉÉ½È¤ì4(€€€€€É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÔÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€Q•Éµ¥¹…Ñ¥½¸É•½É½Õ±¹½Ð‰”Í…Ù•¸œô¤ì4(€€€ô™¥¹…±±äì…Ý…¥Ð±¥•¹Ð¹±½Í” ¤ìô4(€ô¤ì((€É½ÕÑ•È¹ÁÕÐ œ½Ñ•Éµ¥¹…Ñ¥½¹Ì¼é•µÁ±½å••%½™¥±”µÑÉ…­•Èœ°…Íå¹Œ€¡É•Ä°É•Ì¤€ôøì(€€€½¹ÍÐ•µÁ±½å••%€ôÉ•Ä¹Á…É…µÌ¹•µÁ±½å••%ì(€€€¥˜€ …=‰©•Ñ%¹¥ÍY…±¥¡•µÁ±½å••%¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€%¹Ù…±¥•µÁ±½å•”¸œô¤ì(€€€½¹ÍÐ…Ñ¥½¸€ô±•…¸¡É•Ä¹‰½‘äü¹…Ñ¥½¸ñð€Í…Ù”œ¤¹Ñ½1½Ý•É…Í” ¤ì(€€€½¹ÍÐ½¹™¥Éµ…Ñ¥½¹…Ñ”€ô±•…¸¡É•Ä¹‰½‘äü¹½¹™¥Éµ…Ñ¥½¹…Ñ”¤ì(€€€½¹ÍÐ±¥•¹Ð€ôÉ•…Ñ•±¥•¹Ð ¤ì(€€€ÑÉäì(€€€€€…Ý…¥Ð±¥•¹Ð¹½¹¹•Ð ¤ì(€€€€€½¹ÍÐ‘ˆ€ô±¥•¹Ð¹‘ˆ¡‘…Ñ…‰…Í•9…µ”¤ì(€€€€€½¹ÍÐ½±±•Ñ¥½¸€ô‘ˆ¹½±±•Ñ¥½¸ •µÁ±½å••}¡É}Ñ•Éµ¥¹…Ñ¥½¸œ¤ì(€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð½±±•Ñ¥½¸¹™¥¹‘=¹”¡ì•µÁ±½å••%ô¤ñðíôì(€€€€€¥˜€¡•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•Èü¹™¥¹…±1½­•‘Ð¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀä¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡¥ÌQ•Éµ¥¹…Ñ¥½¸¥±”QÉ…­•È¥Ì±½­•…¹…¹¹½Ð‰”µ½‘¥™¥•¸œô¤ì(€€€€€¥˜€¡…Ñ¥½¸€ôôô€±½¬œ¤ì(€€€€€€€¥˜€¡±•…¸¡É•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°¤¹Ñ½1½Ý•É…Í” ¤€„ôô™¥¹…±I•Ù¥•Ý•Éµ…¥°¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÌ¤¹©Í½¸¡ì•ÉÉ½Èè€=¹±äÑ¡”ÕÁÁ•Èµ±•Ù•°µ…¹…•È…¸±½¬Ñ¡”Q•Éµ¥¹…Ñ¥½¸¥±”QÉ…­•È¸œô¤ì(€€€€€€€¥˜€ …•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•Èü¹ÍÕ‰µ¥ÑÑ•‘Ð¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€¸…‘µ¥¹¥ÍÑÉ…Ñ½ÈµÕÍÐ½¹™¥É´Ñ¡”ÑÉ…­•È‰•™½É”¥Ð…¸‰”±½­•¸œô¤ì(€€€€€€€½¹ÍÐ™¥±•QÉ…­•È€ôì€¸¸¹•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•È°™¥¹…±1½­•‘Ðè¹•Ü…Ñ” ¤°™¥¹…±1½­•‘	äè™¥¹…±I•Ù¥•Ý•Éµ…¥°ôì(€€€€€€€…Ý…¥Ð½±±•Ñ¥½¸¹ÕÁ‘…Ñ•=¹”¡ì•µÁ±½å••%ô°ì€‘Í•Ðèì™¥±•QÉ…­•È°ÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤°ÕÁ‘…Ñ•‘	äè™¥¹…±I•Ù¥•Ý•Éµ…¥°ôô°ìÕÁÍ•ÉÐèÑÉÕ”ô¤ì(€€€€€€€É•ÑÕÉ¸É•Ì¹©Í½¸¡ì™¥±•QÉ…­•Èô¤ì(€€€€€ô(€€€€€¥˜€¡•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•Èü¹ÍÕ‰µ¥ÑÑ•‘Ð¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀä¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡¥ÌÑÉ…­•È¡…Ì‰••¸½¹™¥Éµ•…¹¥Ì…Ý…¥Ñ¥¹œ™¥¹…°±½¬¸œô¤ì(€€€€€½¹ÍÐ…Ñ…±½œ€ô•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•Èü¹™¥•±‘ÍM¹…ÁÍ¡½Ðñð…Ý…¥Ð•ÑQÉ…­•É…Ñ…±½œ¡‘ˆ¤ì(€€€€€½¹ÍÐÑÉ…­•È€ôÍ…¹¥Ñ¥é•¥±•QÉ…­•È¡É•Ä¹‰½‘äü¹™¥±•QÉ…­•È°…Ñ…±½œ¤ì(€€€€€½¹ÍÐ½µµ•¹Ñ¥•±‘Ì€ô½µµ•¹ÑÕ‘¥Ð¡•á¥ÍÑ¥¹œ¹™¥±•QÉ…­•Èñðíô°ÑÉ…­•È¹½µµ•¹ÑÌ°É•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°ñð¹Õ±°¤ì(€€€€€½¹ÍÐÍÕ‰µ¥Ð€ô…Ñ¥½¸€ôôô€ÍÕ‰µ¥Ðœì(€€€€€¥˜€¡ÍÕ‰µ¥Ð€˜˜€ …™¥±•QÉ…­•É½µÁ±•Ñ”¡ÑÉ…­•È°…Ñ…±½œ¤ñð€…Ù…±¥‘…Ñ”¡½¹™¥Éµ…Ñ¥½¹…Ñ”¤ñð€…½¹™¥Éµ…Ñ¥½¹…Ñ”¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€½µÁ±•Ñ”•Ù•Éä¡•­±¥ÍÐ¥Ñ•´…¹•¹Ñ•ÈÑ¡”½¹™¥Éµ…Ñ¥½¸‘…Ñ”‰•™½É”½¹™¥Éµ¥¹œ¸œô¤ì(€€€€€½¹ÍÐ™¥±•QÉ…­•È€ôì€¸¸¹ÑÉ…­•È°€¸¸¹½µµ•¹Ñ¥•±‘Ì°™¥•±‘ÍM¹…ÁÍ¡½Ðè…Ñ…±½œ°½¹™¥Éµ…Ñ¥½¹…Ñ”èÍÕ‰µ¥Ð€ü½¹™¥Éµ…Ñ¥½¹…Ñ”€è€œœ°ÍÕ‰µ¥ÑÑ•‘ÐèÍÕ‰µ¥Ð€ü¹•Ü…Ñ” ¤€è¹Õ±°°ÍÕ‰µ¥ÑÑ•‘	äèÍÕ‰µ¥Ð€üÉ•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°€è¹Õ±°°™¥¹…±1½­•‘Ðè¹Õ±°°™¥¹…±1½­•‘	äè¹Õ±°ôì(€€€€€…Ý…¥Ð½±±•Ñ¥½¸¹ÕÁ‘…Ñ•=¹”¡ì•µÁ±½å••%ô°ì€‘Í•Ðèì™¥±•QÉ…­•È°ÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤°ÕÁ‘…Ñ•‘	äèÉ•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°ñð¹Õ±°ôô°ìÕÁÍ•ÉÐèÑÉÕ”ô¤ì(€€€€€É•ÑÕÉ¸É•Ì¹©Í½¸¡ì™¥±•QÉ…­•Èô¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì(€€€€€½¹Í½±”¹•ÉÉ½È U¹…‰±”Ñ¼Í…Ù”Q•Éµ¥¹…Ñ¥½¸¥±”QÉ…­•Èèœ°•ÉÉ½È¤ì(€€€€€É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÔÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡”Q•Éµ¥¹…Ñ¥½¸¥±”QÉ…­•È½Õ±¹½Ð‰”Í…Ù•¸œô¤ì(€€€ô™¥¹…±±äì…Ý…¥Ð±¥•¹Ð¹±½Í” ¤ìô(€ô¤ì(4(€É½ÕÑ•È¹ÁÕÐ œ½Ñ•Éµ¥¹…Ñ¥½¹Ì¼é•µÁ±½å••%½¡•­Ìœ°…Íå¹Œ€¡É•Ä°É•Ì¤€ôøì(€€€½¹ÍÐ•µÁ±½å••%€ôÉ•Ä¹Á…É…µÌ¹•µÁ±½å••%ì4(€€€½¹ÍÐ…Ñ¥½¸€ô±•…¸¡É•Ä¹‰½‘äü¹…Ñ¥½¸¤¹Ñ½1½Ý•É…Í” ¤ì4(€€€¥˜€ …=‰©•Ñ%¹¥ÍY…±¥¡•µÁ±½å••%¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€%¹Ù…±¥•µÁ±½å•”¸œô¤ì4(€€€½¹ÍÐ™¥•±‘Í	åÑ¥½¸€ôì4(€€€€€€Á…åÉ½±°µ¡•¬œèlÁ…åÉ½±±¡•­•‘Ðœ°€Á…åÉ½±±¡•­•‘	ät°4(€€€€€€Á…åÉ½±°µ™¥¹…°µÉ•Ù¥•ÜœèlÁ…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ðœ°€Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	ät°4(€€€€€€Á…åÉ½±°µ™¥¹…°µÉ•Ù¥•ÜµÕ¹‘¼œèlÁ…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ðœ°€Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	ät°(€€€€€€™½±±½ÜµÕÀµ¡•¬œèl™½±±½ÝUÁ¡•­•‘Ðœ°€™½±±½ÝUÁ¡•­•‘	ät°(€€€€€€™½±±½ÜµÕÀµ™¥¹…°µÉ•Ù¥•Üœèl™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘Ðœ°€™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘	ät°(€€€€€€¥¹ÍÕÉ…¹”µ½‰É„µ¡•¬œèl¥¹ÍÕÉ…¹•½‰É…¡•­•‘Ðœ°€¥¹ÍÕÉ…¹•½‰É…¡•­•‘	ät°4(€€€€€€É•Ñ¥É•µ•¹Ðµ¡•¬œèlÉ•Ñ¥É•µ•¹Ñ¡•­•‘Ðœ°€É•Ñ¥É•µ•¹Ñ¡•­•‘	ät°4(€€€ôì4(€€€½¹ÍÐ™¥•±‘Ì€ô™¥•±‘Í	åÑ¥½¹m…Ñ¥½¹tì4(€€€¥˜€ …™¥•±‘Ì¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€%¹Ù…±¥É•Ù¥•Ü…Ñ¥½¸¸œô¤ì4(€€€½¹ÍÐÉ•Ù¥•Ý•Éµ…¥°€ô±•…¸¡É•Ä¹…‘µ¥¹M•ÍÍ¥½¸ü¹•µ…¥°¤¹Ñ½1½Ý•É…Í” ¤ì4(€€€¥˜€¡lÁ…åÉ½±°µ™¥¹…°µÉ•Ù¥•Üœ°€Á…åÉ½±°µ™¥¹…°µÉ•Ù¥•ÜµÕ¹‘¼œ°€™½±±½ÜµÕÀµ™¥¹…°µÉ•Ù¥•Üt¹¥¹±Õ‘•Ì¡…Ñ¥½¸¤€˜˜É•Ù¥•Ý•Éµ…¥°€„ôô™¥¹…±I•Ù¥•Ý•Éµ…¥°¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÌ¤¹©Í½¸¡ì•ÉÉ½Èè€=¹±äÑ¡”…ÕÑ¡½É¥é•ÕÁÁ•Èµ±•Ù•°µ…¹…•È…¸Á•É™½É´™¥¹…°É•Ù¥•Ü¸œô¤ì(€€€½¹ÍÐ±¥•¹Ð€ôÉ•…Ñ•±¥•¹Ð ¤ì4(€€€ÑÉäì4(€€€€€…Ý…¥Ð±¥•¹Ð¹½¹¹•Ð ¤ì4(€€€€€½¹ÍÐ½±±•Ñ¥½¸€ô±¥•¹Ð¹‘ˆ¡‘…Ñ…‰…Í•9…µ”¤¹½±±•Ñ¥½¸ •µÁ±½å••}¡É}Ñ•Éµ¥¹…Ñ¥½¸œ¤ì4(€€€€€½¹ÍÐ•á¥ÍÑ¥¹œ€ô…Ý…¥Ð½±±•Ñ¥½¸¹™¥¹‘=¹”¡ì•µÁ±½å••%ô¤ì4(€€€€€¥˜€ …•á¥ÍÑ¥¹œü¹™¥¹…±A…åÉ½±±…Ñ”¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€½µÁ±•Ñ”Q•Éµ¥¹…Ñ¥½¸•Ñ…¥±Ì‰•™½É”Ñ…­¥¹œ…Ñ¥½¸¸œô¤ì4(€€€€€¥˜€¡…Ñ¥½¸€ôôô€Á…åÉ½±°µ™¥¹…°µÉ•Ù¥•Üœ€˜˜€…•á¥ÍÑ¥¹œ¹Á…åÉ½±±¡•­•‘Ð¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€A…åÉ½±°¡•¬µÕÍÐ‰”½µÁ±•Ñ•™¥ÉÍÐ¸œô¤ì(€€€€€¥˜€¡…Ñ¥½¸€ôôô€™½±±½ÜµÕÀµ¡•¬œ€˜˜€ …•á¥ÍÑ¥¹œ¹Á•¹‘¥¹%ÍÍÕ•Ìñð€…•á¥ÍÑ¥¹œ¹Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ð¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€¥¹…°A…äI•Ù¥•ÜµÕÍÐ‰”½µÁ±•Ñ•‰•™½É”¡•­¥¹œ™½±±½ÜµÕÀ¥ÍÍÕ•Ì¸œô¤ì(€€€€€¥˜€¡…Ñ¥½¸€ôôô€™½±±½ÜµÕÀµ™¥¹…°µÉ•Ù¥•Üœ€˜˜€ …•á¥ÍÑ¥¹œ¹Á•¹‘¥¹%ÍÍÕ•Ìñð€…•á¥ÍÑ¥¹œ¹™½±±½ÝUÁ¡•­•‘Ð¤¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€½±±½ÜµÕÀ%ÍÍÕ•Ì¡•¬µÕÍÐ‰”½µÁ±•Ñ•™¥ÉÍÐ¸œô¤ì(€€€€€¥˜€¡…Ñ¥½¸€ôôô€Á…åÉ½±°µ™¥¹…°µÉ•Ù¥•ÜµÕ¹‘¼œ¤ì4(€€€€€€€…Ý…¥Ð½±±•Ñ¥½¸¹ÕÁ‘…Ñ•=¹”¡ì•µÁ±½å••%ô°ì€‘Õ¹Í•ÐèìÁ…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ðè€œœ°Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	äè€œœô°€‘Í•ÐèìÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤°ÕÁ‘…Ñ•‘	äèÉ•Ù¥•Ý•Éµ…¥°ôô¤ì4(€€€€€€€É•ÑÕÉ¸É•Ì¹©Í½¸¡ìÁ…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ðè¹Õ±°°Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	äè€œœô¤ì4(€€€€€ô4(€€€€€¥˜€¡•á¥ÍÑ¥¹œü¹m™¥•±‘ÍlÁut¤É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÐÀä¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡¥Ì…Ñ¥½¸¡…Ì…±É•…‘ä‰••¸½µÁ±•Ñ•¸œô¤ì4(€€€€€½¹ÍÐÙ…±Õ•Ì€ôìm™¥•±‘ÍlÁutè¹•Ü…Ñ” ¤°m™¥•±‘ÍlÅutèÉ•Ù¥•Ý•Éµ…¥°°ÕÁ‘…Ñ•‘Ðè¹•Ü…Ñ” ¤°ÕÁ‘…Ñ•‘	äèÉ•Ù¥•Ý•Éµ…¥°ôì4(€€€€€…Ý…¥Ð½±±•Ñ¥½¸¹ÕÁ‘…Ñ•=¹”¡ì•µÁ±½å••%ô°ì€‘Í•ÐèÙ…±Õ•Ìô°ìÕÁÍ•ÉÐèÑÉÕ”ô¤ì4(€€€€€É•ÑÕÉ¸É•Ì¹©Í½¸¡Ù…±Õ•Ì¤ì4(€€€ô…Ñ €¡•ÉÉ½È¤ì4(€€€€€½¹Í½±”¹•ÉÉ½È U¹…‰±”Ñ¼Í…Ù”Ñ•Éµ¥¹…Ñ¥½¸…Ñ¥½¸èœ°•ÉÉ½È¤ì4(€€€€€É•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÔÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€Q•Éµ¥¹…Ñ¥½¸…Ñ¥½¸½Õ±¹½Ð‰”Í…Ù•¸œô¤ì4(€€€ô™¥¹…±±äì…Ý…¥Ð±¥•¹Ð¹±½Í” ¤ìô4(€ô¤ì((€…Íå¹Œ™Õ¹Ñ¥½¸Ñ•Éµ¥¹…Ñ¥½¹I•Á½ÉÑI½ÝÌ¡‘ˆ¤ì(€€€½¹ÍÐ•µÁ±½å••Ì€ô…Ý…¥Ð‘ˆ¹½±±•Ñ¥½¸ •µÁ±½å••Ìœ¤¹™¥¹¡ì€‘½Èèmì€A½Í¥Ñ¥½¸MÑ…ÑÕÌœè€½yÑ•Éµ¥¹…Ñ•½¤ô°ì€Q•Éµ¥¹…Ñ¥½¸…Ñ”œèì€‘•á¥ÍÑÌèÑÉÕ”°€‘¹¥¸èlœœ°¹Õ±±tôõtô¤¹Ñ½ÉÉ…ä ¤ì(€€€½¹ÍÐ¥‘Ì€ô•µÁ±½å••Ì¹µ…À¡•µÁ±½å•”€ôøMÑÉ¥¹œ¡•µÁ±½å•”¹}¥¤¤ì(€€€½¹ÍÐÉ•½É‘Ì€ô¥‘Ì¹±•¹Ñ €ü…Ý…¥Ð‘ˆ¹½±±•Ñ¥½¸ •µÁ±½å••}¡É}Ñ•Éµ¥¹…Ñ¥½¸œ¤¹™¥¹¡ì•µÁ±½å••%èì€‘¥¸è¥‘Ìôô¤¹Ñ½ÉÉ…ä ¤€èmtì(€€€½¹ÍÐ‰å%€ô¹•Ü5…À¡É•½É‘Ì¹µ…À¡É•½É€ôømMÑÉ¥¹œ¡É•½É¹•µÁ±½å••%¤°É•½É‘t¤¤ì(€€€É•ÑÕÉ¸•µÁ±½å••Ì¹µ…À¡•µÁ±½å•”€ôø€¡ì•µÁ±½å•”°É•½Éè‰å%¹•Ð¡MÑÉ¥¹œ¡•µÁ±½å•”¹}¥¤¤ñðíôô¤¤ì(€ô((€É½ÕÑ•È¹•Ð œ½Ñ•Éµ¥¹…Ñ¥½¹Ì½É•Á½ÉÑÌ½™¥±”µÑÉ…­•È¹á±Íàœ°…Íå¹Œ€¡}É•Ä°É•Ì¤€ôøì(€€€½¹ÍÐ±¥•¹Ð€ôÉ•…Ñ•±¥•¹Ð ¤ì(€€€ÑÉäì(€€€€€…Ý…¥Ð±¥•¹Ð¹½¹¹•Ð ¤ì½¹ÍÐ‘ˆ€ô±¥•¹Ð¹‘ˆ¡‘…Ñ…‰…Í•9…µ”¤ì½¹ÍÐÉ½ÝÌ€ô…Ý…¥ÐÑ•Éµ¥¹…Ñ¥½¹I•Á½ÉÑI½ÝÌ¡‘ˆ¤ì(€€€€€½¹ÍÐÝ½É­‰½½¬€ô¹•Üá•±)L¹]½É­‰½½¬ ¤ì½¹ÍÐÍ¡••Ð€ôÝ½É­‰½½¬¹…‘‘]½É­Í¡••Ð Q•Éµ¥¹…Ñ¥½¸¥±”QÉ…­•ÉÌœ¤ì(€€€€€½¹ÍÐ…Ñ…±½œ€ô…Ý…¥Ð•ÑQÉ…­•É…Ñ…±½œ¡‘ˆ°ÑÉÕ”¤ì(€€€€€Í¡••Ð¹½±Õµ¹Ì€ômì¡•…‘•Èè€µÁ±½å•”œ°­•äè€¹…µ”œ°Ý¥‘Ñ è€Èàô°ì¡•…‘•Èè€Q•Éµ¥¹…Ñ¥½¸…Ñ”œ°­•äè€Ñ•Éµ¥¹…Ñ¥½¹…Ñ”œ°Ý¥‘Ñ è€Äàô°ì¡•…‘•Èè€µÁ±½å•”½±‘•Èœ°­•äè€™½±‘•Èœ°Ý¥‘Ñ è€ÐÔô°€¸¸¹…Ñ…±½œ¹µ…À¡™¥•±€ôø€¡ì¡•…‘•Èè™¥•±¹±…‰•°°­•äè™|‘í™¥•±¹¥‘õ€°Ý¥‘Ñ è€ÈÐô¤¤°ì¡•…‘•Èè€½µµ•¹ÑÌœ°­•äè€½µµ•¹ÑÌœ°Ý¥‘Ñ è€ÐÔô°ì¡•…‘•Èè€‘µ¥¸¡•­•	äœ°­•äè€…‘µ¥¸œ°Ý¥‘Ñ è€ÌÀô°ì¡•…‘•Èè€¥¹…°I•Ù¥•Ý•	äœ°­•äè€™¥¹…°œ°Ý¥‘Ñ è€ÌÀô°ì¡•…‘•Èè€MÑ…ÑÕÌœ°­•äè€ÍÑ…ÑÕÌœ°Ý¥‘Ñ è€ÈÀõtì(€€€€€É½ÝÌ¹™½É…  ¡ì•µÁ±½å•”°É•½Éô¤€ôøì½¹ÍÐÑÉ…­•È€ôÉ•½É¹™¥±•QÉ…­•Èñðíôì½¹ÍÐÉ½Ü€ôì¹…µ”èm±•…¸¡•µÁ±½å••l¥ÉÍÐ9…µ”t¤°±•…¸¡•µÁ±½å••l1…ÍÐ9…µ”t¥t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œ€œ¤°Ñ•Éµ¥¹…Ñ¥½¹…Ñ”è±•…¸¡•µÁ±½å••lQ•Éµ¥¹…Ñ¥½¸…Ñ”t¤°™½±‘•Èè±•…¸¡É•½É¹•µÁ±½å••½±‘•ÉUÉ°¤°½µµ•¹ÑÌè±•…¸¡ÑÉ…­•È¹½µµ•¹ÑÌ¤°…‘µ¥¸è±•…¸¡ÑÉ…­•È¹ÍÕ‰µ¥ÑÑ•‘	ä¤°™¥¹…°è±•…¸¡ÑÉ…­•È¹™¥¹…±1½­•‘	ä¤°ÍÑ…ÑÕÌèÑÉ…­•È¹™¥¹…±1½­•‘Ð€ü€¥¹…°I•Ù¥•Ý•œ€èÑÉ…­•È¹ÍÕ‰µ¥ÑÑ•‘Ð€ü€‘µ¥¸¡•­•œ€è€%¸AÉ½•ÍÌœôì…Ñ…±½œ¹™½É… ¡™¥•±€ôøìÉ½Ým™|‘í™¥•±¹¥‘õt€ô±•…¸¡ÑÉ…­•È¹É•ÍÁ½¹Í•Ìü¹m™¥•±¹¥‘t¤ìô¤ìÍ¡••Ð¹…‘‘I½Ü¡É½Ü¤ìô¤ì(€€€€€Í¡••Ð¹•ÑI½Ü Ä¤¹™½¹Ð€ôì‰½±èÑÉÕ”ôìÉ•ÑÕÉ¸…Ý…¥ÐÍ•¹‘]½É­‰½½¬¡É•Ì°Ý½É­‰½½¬°Q•Éµ¥¹…Ñ¥½¹}¥±•}QÉ…­•ÉÍ|‘í¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°€ÄÀ¥ô¹á±Íá€¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì½¹Í½±”¹•ÉÉ½È U¹…‰±”Ñ¼É•…Ñ”Ñ•Éµ¥¹…Ñ¥½¸ÑÉ…­•ÈÉ•Á½ÉÐèœ°•ÉÉ½È¤ìÉ•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÔÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡”Ñ•Éµ¥¹…Ñ¥½¸ÑÉ…­•ÈÉ•Á½ÉÐ½Õ±¹½Ð‰”É•…Ñ•¸œô¤ìô™¥¹…±±äì…Ý…¥Ð±¥•¹Ð¹±½Í” ¤ìô(€ô¤ì((€É½ÕÑ•È¹•Ð œ½Ñ•Éµ¥¹…Ñ¥½¹Ì½É•Á½ÉÑÌ½Ñ…Í­Ì¹á±Íàœ°…Íå¹Œ€¡}É•Ä°É•Ì¤€ôøì(€€€½¹ÍÐ±¥•¹Ð€ôÉ•…Ñ•±¥•¹Ð ¤ì(€€€ÑÉäì(€€€€€…Ý…¥Ð±¥•¹Ð¹½¹¹•Ð ¤ì½¹ÍÐÉ½ÝÌ€ô…Ý…¥ÐÑ•Éµ¥¹…Ñ¥½¹I•Á½ÉÑI½ÝÌ¡±¥•¹Ð¹‘ˆ¡‘…Ñ…‰…Í•9…µ”¤¤ì½¹ÍÐÝ½É­‰½½¬€ô¹•Üá•±)L¹]½É­‰½½¬ ¤ì½¹ÍÐÍ¡••Ð€ôÝ½É­‰½½¬¹…‘‘]½É­Í¡••Ð Q•Éµ¥¹…Ñ¥½¸Q…Í­Ìœ¤ì(€€€€€Í¡••Ð¹½±Õµ¹Ì€ômì¡•…‘•Èè€µÁ±½å•”œ°­•äè€¹…µ”œ°Ý¥‘Ñ è€Èàô°ì¡•…‘•Èè€Q•Éµ¥¹…Ñ¥½¸…Ñ”œ°­•äè€Ñ•Éµ¥¹…Ñ¥½¹…Ñ”œ°Ý¥‘Ñ è€Äàô°ì¡•…‘•Èè€Q…Í¬œ°­•äè€Ñ…Í¬œ°Ý¥‘Ñ è€Èàô°ì¡•…‘•Èè€Q…Í¬…Ñ”œ°­•äè€‘…Ñ”œ°Ý¥‘Ñ è€Äàô°ì¡•…‘•Èè€MÑ…ÑÕÌœ°­•äè€ÍÑ…ÑÕÌœ°Ý¥‘Ñ è€ÈÐô°ì¡•…‘•Èè€¡•­•	äœ°­•äè€¡•­•‘	äœ°Ý¥‘Ñ è€ÌÀô°ì¡•…‘•Èè€¥¹…°I•Ù¥•Ý•	äœ°­•äè€™¥¹…±	äœ°Ý¥‘Ñ è€ÌÀô°ì¡•…‘•Èè€9½Ñ•Ìœ°­•äè€¹½Ñ•Ìœ°Ý¥‘Ñ è€ÐÔõtì(€€€€€É½ÝÌ¹™½É…  ¡ì•µÁ±½å•”°É•½Éô¤€ôøì½¹ÍÐ‰…Í”€ôì¹…µ”èm±•…¸¡•µÁ±½å••l¥ÉÍÐ9…µ”t¤°±•…¸¡•µÁ±½å••l1…ÍÐ9…µ”t¥t¹™¥±Ñ•È¡	½½±•…¸¤¹©½¥¸ œ€œ¤°Ñ•Éµ¥¹…Ñ¥½¹…Ñ”è±•…¸¡•µÁ±½å••lQ•Éµ¥¹…Ñ¥½¸…Ñ”t¤ôì½¹ÍÐ…‘€ô€¡Ñ…Í¬°‘…Ñ”°¡•­•°™¥¹…°°¹½Ñ•Ì€ô€œœ¤€ôøÍ¡••Ð¹…‘‘I½Ü¡ì€¸¸¹‰…Í”°Ñ…Í¬°‘…Ñ”è±•…¸¡‘…Ñ”¤°ÍÑ…ÑÕÌè™¥¹…°€ü€¥¹¥Í¡•œ€è¡•­•€ü€%¸AÉ½•ÍÌ€´¥¹…°I•Ù¥•Ü9••‘•œ€è€U¹™¥¹¥Í¡•œ°¡•­•‘	äè±•…¸¡¡•­•ü¹‰ä¤°™¥¹…±	äè±•…¸¡™¥¹…°ü¹‰ä¤°¹½Ñ•Ìô¤ì…‘ ¥¹…°A…äœ°É•½É¹™¥¹…±A…åÉ½±±…Ñ”°É•½É¹Á…åÉ½±±¡•­•‘Ð€˜˜ì‰äèÉ•½É¹Á…åÉ½±±¡•­•‘	äô°É•½É¹Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘Ð€˜˜ì‰äèÉ•½É¹Á…åÉ½±±¥¹…±I•Ù¥•Ý•‘	äô¤ì¥˜€¡É•½É¹Á•¹‘¥¹%ÍÍÕ•Ì¤…‘ A…åÉ½±°½±±½ÜµÕÀ%ÍÍÕ•Ìœ°É•½É¹Á…åÉ½±±½±±½ÝQ¡É½Õ¡U¹Ñ¥°°É•½É¹™½±±½ÝUÁ¡•­•‘Ð€˜˜ì‰äèÉ•½É¹™½±±½ÝUÁ¡•­•‘	äô°É•½É¹™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘Ð€˜˜ì‰äèÉ•½É¹™½±±½ÝUÁ¥¹…±I•Ù¥•Ý•‘	äô°±•…¸¡É•½É¹Á•¹‘¥¹%ÍÍÕ•Í9½Ñ•Ì¤¤ì¥˜€¡É•½É¹¥¹ÍÕÉ…¹•A…ÉÑ¥¥Á…Ñ¥½¸€ôôô€Á…ÉÑ¥¥Á…Ñ•œ¤…‘ %¹ÍÕÉ…¹”€˜=	Iœ°É•½É¹¥¹ÍÕÉ…¹•¹‘¥¹…Ñ”°É•½É¹¥¹ÍÕÉ…¹•½‰É…¡•­•‘Ð€˜˜ì‰äèÉ•½É¹¥¹ÍÕÉ…¹•½‰É…¡•­•‘	äô°É•½É¹¥¹ÍÕÉ…¹•½‰É…¡•­•‘Ð€˜˜ì‰äèÉ•½É¹¥¹ÍÕÉ…¹•½‰É…¡•­•‘	äô¤ì¥˜€¡É•½É¹É•Ñ¥É•µ•¹ÑA…ÉÑ¥¥Á…Ñ¥½¸€ôôô€Á…ÉÑ¥¥Á…Ñ•œ¤…‘ œÐÀÄ¡¬¤œ°É•½É¹É•Ñ¥É•µ•¹Ñ¹‘¥¹…Ñ”°É•½É¹É•Ñ¥É•µ•¹Ñ¡•­•‘Ð€˜˜ì‰äèÉ•½É¹É•Ñ¥É•µ•¹Ñ¡•­•‘	äô°É•½É¹É•Ñ¥É•µ•¹Ñ¡•­•‘Ð€˜˜ì‰äèÉ•½É¹É•Ñ¥É•µ•¹Ñ¡•­•‘	äô¤ìô¤ì(€€€€€Í¡••Ð¹•ÑI½Ü Ä¤¹™½¹Ð€ôì‰½±èÑÉÕ”ôìÉ•ÑÕÉ¸…Ý…¥ÐÍ•¹‘]½É­‰½½¬¡É•Ì°Ý½É­‰½½¬°Q•Éµ¥¹…Ñ¥½¹}±±}Q…Í­Í|‘í¹•Ü…Ñ” ¤¹Ñ½%M=MÑÉ¥¹œ ¤¹Í±¥” À°€ÄÀ¥ô¹á±Íá€¤ì(€€€ô…Ñ €¡•ÉÉ½È¤ì½¹Í½±”¹•ÉÉ½È U¹…‰±”Ñ¼É•…Ñ”Ñ•Éµ¥¹…Ñ¥½¸Ñ…Í¬É•Á½ÉÐèœ°•ÉÉ½È¤ìÉ•ÑÕÉ¸É•Ì¹ÍÑ…ÑÕÌ ÔÀÀ¤¹©Í½¸¡ì•ÉÉ½Èè€Q¡”Ñ•Éµ¥¹…Ñ¥½¸Ñ…Í¬É•Á½ÉÐ½Õ±¹½Ð‰”É•…Ñ•¸œô¤ìô™¥¹…±±äì…Ý…¥Ð±¥•¹Ð¹±½Í” ¤ìô(€ô¤ì(4(€É•ÑÕÉ¸É½ÕÑ•Èì4)ô4(4)µ½‘Õ±”¹•áÁ½ÉÑÌ€ôìÉ•…Ñ•!ÉA±…Ñ™½ÉµI½ÕÑ•Èôì4(