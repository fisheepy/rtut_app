const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { isAllowedFolderUrl } = require('../training/folderLink');
const { clean, employeeView, validDate } = require('./data');

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
    const firstPayrollDate = clean(req.body?.firstPayrollDate);
    const insuranceEffectiveDate = clean(req.body?.insuranceEffectiveDate);
    const retirementEffectiveDate = clean(req.body?.retirementEffectiveDate);

    if (!ObjectId.isValid(employeeId)) return res.status(400).json({ error: 'Invalid employee.' });
    if (employeeFolderUrl && !isAllowedFolderUrl(employeeFolderUrl)) {
      return res.status(400).json({ error: 'Please enter a valid royaltruck.sharepoint.com employee folder link.' });
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
      const values = { employeeFolderUrl, firstPayrollDate, insuranceEffectiveDate, retirementEffectiveDate };
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

  return router;
}

module.exports = { createHrPlatformRouter };
