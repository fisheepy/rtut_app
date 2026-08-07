const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { sanitizeCaseInput, withCurrentWorkStatus } = require('./data');

function createWorkInjuryRouter({ uri, databaseName, requireTrainingSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
  router.use(requireTrainingSession);

  router.get('/cases', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const cases = await client.db(databaseName).collection('work_injury_cases').find({}).sort({ injuryDateTime: -1 }).toArray();
      return res.json({ cases: cases.map(record => ({ ...withCurrentWorkStatus(record), id: String(record._id), _id: undefined })) });
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
      const result = sanitizeCaseInput(req.body, employee);
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

  router.post('/cases/:caseId/close', async (req, res) => {
    const client = createClient();
    try {
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const result = await client.db(databaseName).collection('work_injury_cases').updateOne(
        { _id: new ObjectId(req.params.caseId), closedAt: null },
        { $set: { closedAt: new Date(), closedBy: req.adminSession?.email || null, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } },
      );
      if (!result.matchedCount) return res.status(404).json({ error: 'Open work injury case not found.' });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Unable to close work injury case:', error);
      return res.status(500).json({ error: 'The work injury case could not be closed.' });
    } finally { await client.close(); }
  });

  return router;
}

module.exports = { createWorkInjuryRouter };

