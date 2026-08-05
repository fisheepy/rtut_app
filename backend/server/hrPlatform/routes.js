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

  async function getTrackerCatalog(db, includeInactive = false, collectionName = 'hr_file_tracker_fields') {
    const collection = db.collection(collectionName);
    const stored = await collection.find({ deleted: { $ne: true } }).sort({ order: 1, label: 1 }).toArray();
    if (stored.length) return stored.map(({ _id, ...field }) => field).filter(field => includeInactive || field.active);
    if (await collection.countDocuments({}) > 0) return [];
    return DEFAULT_FILE_TRACKER_FIELDS.filter(field => includeInactive || field.active);
  }

  async function ensureTrackerCatalog(db, collectionName = 'hr_file_tracker_fields') {
    const collection = db.collection(collectionName);
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
      const completedRowsFor = (e×xîÚ$z{-®éÜj×²ââæ&6RÂF6²ÂFFS¢6ÆVâ†FFR’Â7FGW3¢f–æÂòtf–æ—6†VBr¢6†V6¶VBòt–â&ö6W72Òf–æÂ&Wf–WræVVFVBr¢uVæf–æ—6†VBrÂ6†V6¶VD'“¢6ÆVâ†6†V6¶VCòæ'’’Âf–æÄ'“¢6ÆVâ†f–æÃòæ'’’Âæ÷FW2Ò“²FB‚tf–æÂ’rÂ&V6÷&Bæf–æÅ—&öÆÄFFRÂ&V6÷&Bç—&öÆÄ6†V6¶VDBbb²'“¢&V6÷&Bç—&öÆÄ6†V6¶VD'’ÒÂ&V6÷&Bç—&öÆÄf–æÅ&Wf–WvVDBbb²'“¢&V6÷&Bç—&öÆÄf–æÅ&Wf–WvVD'’Ò“²–b‡&V6÷&BçVæF–æt—77VW2’FB‚u—&öÆÂföÆÆ÷r×W—77VW2rÂ&V6÷&Bç—&öÆÄföÆÆ÷uF‡&÷Vv…VçF–ÂÂ&V6÷&BæföÆÆ÷uW6†V6¶VDBbb²'“¢&V6÷&BæföÆÆ÷uW6†V6¶VD'’ÒÂ&V6÷&BæföÆÆ÷uWf–æÅ&Wf–WvVDBbb²'“¢&V6÷&BæföÆÆ÷uWf–æÅ&Wf–WvVD'’ÒÂ6ÆVâ‡&V6÷&BçVæF–æt—77VW4æ÷FW2’“²–b‡&V6÷&Bæ–ç7W&æ6U'F–6—F–öâÓÓÒw'F–6—FVBr’FB‚t–ç7W&æ6Rb4ô%$rÂ&V6÷&Bæ–ç7W&æ6TVæF–ætFFRÂ&V6÷&Bæ–ç7W&æ6T6ö'&6†V6¶VDBbb²'“¢&V6÷&Bæ–ç7W&æ6T6ö'&6†V6¶VD'’ÒÂ&V6÷&Bæ–ç7W&æ6T6ö'&6†V6¶VDBbb²'“¢&V6÷&Bæ–ç7W&æ6T6ö'&6†V6¶VD'’Ò“²–b‡&V6÷&Bç&WF—&VÖVçE'F–6—F–öâÓÓÒw'F–6—FVBr’FB‚sC†²’rÂ&V6÷&Bç&WF—&VÖVçDVæF–ætFFRÂ&V6÷&Bç&WF—&VÖVçD6†V6¶VDBbb²'“¢&V6÷&Bç&WF—&VÖVçD6†V6¶VD'’ÒÂ&V6÷&Bç&WF—&VÖVçD6†V6¶VDBbb²'“¢&V6÷&Bç&WF—&VÖVçD6†V6¶VD'’Ò“²Ò“°¢6†VWBævWE&÷rƒ’æföçBÒ²&öÆC¢G'VRÓ²&WGW&âv—B6VæEv÷&¶&öö²‡&W2Âv÷&¶&öö²ÂFW&Ö–æF–öåôÆÅõF6·5òG¶æWrFFR‚’çFô•4õ7G&–ær‚’ç6Æ–6RƒÂ—Òç†Ç7†“°¢Ò6F6‚†W'&÷"’²6öç6öÆRæW'&÷"‚uVæ&ÆRFò7&VFRFW&Ö–æF–öâF6²&W÷'C¢rÂW'&÷"“²&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢uF†RFW&Ö–æF–öâF6²&W÷'B6÷VÆBæ÷B&R7&VFVBârÒ“²Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&÷WFW"ævWB‚röV×Æ÷–ÖVçBÖ6†ævW2rÂ7–æ2…÷&WÂ&W2’Óâ°¢6öç7B6Æ–VçBÒ7&VFT6Æ–VçB‚“°¢G'’°¢v—B6Æ–VçBæ6öææV7B‚“°¢6öç7B&V6÷&G2Òv—B6Æ–VçBæF"†FF&6TæÖR’æ6öÆÆV7F–öâ‚vV×Æ÷–VUö‡%öV×Æ÷–ÖVçEö6†ævRr¢æf–æB‡·Ò’ç6÷'B‡²VffV7F—fTFFS¢Â7&VFVDC¢Ò’çFô'&’‚“°¢&WGW&â&W2æ§6öâ‡&V6÷&G2æÖ‡&V6÷&BÓâ‡°¢–C¢7G&–ær‡&V6÷&Båö–B’ÂV×Æ÷–VT–C¢6ÆVâ‡&V6÷&BæV×Æ÷–VT–B’ÂV×Æ÷–VTæÖS¢6ÆVâ‡&V6÷&BæV×Æ÷–VTæÖR’À¢V×Æ÷–VTVÖ–Ã¢6ÆVâ‡&V6÷&BæV×Æ÷–VTVÖ–Â’ÂVffV7F—fTFFS¢6ÆVâ‡&V6÷&BæVffV7F—fTFFR’Â&V6öã¢6ÆVâ‡&V6÷&Bç&V6öâ’À¢V×Æ÷–VTföÆFW%W&Ã¢6ÆVâ‡&V6÷&BæV×Æ÷–VTföÆFW%W&Â’ÂföÆÆ÷uW—77VW3¢&V6÷&BæföÆÆ÷uW—77VW2ÓÓÒG'VRÀ¢föÆÆ÷uWæ÷FW3¢6ÆVâ‡&V6÷&BæföÆÆ÷uWæ÷FW2’ÂföÆÆ÷uWVçF–Ã¢6ÆVâ‡&V6÷&BæföÆÆ÷uWVçF–Â’À¢6†ævW3¢'&’æ—4'&’‡&V6÷&Bæ6†ævW2’ò&V6÷&Bæ6†ævW2¢µÒÂF6·3¢²âââ‡&V6÷&BçF6·2ÇÂ·Ò’ÂföÆÆ÷uW¢&V6÷&BçF6·3òæföÆÆ÷uWÇÂ&V6÷&BçF6·3òæ÷F†W"ÇÂ·ÒÒÀ¢7&VFVDC¢&V6÷&Bæ7&VFVDBÇÂçVÆÂÂ7&VFVD'“¢6ÆVâ‡&V6÷&Bæ7&VFVD'’’À¢Ò’’“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚uVæ&ÆRFòÆöBV×Æ÷–ÖVçB6†ævW3¢rÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢tV×Æ÷–ÖVçB6†ævR&V6÷&G26÷VÆBæ÷B&RÆöFVBârÒ“°¢Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&÷WFW"ævWB‚röV×Æ÷–ÖVçBÖ6†ævW2÷&W÷'G2÷F6·2ç†Ç7‚rÂ7–æ2…÷&WÂ&W2’Óâ°¢6öç7B6Æ–VçBÒ7&VFT6Æ–VçB‚“°¢G'’°¢v—B6Æ–VçBæ6öææV7B‚“°¢6öç7B&V6÷&G2Òv—B6Æ–VçBæF"†FF&6TæÖR’æ6öÆÆV7F–öâ‚vV×Æ÷–VUö‡%öV×Æ÷–ÖVçEö6†ævRr’æf–æB‡·Ò’ç6÷'B‡²VffV7F—fTFFS¢Â7&VFVDC¢Ò’çFô'&’‚“°¢6öç7Bv÷&¶&öö²ÒæWrW†6VÄ¥2åv÷&¶&öö²‚“²6öç7B6†VWBÒv÷&¶&öö²æFEv÷&·6†VWB‚tV×Æ÷–ÖVçB6†ævRF6·2r“°¢6†VWBæ6öÇVÖç2Ò°¢²†VFW#¢tV×Æ÷–VRrÂ¶W“¢vV×Æ÷–VRrÂv–GFƒ¢#‚ÒÂ²†VFW#¢tVÖ–ÂrÂ¶W“¢vVÖ–ÂrÂv–GFƒ¢3"ÒÀ¢²†VFW#¢t6†ævRVffV7F—fRFFRrÂ¶W“¢vVffV7F—fTFFRrÂv–GFƒ¢#"ÒÂ²†VFW#¢t–æf÷&ÖF–öâ6†ævVBrÂ¶W“¢v6†ævW2rÂv–GFƒ¢SRÒÀ¢²†VFW#¢uF6²rÂ¶W“¢wF6²rÂv–GFƒ¢#‚ÒÂ²†VFW#¢uF6²FFRrÂ¶W“¢wF6´FFRrÂv–GFƒ¢‚ÒÀ¢²†VFW#¢u7FGW2rÂ¶W“¢w7FGW2rÂv–GFƒ¢#‚ÒÂ²†VFW#¢t6†V6¶VB'’rÂ¶W“¢v6†V6¶VD'’rÂv–GFƒ¢3ÒÀ¢²†VFW#¢tf–æÂ&Wf–WvVB'’rÂ¶W“¢vf–æÄ'’rÂv–GFƒ¢3ÒÂ²†VFW#¢tföÆÆ÷r×Wæ÷FW2rÂ¶W“¢væ÷FW2rÂv–GFƒ¢CRÒÀ¢Ó°¢6öç7B7FGW2Ò‡F6²Ò·ÒÂf–æÅ&WV—&VBÒfÇ6R’Óâf–æÅ&WV—&V@¢òF6²æf–æÅ&Wf–WvVDBòtf–æ—6†VBr¢F6²æ6†V6¶VDBòt–â&ö6W72Òf–æÂ&Wf–WræVVFVBr¢uVæf–æ—6†VBp¢¢‡F6²æ6†V6¶VDBÇÂF6²æ6ö×ÆWFVDB’òtf–æ—6†VBr¢uVæf–æ—6†VBs°¢&V6÷&G2æf÷$V6‚‡&V6÷&BÓâ°¢6öç7B&6RÒ²V×Æ÷–VS¢6ÆVâ‡&V6÷&BæV×Æ÷–VTæÖR’ÂVÖ–Ã¢6ÆVâ‡&V6÷&BæV×Æ÷–VTVÖ–Â’ÂVffV7F—fTFFS¢6ÆVâ‡&V6÷&BæVffV7F—fTFFR’Â6†ævW3¢‡&V6÷&Bæ6†ævW2ÇÂµÒ’æÖ†6†ævRÓâG¶6ÆVâ†6†ævRæf–VÆB—Ó¢G¶6ÆVâ†6†ævRæg&öÒ—ÒÓâG¶6ÆVâ†6†ævRçFò—Ö’æ¦ö–â‚s²r’Ó°¢6öç7BFBÒ‡F6²ÂF6´FFRÂfÇVRÒ·ÒÂf–æÅ&WV—&VBÒfÇ6RÂæ÷FW2Òrr’Óâ6†VWBæFE&÷r‡²ââæ&6RÂF6²ÂF6´FFS¢6ÆVâ‡F6´FFR’Â7FGW3¢7FGW2‡fÇVRÂf–æÅ&WV—&VB’Â6†V6¶VD'“¢6ÆVâ‡fÇVRæ6†V6¶VD'’ÇÂfÇVRæ6ö×ÆWFVD'’’Âf–æÄ'“¢6ÆVâ‡fÇVRæf–æÅ&Wf–WvVD'’’Âæ÷FW2Ò“°¢FB‚tV×Æ÷–VRf–ÆR&6·WrÂ&V6÷&BæVffV7F—fTFFRÂ&V6÷&BçF6·3òæf–ÆRÇÂ·ÒÂG'VR“°¢–b‡&V6÷&BçF6·3òç—&öÆÃòæÆ–6&ÆRÓÓÒG'VR’FB‚$æWr—&öÆÂw2—&öÆÂFFR"Â&V6÷&BçF6·2ç—&öÆÂæ7F–öäFFRÂ&V6÷&BçF6·2ç—&öÆÂÂG'VR“°¢–b‡&V6÷&BæföÆÆ÷uW—77VW2ÓÓÒG'VR’FB‚tföÆÆ÷r×W—77VW2rÂ&V6÷&BæföÆÆ÷uWVçF–ÂÂ&V6÷&BçF6·3òæföÆÆ÷uWÇÂ&V6÷&BçF6·3òæ÷F†W"ÇÂ·ÒÂG'VRÂ6ÆVâ‡&V6÷&BæföÆÆ÷uWæ÷FW2’“°¢–b‡&V6÷&BçF6·3òæ–ç7W&æ6SòæÆ–6&ÆRÓÓÒG'VR’FB‚t–ç7W&æ6R6†ævRrÂ&V6÷&BçF6·2æ–ç7W&æ6Ræ7F–öäFFRÂ&V6÷&BçF6·2æ–ç7W&æ6R“°¢–b‡&V6÷&BçF6·3òç&WF—&VÖVçCòæÆ–6&ÆRÓÓÒG'VR’FB‚sC†²’6†ævRrÂ&V6÷&BçF6·2ç&WF—&VÖVçBæ7F–öäFFRÂ&V6÷&BçF6·2ç&WF—&VÖVçB“°¢Ò“°¢7G–ÆU&W÷'E6†VWB‡6†VWB“²&WGW&âv—B6VæEv÷&¶&öö²‡&W2Âv÷&¶&öö²ÂV×Æ÷–ÖVçEô6†ævUôÆÅõF6·5òG¶æWrFFR‚’çFô•4õ7G&–ær‚’ç6Æ–6RƒÂ—Òç†Ç7†“°¢Ò6F6‚†W'&÷"’²6öç6öÆRæW'&÷"‚uVæ&ÆRFò7&VFRV×Æ÷–ÖVçB6†ævRF6²&W÷'C¢rÂW'&÷"“²&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢uF†RV×Æ÷–ÖVçB6†ævRF6²&W÷'B6÷VÆBæ÷B&R7&VFVBârÒ“²Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&÷WFW"çWB‚röV×Æ÷–ÖVçBÖ6†ævW2ó¦–B÷F6·2ó§F6²rÂ7–æ2‡&WÂ&W2’Óâ°¢6öç7B²–BÂF6²ÒÒ&Wç&×3°¢–b‚ö&¦V7D–Bæ—5fÆ–B†–B’ÇÂ²w—&öÆÂrÂv–ç7W&æ6RrÂw&WF—&VÖVçBrÂv÷F†W"uÒæ–æ6ÇVFW2‡F6²’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t–çfÆ–BV×Æ÷–ÖVçB6†ævRF6²ârÒ“°¢6öç7B6Æ–VçBÒ7&VFT6Æ–VçB‚“°¢G'’°¢v—B6Æ–VçBæ6öææV7B‚“°¢6öç7B6öÆÆV7F–öâÒ6Æ–VçBæF"†FF&6TæÖR’æ6öÆÆV7F–öâ‚vV×Æ÷–VUö‡%öV×Æ÷–ÖVçEö6†ævRr“°¢6öç7B&V6÷&BÒv—B6öÆÆV7F–öâæf–æDöæR‡²ö–C¢æWrö&¦V7D–B†–B’Ò“°¢–b‚&V6÷&CòçF6·3òå·F6µÓòç&WV—&VB’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢uF†—2F6²—2æ÷B&WV—&VBârÒ“°¢6öç7B6ö×ÆWFVDBÒæWrFFR‚“²6öç7B6ö×ÆWFVD'’Ò6ÆVâ‡&WæFÖ–å6W76–öãòæVÖ–Â’çFôÆ÷vW$66R‚“°¢v—B6öÆÆV7F–öâçWFFTöæR‡²ö–C¢&V6÷&Båö–BÒÂ²G6WC¢²¶F6·2âG·F6·Òæ6ö×ÆWFVDFÓ¢6ö×ÆWFVDBÂ¶F6·2âG·F6·Òæ6ö×ÆWFVD'–Ó¢6ö×ÆWFVD'’ÂWFFVDC¢6ö×ÆWFVDBÒÒ“°¢&WGW&â&W2æ§6öâ‡²6ö×ÆWFVDBÂ6ö×ÆWFVD'’Ò“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚uVæ&ÆRFò6ö×ÆWFRV×Æ÷–ÖVçB6†ævRF6³¢rÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢uF†RV×Æ÷–ÖVçB6†ævRF6²6÷VÆBæ÷B&R6ö×ÆWFVBârÒ“°¢Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&÷WFW"çWB‚röV×Æ÷–ÖVçBÖ6†ævW2ó¦–BöFWF–Ç2rÂ7–æ2‡&WÂ&W2’Óâ°¢6öç7B²–BÒÒ&Wç&×3°¢6öç7BfÇVW2Ò°¢VffV7F—fTFFS¢6ÆVâ‡&Wæ&öG“òæVffV7F—fTFFR’Â&V6öã¢6ÆVâ‡&Wæ&öG“òç&V6öâ’ÂV×Æ÷–VTföÆFW%W&Ã¢6ÆVâ‡&Wæ&öG“òæV×Æ÷–VTföÆFW%W&Â’À¢—&öÆÄÆ–6&ÆS¢&Wæ&öG“òç—&öÆÄÆ–6&ÆRÓÓÒG'VRÂ—&öÆÄ7F–öäFFS¢6ÆVâ‡&Wæ&öG“òç—&öÆÄ7F–öäFFR’À¢–ç7W&æ6TÆ–6&ÆS¢&Wæ&öG“òæ–ç7W&æ6TÆ–6&ÆRÓÓÒG'VRÂ–ç7W&æ6T7F–öäFFS¢6ÆVâ‡&Wæ&öG“òæ–ç7W&æ6T7F–öäFFR’À¢&WF—&VÖVçDÆ–6&ÆS¢&Wæ&öG“òç&WF—&VÖVçDÆ–6&ÆRÓÓÒG'VRÂ&WF—&VÖVçD7F–öäFFS¢6ÆVâ‡&Wæ&öG“òç&WF—&VÖVçD7F–öäFFR’À¢föÆÆ÷uW—77VW3¢&Wæ&öG“òæföÆÆ÷uW—77VW2ÓÓÒG'VRÂföÆÆ÷uWæ÷FW3¢6ÆVâ‡&Wæ&öG“òæföÆÆ÷uWæ÷FW2’ÂföÆÆ÷uWVçF–Ã¢6ÆVâ‡&Wæ&öG“òæföÆÆ÷uWVçF–Â’À¢Ó°¢–b‚ö&¦V7D–Bæ—5fÆ–B†–B’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t–çfÆ–BV×Æ÷–ÖVçB6†ævRârÒ“°¢–b‚fÇVW2æVffV7F—fTFFRÇÂfÆ–DFFR‡fÇVW2æVffV7F—fTFFR’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t6†ævRVffV7F—fRFFR—2&WV—&VBârÒ“°¢–b‚fÇVW2ç&V6öâ’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t6†ævR&V6öâòæ÷FW2&R&WV—&VBârÒ“°¢–b‚fÇVW2æV×Æ÷–VTföÆFW%W&ÂÇÂõæ‡GG3¥ÂõÂòö’çFW7B‡fÇVW2æV×Æ÷–VTföÆFW%W&Â’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t6V7W&RV×Æ÷–VRföÆFW"‡GG3¢òòÆ–æ²—2&WV—&VBârÒ“°¢–b‡fÇVW2ç—&öÆÄÆ–6&ÆRbb‚fÇVW2ç—&öÆÄ7F–öäFFRÇÂfÆ–DFFR‡fÇVW2ç—&öÆÄ7F–öäFFR’’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢tæWr—&öÆÂ6†ævRFFR—2&WV—&VBv†VâÆ–6&ÆRârÒ“°¢–b‡fÇVW2æ–ç7W&æ6TÆ–6&ÆRbb‚fÇVW2æ–ç7W&æ6T7F–öäFFRÇÂfÆ–DFFR‡fÇVW2æ–ç7W&æ6T7F–öäFFR’’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t–ç7W&æ6R6†ævRFFR—2&WV—&VBv†VâÆ–6&ÆRârÒ“°¢–b‡fÇVW2ç&WF—&VÖVçDÆ–6&ÆRbb‚fÇVW2ç&WF—&VÖVçD7F–öäFFRÇÂfÆ–DFFR‡fÇVW2ç&WF—&VÖVçD7F–öäFFR’’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢sC†²’6†ævRFFR—2&WV—&VBv†VâÆ–6&ÆRârÒ“°¢–b‡fÇVW2æföÆÆ÷uW—77VW2bb‚fÇVW2æföÆÆ÷uWVçF–ÂÇÂfÆ–DFFR‡fÇVW2æföÆÆ÷uWVçF–Â’ÇÂfÇVW2æföÆÆ÷uWæ÷FW2’’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢tföÆÆ÷r×WVçF–ÂæBföÆÆ÷r×Wæ÷FW2&R&WV—&VBv†VâföÆÆ÷r×W—77VW2W†—7BârÒ“°¢6öç7B6Æ–VçBÒ7&VFT6Æ–VçB‚“°¢G'’°¢v—B6Æ–VçBæ6öææV7B‚“²6öç7BWFFVDBÒæWrFFR‚“²6öç7BWFFVD'’Ò6ÆVâ‡&WæFÖ–å6W76–öãòæVÖ–Â’çFôÆ÷vW$66R‚“°¢6öç7B6öÆÆV7F–öâÒ6Æ–VçBæF"†FF&6TæÖR’æ6öÆÆV7F–öâ‚vV×Æ÷–VUö‡%öV×Æ÷–ÖVçEö6†ævRr“²6öç7BW†—7F–ærÒv—B6öÆÆV7F–öâæf–æDöæR‡²ö–C¢æWrö&¦V7D–B†–B’Ò“°¢–b‚W†—7F–ær’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²W'&÷#¢tV×Æ÷–ÖVçB6†ævRæ÷Bf÷VæBârÒ“°¢6öç7B6WBÒ°¢VffV7F—fTFFS¢fÇVW2æVffV7F—fTFFRÂ&V6öã¢fÇVW2ç&V6öâÂV×Æ÷–VTföÆFW%W&Ã¢fÇVW2æV×Æ÷–VTföÆFW%W&ÂÀ¢föÆÆ÷uW—77VW3¢fÇVW2æföÆÆ÷uW—77VW2ÂföÆÆ÷uWæ÷FW3¢fÇVW2æföÆÆ÷uW—77VW2òfÇVW2æföÆÆ÷uWæ÷FW2¢rrÂföÆÆ÷uWVçF–Ã¢fÇVW2æföÆÆ÷uW—77VW2òfÇVW2æföÆÆ÷uWVçF–Â¢rrÀ¢wF6·2æf–ÆRç&WV—&VBs¢G'VRÀ¢wF6·2ç—&öÆÂç&WV—&VBs¢fÇVW2ç—&öÆÄÆ–6&ÆRÂwF6·2ç—&öÆÂæÆ–6&ÆRs¢fÇVW2ç—&öÆÄÆ–6&ÆRÂwF6·2ç—&öÆÂæ7F–öäFFRs¢fÇVW2ç—&öÆÄÆ–6&ÆRòfÇVW2ç—&öÆÄ7F–öäFFR¢rrÀ¢wF6·2æ–ç7W&æ6Rç&WV—&VBs¢fÇVW2æ–ç7W&æ6TÆ–6&ÆRÂwF6·2æ–ç7W&æ6RæÆ–6&ÆRs¢fÇVW2æ–ç7W&æ6TÆ–6&ÆRÂwF6·2æ–ç7W&æ6Ræ7F–öäFFRs¢fÇVW2æ–ç7W&æ6TÆ–6&ÆRòfÇVW2æ–ç7W&æ6T7F–öäFFR¢rrÀ¢wF6·2ç&WF—&VÖVçBç&WV—&VBs¢fÇVW2ç&WF—&VÖVçDÆ–6&ÆRÂwF6·2ç&WF—&VÖVçBæÆ–6&ÆRs¢fÇVW2ç&WF—&VÖVçDÆ–6&ÆRÂwF6·2ç&WF—&VÖVçBæ7F–öäFFRs¢fÇVW2ç&WF—&VÖVçDÆ–6&ÆRòfÇVW2ç&WF—&VÖVçD7F–öäFFR¢rrÀ¢wF6·2æföÆÆ÷uWç&WV—&VBs¢fÇVW2æföÆÆ÷uW—77VW2ÂWFFVDBÂWFFVD'’À¢Ó°¢6öç7BVç6WBÒ·Ó°¢6öç7B&W6WBÒ‡F6²Âf–VÆG2’Óâf–VÆG2æf÷$V6‚†f–VÆBÓâ²Vç6WE¶F6·2âG·F6·ÒâG¶f–VÆGÖÒÒrs²Ò“°¢–b†6ÆVâ†W†—7F–æræV×Æ÷–VTföÆFW%W&Â’ÓÒfÇVW2æV×Æ÷–VTföÆFW%W&Â’&W6WB‚vf–ÆRrÂ²v6†V6¶VDBrÂv6†V6¶VD'’rÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’uÒ“°¢–b†W†—7F–ærçF6·3òç—&öÆÃòæÆ–6&ÆRÓÒfÇVW2ç—&öÆÄÆ–6&ÆRÇÂ6ÆVâ†W†—7F–ærçF6·3òç—&öÆÃòæ7F–öäFFR’ÓÒfÇVW2ç—&öÆÄ7F–öäFFR’&W6WB‚w—&öÆÂrÂ²v6†V6¶VDBrÂv6†V6¶VD'’rÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’rÂv6ö×ÆWFVDBrÂv6ö×ÆWFVD'’uÒ“°¢–b†W†—7F–ærçF6·3òæ–ç7W&æ6SòæÆ–6&ÆRÓÒfÇVW2æ–ç7W&æ6TÆ–6&ÆRÇÂ6ÆVâ†W†—7F–ærçF6·3òæ–ç7W&æ6Sòæ7F–öäFFR’ÓÒfÇVW2æ–ç7W&æ6T7F–öäFFR’&W6WB‚v–ç7W&æ6RrÂ²v6†V6¶VDBrÂv6†V6¶VD'’rÂv6ö×ÆWFVDBrÂv6ö×ÆWFVD'’uÒ“°¢–b†W†—7F–ærçF6·3òç&WF—&VÖVçCòæÆ–6&ÆRÓÒfÇVW2ç&WF—&VÖVçDÆ–6&ÆRÇÂ6ÆVâ†W†—7F–ærçF6·3òç&WF—&VÖVçCòæ7F–öäFFR’ÓÒfÇVW2ç&WF—&VÖVçD7F–öäFFR’&W6WB‚w&WF—&VÖVçBrÂ²v6†V6¶VDBrÂv6†V6¶VD'’rÂv6ö×ÆWFVDBrÂv6ö×ÆWFVD'’uÒ“°¢–b†W†—7F–æræföÆÆ÷uW—77VW2ÓÒfÇVW2æföÆÆ÷uW—77VW2ÇÂ6ÆVâ†W†—7F–æræföÆÆ÷uWVçF–Â’ÓÒfÇVW2æföÆÆ÷uWVçF–ÂÇÂ6ÆVâ†W†—7F–æræföÆÆ÷uWæ÷FW2’ÓÒfÇVW2æföÆÆ÷uWæ÷FW2’&W6WB‚vföÆÆ÷uWrÂ²v6†V6¶VDBrÂv6†V6¶VD'’rÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’uÒ“°¢6öç7BWFFRÒ²G6WC¢6WBÓ²–b„ö&¦V7Bæ¶W—2‡Vç6WB’æÆVæwF‚’WFFRâGVç6WBÒVç6WC°¢6öç7B&W7VÇBÒv—B6öÆÆV7F–öâçWFFTöæR‡²ö–C¢W†—7F–æråö–BÒÂWFFR“°¢–b‚&W7VÇBæÖF6†VD6÷VçB’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²W'&÷#¢tV×Æ÷–ÖVçB6†ævRæ÷Bf÷VæBârÒ“°¢&WGW&â&W2æ§6öâ‡²ââçfÇVW2ÂWFFVDBÂWFFVD'’Ò“°¢Ò6F6‚†W'&÷"’°¢6öç6öÆRæW'&÷"‚uVæ&ÆRFòWFFRV×Æ÷–ÖVçB6†ævRFWF–Ç3¢rÂW'&÷"“°¢&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢tV×Æ÷–ÖVçB6†ævRFWF–Ç26÷VÆBæ÷B&R6fVBârÒ“°¢Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&÷WFW"çWB‚röV×Æ÷–ÖVçBÖ6†ævW2ó¦–Bö6†V6·2rÂ7–æ2‡&WÂ&W2’Óâ°¢6öç7B²–BÒÒ&Wç&×3²6öç7B7F–öâÒ6ÆVâ‡&Wæ&öG“òæ7F–öâ’çFôÆ÷vW$66R‚“°¢6öç7B7F–öç2Ò°¢vf–ÆRÖ6†V6²s¢²vf–ÆRrÂv6†V6¶VDBrÂv6†V6¶VD'’uÒÂvf–ÆRÖf–æÂs¢²vf–ÆRrÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’uÒÀ¢w—&öÆÂÖ6†V6²s¢²w—&öÆÂrÂv6†V6¶VDBrÂv6†V6¶VD'’uÒÂw—&öÆÂÖf–æÂs¢²w—&öÆÂrÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’uÒÀ¢vföÆÆ÷wWÖ6†V6²s¢²vföÆÆ÷uWrÂv6†V6¶VDBrÂv6†V6¶VD'’uÒÂvföÆÆ÷wWÖf–æÂs¢²vföÆÆ÷uWrÂvf–æÅ&Wf–WvVDBrÂvf–æÅ&Wf–WvVD'’uÒÀ¢v–ç7W&æ6RÖ6†V6²s¢²v–ç7W&æ6RrÂv6†V6¶VDBrÂv6†V6¶VD'’uÒÂw&WF—&VÖVçBÖ6†V6²s¢²w&WF—&VÖVçBrÂv6†V6¶VDBrÂv6†V6¶VD'’uÒÀ¢Ó°¢–b‚ö&¦V7D–Bæ—5fÆ–B†–B’ÇÂ7F–öç5¶7F–öåÒ’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t–çfÆ–BV×Æ÷–ÖVçB6†ævR7F–öâârÒ“°¢6öç7B·F6²ÂFFTf–VÆBÂ'”f–VÆEÒÒ7F–öç5¶7F–öåÓ²6öç7B&Wf–WvW"Ò6ÆVâ‡&WæFÖ–å6W76–öãòæVÖ–Â’çFôÆ÷vW$66R‚“²6öç7Bf–æÄ7F–öâÒ7F–öâæVæG5v—F‚‚rÖf–æÂr“°¢–b†f–æÄ7F–öâbb&Wf–WvW"ÓÒf–æÅ&Wf–WvW$VÖ–Â’&WGW&â&W2ç7FGW2ƒC2’æ§6öâ‡²W'&÷#¢töæÇ’F†RWW"ÖÆWfVÂÖævW"6âW&f÷&Òf–æÂ&Wf–WrârÒ“°¢6öç7B6Æ–VçBÒ7&VFT6Æ–VçB‚“°¢G'’°¢v—B6Æ–VçBæ6öææV7B‚“²6öç7B6öÆÆV7F–öâÒ6Æ–VçBæF"†FF&6TæÖR’æ6öÆÆV7F–öâ‚vV×Æ÷–VUö‡%öV×Æ÷–ÖVçEö6†ævRr“²6öç7B&V6÷&BÒv—B6öÆÆV7F–öâæf–æDöæR‡²ö–C¢æWrö&¦V7D–B†–B’Ò“°¢–b‚&V6÷&B’&WGW&â&W2ç7FGW2ƒCB’æ§6öâ‡²W'&÷#¢tV×Æ÷–ÖVçB6†ævRæ÷Bf÷VæBârÒ“°¢–b‚&V6÷&BæVffV7F—fTFFRÇÂ&V6÷&BæV×Æ÷–VTföÆFW%W&Â’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢t6ö×ÆWFRV×Æ÷–ÖVçB6†ævRFWF–Ç2f—'7BârÒ“°¢–b‚&V6÷&BçF6·3òå·F6µÓòç&WV—&VB’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢uF†—2F6²—2æ÷BÆ–6&ÆRârÒ“°¢–b†f–æÄ7F–öâbb&V6÷&BçF6·3òå·F6µÓòæ6†V6¶VDB’&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷#¢tFÖ–â6†V6²×W7B&R6ö×ÆWFVB&Vf÷&Rf–æÂ&Wf–WrârÒ“°¢6öç7Bæ÷rÒæWrFFR‚“²v—B6öÆÆV7F–öâçWFFTöæR‡²ö–C¢&V6÷&Båö–BÒÂ²G6WC¢²¶F6·2âG·F6·ÒâG¶FFTf–VÆGÖÓ¢æ÷rÂ¶F6·2âG·F6·ÒâG¶'”f–VÆGÖÓ¢&Wf–WvW"ÂWFFVDC¢æ÷rÂWFFVD'“¢&Wf–WvW"ÒÒ“°¢&WGW&â&W2æ§6öâ‡²6ö×ÆWFVDC¢æ÷rÂ6ö×ÆWFVD'“¢&Wf–WvW"Ò“°¢Ò6F6‚†W'&÷"’²6öç6öÆRæW'&÷"‚uVæ&ÆRFò6ö×ÆWFRV×Æ÷–ÖVçB6†ævR6†V6³¢rÂW'&÷"“²&WGW&â&W2ç7FGW2ƒS’æ§6öâ‡²W'&÷#¢uF†RV×Æ÷–ÖVçB6†ævR7F–öâ6÷VÆBæ÷B&R6ö×ÆWFVBârÒ“²Òf–æÆÇ’²v—B6Æ–VçBæ6Æ÷6R‚“²Ð¢Ò“° ¢&WGW&â&÷WFW#°§Ð Ð¦ÖöGVÆRæW‡÷'G2Ò²7&VFT‡%ÆFf÷&Õ&÷WFW"Ó°Ð 