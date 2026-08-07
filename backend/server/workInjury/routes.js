const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { closureWarnings, sanitizeCaseInput, withCurrentWorkStatus } = require('./data');

const FINAL_APPROVER_EMAIL = 'myu@royaltrailersales.com';

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

  router.post('/cases/:caseId/close-request', async (req, res) => {
    const client = createClient();
    try {
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null });
      if (!record) return res.status(404).json({ error: 'Open work injury case not found.' });
      const warnings = closureWarnings(record);
      if (warnings.length && req.body?.confirmWarnings !== true) return res.status(409).json({ requiresConfirmation: true, warnings });
      const now = new Date();
      await collection.updateOne({ _id: record._id }, { $set: { closeRequestedAt: now, closeRequestedBy: req.adminSession?.email || null, closeWarnings: warnings, updatedAt: now, updatedBy: req.adminSession?.email || null } });
      return res.json({ ok: true, pendingFinalApproval: true, warnings });
    } catch (error) {
      console.error('Unable to request work injury case closure:', error);
      return res.status(500).json({ error: 'The work injury case closure request could not be saved.' });
    } finally { await client.close(); }
  });

  router.post('/cases/:caseId/close-final-approval', async (req, res) => {
    const client = createClient();
    try {
      if ((req.adminSession?.email || '').toLowerCase() !== FINAL_APPROVER_EMAIL) return res.status(403).json({ error: 'Only the authorized final approver can close this case.' });
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null, closeRequestedAt: { $ne: null } });
      if (!record) return res.status(404).json({ error: 'Pending case closure request not found.' });
      const warnings = closureWarnings(record);
      if (warnings.length && req.body?.confirmWarnings !== true) return res.status(409).json({ requiresConfirmation: true, warnings });
      const now = new Date();
      await collection.updateOne({ _id: record._id }, { $set: { closedAt: now, closedBy: req.adminSession.email, closeFinalApprovedAt: now, closeFinalApprovedBy: req.adminSession.email, closeWarnings: warnings, updatedAt: now, updatedBy: req.adminSession.email } });
      return res.json({ ok: true });
    } catch (error) {
      console.error('Unable to approve work injury case closure:', error);
      return res.status(500).json({ error: 'The work injury case could not be closed.' });
    } finally { await client.close(); }
  });

  router.post('/cases/:caseId/close-decline', async (req, res) => {
    const client = createClient();
    try {
      if ((req.adminSession?.email || '').toLowerCase() !== FINAL_APPROVER_EMAIL) return res.status(403).json({ error: 'Only the authorized final approver can decline this closure request.' });
      if (!ObjectId.isValid(req.params.caseId)) return res.status(404).json({ error: 'Work injury case not found.' });
      await client.connect();
      const collection = client.db(databaseName).collection('work_injury_cases');
      const record = await collection.findOne({ _id: new ObjectId(req.params.caseId), closedAt: null, closeRequestedAt: { $ne: null } });
      if (!record) return res.status(404).json({ error: 'Pending case closure request not found.' });
      const now = new Date();
      const declinedBy = req.adminSession.email;
      await collection.updateOne({ _id: record._id }, {
        $set: { closeRequestedAt: null, closeRequestedBy: null, closeWarnings: [], closeDeclinedAt: now, closeDeclinedBy: declinedBy, updatedAt: now, updatedBy: declinedBy },
        $push: { closeDecisionHistory: { decision: 'Declined', decidedAt: now, decidedBy: declinedBy, requestedAt: record.closeRequestedAt, requestedBy: record.closeRequestedBy || null } }
      });
      return res.json({ ok: true, reopenedForEditing: true });
    } catch (error) {
      console.error('Unable to decline work injury case closure:', error);
      return res.status(500).json({ error: 'The closure request could not be declined.' });
    } finally { await client.close(); }
  });

  return router;
}

module.exports = { createWorkInjuryRouter };
