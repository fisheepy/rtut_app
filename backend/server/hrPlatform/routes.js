const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { isAllowedFolderUrl } = require('../training/folderLink');
const { clean, employeeView, fileTrackerComplete, sanitizeFileTracker, validDate } = require('./data');

function createHrPlatformRouter({ uri, databaseName, requireHrToolsSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });

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
    const payRate = clean(req.body?.payRate);
    const firstPayrollDate = clean(req.body?.firstPayrollDate);
    const insuranceEffectiveDate = clean(req.body?.insuranceEffectiveDate);
    const retirementEffectiveDate = clean(req.body?.retirementEffectiveDate);

    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    if (employeeFolderUrl && !isAllowedFolderUrl(employeeFolderUrl)) {
      return res.status(400).json({ error: 'Please enter a valid royaltruck.sharepoint.com employee folder link.' });
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
      const values = { employeeFolderUrl, payRate, firstPayrollDate, insuranceEffectiveDate, retirementEffectiveDate };
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

  router.put('/new-hires/:employeeId/file-tracker', async (req, res) => {
    const employeeId = req.params.employeeId;
    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    const tracker = sanitizeFileTracker(req.body?.fileTracker);
    const confirm = req.body?.confirm === true;
    const confirmationDate = clean(req.body?.confirmationDate);
    if (confirm && (!fileTrackerComplete(tracker) || !validDate(confirmationDate) || !confirmationDate)) {
      return res.status(400).json({ error: 'Complete every checklist item, the handbook version when required, and the confirmation date before final confirmation.' });
    }

    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('employee_hr_platform');
      const existing = await collection.findOne({ employeeId });
      if (existing?.fileTracker?.confirmedAt) {
        return res.status(409).json({ error: 'This File Tracker has been finally confirmed and can no longer be modified.' });
      }
      const fileTracker = {
        ...tracker,
        confirmationDate: confirm ? confirmationDate : '',
        confirmedAt: confirm ? new Date() : null,
        confirmedBy: confirm ? (req.adminSession?.email || null) : null,
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
