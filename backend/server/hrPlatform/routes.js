const express = require('express');
const crypto = require('crypto');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { isAllowedFolderUrl } = require('../training/folderLink');
const { clean, DEFAULT_FILE_TRACKER_FIELDS, employeeView, fileTrackerComplete, sanitizeFileTracker, sanitizeTrackerCatalogField, validDate } = require('./data');

function createHrPlatformRouter({ uri, databaseName, requireHrToolsSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });
  const finalReviewerEmail = 'myu@royaltrailersales.com';

  async function getTrackerCatalog(db, includeInactive = false) {
    const stored = await db.collection('hr_file_tracker_fields').find({}).sort({ order: 1, label: 1 }).toArray();
    return stored.length
      ? stored.map(({ _id, ...field }) => field).filter(field => includeInactive || field.active)
      : DEFAULT_FILE_TRACKER_FIELDS.filter(field => includeInactive || field.active);
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

  router.put('/new-hires/:employeeId', async (req, res) => {
    const employeeId = req.params.employeeId;
    const employeeFolderUrl = clean(req.body?.employeeFolderUrl);
    const payRateType = clean(req.body?.payRateType);
    const payRate = clean(req.body?.payRate);
    const firstPayrollDate = clean(req.body?.firstPayrollDate);
    const insuranceEffectiveDate = clean(req.body?.insuranceEffectiveDate);
    const retirementEffectiveDate = clean(req.body?.retirementEffectiveDate);

    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    if (employeeFolderUrl && !isAllowedFolderUrl(employeeFolderUrl)) {
      return res.status(400).json({ error: 'Please enter a valid Royal Truck SharePoint employee folder link.' });
    }
    if (payRate && !['Hourly Rate', 'Annual Salary'].includes(payRateType)) {
      return res.status(400).json({ error: 'Select Hourly Rate or Annual Salary before entering a Pay Rate.' });
    }
    if (payRate && !/^\d+(\.\d{1,2})?$/.test(payRate)) {
      return res.status(400).json({ error: 'Please enter a valid Pay Rate with no more than two decimal places.' });
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
      const values = { employeeFolderUrl, payRateType: payRate ? payRateType : '', payRate, firstPayrollDate, insuranceEffectiveDate, retirementEffectiveDate };
      await db.collection('employee_hr_platform').updateOne(
        { employeeId },
        { $set: { ...values, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
        { upsert: true },
      );
      return res.json(values);
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
      const submit = action === 'submit';
      if (submit && (!fileTrackerComplete(tracker, catalog) || !validDate(confirmationDate) || !confirmationDate)) {
        return res.status(400).json({ error: 'Complete every checklist item, the handbook version when required, and the confirmation date before confirming for review.' });
      }
      const fileTracker = {
        ...tracker,
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

  return router;
}

module.exports = { createHrPlatformRouter };
