const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { normalizeEmployee } = require('./employeeData');
const { isAllowedFolderUrl } = require('./folderLink');
const {
  getOrientationLibraries,
  resolveAssignedLibraries,
  sanitizeOrientationInput,
  validateLibraryInput,
} = require('./orientationCatalog');
const {
  employeeMatchesAssignmentCriteria,
  getMonthlyTopics,
  normalizeMonthly,
  sanitizeMonthlyInput,
  validateTopicInput,
} = require('./monthlyCatalog');

function createTrainingRouter({ uri, databaseName, requireTrainingSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  async function reconcileMonthlyTopicAssignments(db, topic, adminEmail) {
    const employees = await db.collection('employees').find({}).toArray();
    const monthlyTopics = await getMonthlyTopics(db);
    const employeeIds = employees.map((employee) => String(employee._id));
    const existingRecords = employeeIds.length
      ? await db.collection('employee_training').find({ employeeId: { $in: employeeIds } }).toArray()
      : [];
    const existingByEmployeeId = new Map(existingRecords.map((record) => [String(record.employeeId), record]));
    let assignedCount = 0;
    const operations = [];

    for (const employee of employees) {
      const employeeId = String(employee._id);
      const existing = existingByEmployeeId.get(employeeId);
      const assignments = normalizeMonthly(existing, monthlyTopics).assignments;
      const currentAssignment = assignments.find((assignment) => assignment.topic.id === topic.id);
      const matches = employeeMatchesAssignmentCriteria(normalizeEmployee(employee, null, [], []), topic.autoAssign);
      if (matches) assignedCount += 1;
      const hasExistingHistory = currentAssignment
        && (currentAssignment.requirement !== 'Unassigned' || currentAssignment.completionStatus === 'Finished');
      if (!matches && !hasExistingHistory) continue;

      const topicAssignments = Object.fromEntries(assignments.map((assignment) => {
        if (assignment.topic.id !== topic.id) return [assignment.topic.id, {
          requirement: assignment.requirement,
          completionStatus: assignment.completionStatus,
          completionDate: assignment.completionDate,
          courseProgress: assignment.courseProgress,
        }];
        const keepFinished = assignment.completionStatus === 'Finished' && Boolean(assignment.completionDate);
        return [assignment.topic.id, {
          requirement: matches ? 'Required' : 'Unassigned',
          completionStatus: keepFinished ? 'Finished' : 'Unfinished',
          completionDate: keepFinished ? assignment.completionDate : null,
          courseProgress: matches || keepFinished ? assignment.courseProgress : {},
        }];
      }));
      const sanitized = sanitizeMonthlyInput({ topicAssignments }, monthlyTopics, existing);
      operations.push({
        updateOne: {
          filter: { employeeId },
          update: { $set: {
            monthly: { topicAssignments: sanitized.topicAssignments },
            monthlyUpdatedAt: new Date(),
            monthlyUpdatedBy: adminEmail || null,
          } },
          upsert: true,
        },
      });
    }
    if (operations.length) await db.collection('employee_training').bulkWrite(operations);
    return assignedCount;
  }

  router.use(requireTrainingSession);

  router.get('/employees', async (_req, res) => {
    const client = createClient();

    try {
      await client.connect();
      const db = client.db(databaseName);
      const orientationLibraries = await getOrientationLibraries(db);
      const monthlyTopics = await getMonthlyTopics(db);
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
      const legacyOrientationRecords = trainingRecords.filter((record) => (
        record.orientation?.assignedLibraryIds?.length
        && !Array.isArray(record.orientation.assignedLibraries)
      ));
      if (legacyOrientationRecords.length) {
        await db.collection('employee_training').bulkWrite(legacyOrientationRecords.map((record) => {
          const assignedLibraries = resolveAssignedLibraries(record.orientation, orientationLibraries);
          record.orientation.assignedLibraries = assignedLibraries;
          return {
            updateOne: {
              filter: { _id: record._id },
              update: { $set: { 'orientation.assignedLibraries': assignedLibraries } },
            },
          };
        }));
      }
      const trainingByEmployeeId = new Map(
        trainingRecords.map((record) => [String(record.employeeId), record]),
      );

      const data = employees
        .map((employee) => normalizeEmployee(
          employee,
          trainingByEmployeeId.get(String(employee._id)),
          orientationLibraries,
          monthlyTopics,
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
        monthlyTopics,
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
      const existingTraining = await db.collection('employee_training').findOne({ employeeId: req.params.employeeId });
      const orientation = sanitizeOrientationInput(req.body, orientationLibraries, existingTraining);
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
              assignedLibraries: orientation.assignedLibraries,
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

  router.put('/employees/:employeeId/monthly', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const monthlyTopics = await getMonthlyTopics(db);
      const existingTraining = await db.collection('employee_training').findOne({ employeeId: req.params.employeeId });
      const result = sanitizeMonthlyInput(req.body, monthlyTopics, existingTraining);
      if (result.error) return res.status(400).json({ error: result.error });
      const employee = ObjectId.isValid(req.params.employeeId)
        ? await db.collection('employees').findOne({ _id: new ObjectId(req.params.employeeId) })
        : null;
      if (!employee) return res.status(404).json({ error: 'Employee not found.' });
      await db.collection('employee_training').updateOne(
        { employeeId: req.params.employeeId },
        {
          $set: {
            monthly: { topicAssignments: result.topicAssignments },
            monthlyUpdatedAt: new Date(),
            monthlyUpdatedBy: req.adminSession?.email || null,
          },
        },
        { upsert: true },
      );
      return res.json({ monthly: result.monthly });
    } catch (error) {
      console.error('Unable to save employee monthly training:', error);
      return res.status(500).json({ error: 'Monthly training could not be saved.' });
    } finally {
      await client.close();
    }
  });

  router.post('/monthly-topics', async (req, res) => {
    const result = validateTopicInput(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const topic = { ...result.topic, order: Date.now() };
      await db.collection('monthly_training_topics').insertOne(topic);

      const assignedCount = await reconcileMonthlyTopicAssignments(db, result.topic, req.adminSession?.email);
      return res.status(201).json({ topic: result.topic, assignedCount });
    } catch (error) {
      console.error('Unable to add monthly training topic:', error);
      return res.status(500).json({ error: 'The monthly training topic could not be added.' });
    } finally {
      await client.close();
    }
  });

  router.put('/monthly-topics/:topicId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const collection = db.collection('monthly_training_topics');
      const existing = await collection.findOne({ id: req.params.topicId });
      if (!existing) return res.status(404).json({ error: 'Monthly training topic not found.' });
      const result = validateTopicInput(req.body, existing);
      if (result.error) return res.status(400).json({ error: result.error });
      await collection.updateOne(
        { id: req.params.topicId },
        { $set: { ...result.topic, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
      );
      const assignedCount = await reconcileMonthlyTopicAssignments(db, result.topic, req.adminSession?.email);
      return res.json({ topic: result.topic, assignedCount });
    } catch (error) {
      console.error('Unable to update monthly training topic:', error);
      return res.status(500).json({ error: 'The monthly training topic could not be updated.' });
    } finally {
      await client.close();
    }
  });

  router.delete('/monthly-topics/:topicId', async (req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const result = await client.db(databaseName).collection('monthly_training_topics').deleteOne({ id: req.params.topicId });
      if (!result.deletedCount) return res.status(404).json({ error: 'Monthly training topic not found.' });
      return res.status(204).end();
    } catch (error) {
      console.error('Unable to delete monthly training topic:', error);
      return res.status(500).json({ error: 'The monthly training topic could not be deleted.' });
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
