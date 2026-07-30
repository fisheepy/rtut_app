const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { normalizeEmployee } = require('./employeeData');
const { isAllowedFolderUrl } = require('./folderLink');

function createTrainingRouter({ uri, databaseName, requireAdminSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  router.use(requireAdminSession);

  router.get('/employees', async (_req, res) => {
    const client = createClient();

    try {
      await client.connect();
      const db = client.db(databaseName);
      const employees = await db.collection('employees').find({}).project({
        'First Name': 1,
        'Last Name': 1,
        'Job Title': 1,
        Location: 1,
        Department: 1,
        'Home Department': 1,
        'Hire Date': 1,
        'First Day': 1,
        'Termination Date': 1,
        'Termination Day': 1,
        'Supervisor First Name': 1,
        'Supervisor Last Name': 1,
        'Account Active': 1,
        'Position Status': 1,
      }).toArray();

      const employeeIds = employees.map((employee) => String(employee._id));
      const trainingRecords = employeeIds.length
        ? await db.collection('employee_training').find({
          employeeId: { $in: employeeIds },
        }).toArray()
        : [];
      const trainingByEmployeeId = new Map(
        trainingRecords.map((record) => [String(record.employeeId), record]),
      );

      const data = employees
        .map((employee) => normalizeEmployee(
          employee,
          trainingByEmployeeId.get(String(employee._id)),
        ))
        .sort((left, right) => {
          if (left.employmentStatus !== right.employmentStatus) {
            return left.employmentStatus === 'Active' ? -1 : 1;
          }
          return left.employeeName.localeCompare(right.employeeName);
        });

      res.json({
        employees: data,
        source: 'Company App employee roster',
        trainingTypes: ['Orientation Training', 'Monthly Training'],
      });
    } catch (error) {
      console.error('Unable to load training employees:', error);
      res.status(500).json({
        error: 'Employee training information could not be loaded. Please try again.',
      });
    } finally {
      await client.close();
    }
  });

  router.put('/employees/:employeeId/folder-link', async (req, res) => {
    const folderUrl = String(req.body?.folderUrl || '').trim();
    if (!isAllowedFolderUrl(folderUrl)) {
      return res.status(400).json({
        error: 'Please enter a valid royaltruck.sharepoint.com folder link.',
      });
    }

    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const employee = ObjectId.isValid(req.params.employeeId)
        ? await db.collection('employees').findOne({ _id: new ObjectId(req.params.employeeId) })
        : null;
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });

      await db.collection('employee_training').updateOne(
        { employeeId: req.params.employeeId },
        {
          $set: {
            folderUrl,
            folderUrlUpdatedAt: new Date(),
            folderUrlUpdatedBy: req.adminSession?.email || null,
          },
        },
        { upsert: true },
      );
      return res.json({ folderUrl });
    } catch (error) {
      console.error('Unable to save employee folder link:', error);
      return res.status(500).json({ error: 'The employee folder link could not be saved.' });
    } finally {
      await client.close();
    }
  });

  return router;
}

module.exports = { createTrainingRouter };
