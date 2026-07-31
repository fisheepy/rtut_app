const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { normalizeEmployee } = require('./employeeData');
const { isAllowedFolderUrl } = require('./folderLink');
const {
  getOrientationLibraries,
  sanitizeOrientationInput,
  validateLibraryInput,
} = require('./orientationCatalog');

function createTrainingRouter({ uri, databaseName, requireTrainingSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  router.use(requireTrainingSession);

  router.get('/employees', async (_req, res) => {
    const client = createClient();

    try {
      await client.connect();
      const db = client.db(databaseName);
      const orientationLibraries = await getOrientationLibraries(db);
      const employees = await db.collection('employees').find({}).project({
        'First Name': 1,
        'Last Name': 1,
        Email: 1,
        Phone: 1,
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
          orientationLibraries,
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
        orientationLibraries,
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

  router.put('/employees/:employeeId/orientation', async (req, res) => {
    const client = createClient();

    try {
      await client.connect();
      const db = client.db(databaseName);
      const orientationLibraries = await getOrientationLibraries(db);
      const orientation = sanitizeOrientationInput(req.body, orientationLibraries);
      const employee = ObjectId.isValid(req.params.employeeId)
        ? await db.collection('employees').findOne({ _id: new ObjectId(req.params.employeeId) })
        : null;
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });

      await db.collection('employee_training').updateOne(
        { employeeId: req.params.employeeId },
        {
          $set: {
            orientation: {
              assignedLibraryIds: orientation.assignedLibraryIds,
              courseProgress: orientation.courseProgress,
            },
            orientationUpdatedAt: new Date(),
            orientationUpdatedBy: req.adminSession?.email || null,
          },
        },
        { upsert: true },
      );

      return res.json({ orientation });
    } catch (error) {
      console.error('Unable to save employee orientation training:', error);
      return res.status(500).json({ error: 'Orientation training could not be saved.' });
    } finally {
      await client.close();
    }
  });

  router.post('/orientation-libraries', async (req, res) => {
    const result = validateLibraryInput(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const library = { ...result.library, order: Date.now() };
      await db.collection('orientation_libraries').insertOne(library);
      return res.status(201).json({ library: result.library });
    } catch (error) {
      console.error('Unable to add orientation library:', error);
      return res.status(500).json({ error: 'The orientation library could not be added.' });
    } finally {
      await client.close();
    }
  });

  router.put('/orientation-libraries/:libraryId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('orientation_libraries');
      const existing = await collection.findOne({ id: req.params.libraryId });
      if (!existing) return res.status(404).json({ error: 'Orientation library not found.' });
      const result = validateLibraryInput(req.body, existing);
      if (result.error) return res.status(400).json({ error: result.error });
      await collection.updateOne(
        { id: req.params.libraryId },
        { $set: { ...result.library, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
      );
      return res.json({ library: result.library });
    } catch (error) {
      console.error('Unable to update orientation library:', error);
      return res.status(500).json({ error: 'The orientation library could not be updated.' });
    } finally {
      await client.close();
    }
  });

  router.delete('/orientation-libraries/:libraryId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const result = await db.collection('orientation_libraries').deleteOne({ id: req.params.libraryId });
      if (!result.deletedCount) return res.status(404).json({ error: 'Orientation library not found.' });
      return res.status(204).end();
    } catch (error) {
      console.error('Unable to delete orientation library:', error);
      return res.status(500).json({ error: 'The orientation library could not be deleted.' });
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
