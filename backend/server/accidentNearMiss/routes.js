const express = require('express');
const ExcelJS = require('exceljs');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const { eventStatus, sanitizeEventInput } = require('./data');

function createAccidentNearMissRouter({ uri, databaseName, requireTrainingSession }) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, { serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true } });
  router.use(requireTrainingSession);

  const serialize = record => ({ ...record, id: String(record._id), _id: undefined, status: eventStatus(record) });

  router.get('/events', async (_req, res) => {
    const client = createClient();
    try {
      await client.connect();
      const records = await client.db(databaseName).collection('accident_near_miss_events').find({}).sort({ eventDateTime: -1 }).toArray();
      return res.json({ events: records.map(serialize) });
    } catch (error) {
      console.error('Unable to load accident and near miss events:', error);
      return res.status(500).json({ error: 'Accident and near miss events could not be loaded.' });
    } finally { await client.close(); }
  });

  router.post('/events', async (req, res) => {
    const result = sanitizeEventInput(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const client = createClient();
    try {
      await client.connect();
      const db = client.db(databaseName);
      const year = result.value.eventDateTime.slice(0, 4);
      const sequence = await db.collection('accident_near_miss_counters').findOneAndUpdate({ _id: `${result.value.eventType}-${year}` }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
      const prefix = result.value.eventType === 'Accident' ? 'ACC' : 'NM';
      const now = new Date();
      const record = { ...result.value, eventNumber: `${prefix}-${year}-${String(sequence.value).padStart(3, '0')}`, closedAt: null, closedBy: null, createdAt: now, createdBy: req.adminSession?.email || null, updatedAt: now, updatedBy: req.adminSession?.email || null };
      const inserted = await db.collection('accident_near_miss_events').insertOne(record);
      return res.status(201).json({ event: serialize({ ...record, _id: inserted.insertedId }) });
    } catch (error) {
      console.error('Unable to create accident or near miss event:', error);
      return res.status(500).json({ error: 'The event could not be created.' });
    } finally { await client.close(); }
  });

  router.put('/events/:eventId', async (req, res) => {
    if (!ObjectId.isValid(req.params.eventId)) return res.status(404).json({ error: 'Event not found.' });
    const result = sanitizeEventInput(req.body);
    if (result.error) return res.status(400).json({ error: result.error });
    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('accident_near_miss_events');
      const existing = await collection.findOne({ _id: new ObjectId(req.params.eventId), closedAt: null });
      if (!existing) return res.status(404).json({ error: 'Open event not found.' });
      const update = { ...result.value, eventType: existing.eventType, eventNumber: existing.eventNumber, updatedAt: new Date(), updatedBy: req.adminSession?.email || null };
      await collection.updateOne({ _id: existing._id }, { $set: update });
      return res.json({ event: serialize({ ...existing, ...update }) });
    } catch (error) {
      console.error('Unable to update accident or near miss event:', error);
      return res.status(500).json({ error: 'The event could not be updated.' });
    } finally { await client.close(); }
  });

  router.post('/events/:eventId/close', async (req, res) => {
    if (!ObjectId.isValid(req.params.eventId)) return res.status(404).json({ error: 'Event not found.' });
    const client = createClient();
    try {
      await client.connect();
      const result = await client.db(databaseName).collection('accident_near_miss_events').updateOne({ _id: new ObjectId(req.params.eventId), closedAt: null }, { $set: { closedAt: new Date(), closedBy: req.adminSession?.email || null, updatedAt: new Date(), updatedBy: req.adminSession?.email || null } });
      if (!result.matchedCount) return res.status(404).json({ error: 'Open event not found.' });
      return res.json({ success: true });
    } catch (error) {
      console.error('Unable to close accident or near miss event:', error);
      return res.status(500).json({ error: 'The event could not be closed.' });
    } finally { await client.close(); }
  });

  router.get('/reports/events.xlsx', async (req, res) => {
    const query = {};
    if (req.query.from || req.query.to) query.eventDateTime = { ...(req.query.from ? { $gte: String(req.query.from) } : {}), ...(req.query.to ? { $lte: `${String(req.query.to)}T23:59:59.999` } : {}) };
    if (['Accident', 'Near Miss'].includes(req.query.type)) query.eventType = req.query.type;
    const client = createClient();
    try {
      await client.connect();
      const records = await client.db(databaseName).collection('accident_near_miss_events').find(query).sort({ eventDateTime: -1 }).toArray();
      const workbook = new ExcelJS.Workbook();
      const events = workbook.addWorksheet('Events');
      const followUps = workbook.addWorksheet('Follow Ups');
      events.columns = [{ header: 'Event Number', key: 'number', width: 18 }, { header: 'Type', key: 'type', width: 14 }, { header: 'Event Date / Time', key: 'date', width: 22 }, { header: 'Reported Date', key: 'reported', width: 16 }, { header: 'Location', key: 'location', width: 22 }, { header: 'Department', key: 'department', width: 22 }, { header: 'Reported By', key: 'reportedBy', width: 24 }, { header: 'People Involved', key: 'people', width: 30 }, { header: 'Nature', key: 'nature', width: 22 }, { header: 'Description', key: 'description', width: 50 }, { header: 'Report Received', key: 'received', width: 18 }, { header: 'Report / Folder Link', key: 'link', width: 50 }, { header: 'Cost Involved', key: 'cost', width: 18 }, { header: 'Estimated Cost', key: 'estimated', width: 18 }, { header: 'Final Cost', key: 'final', width: 18 }, { header: 'Status', key: 'status', width: 26 }, { header: 'Closed At', key: 'closedAt', width: 22 }, { header: 'Closed By', key: 'closedBy', width: 30 }];
      followUps.columns = [{ header: 'Event Number', key: 'number', width: 18 }, { header: 'Type', key: 'type', width: 14 }, { header: 'Event Date / Time', key: 'date', width: 22 }, { header: 'Description', key: 'description', width: 48 }, { header: 'Due Date', key: 'due', width: 16 }, { header: 'Completed', key: 'completed', width: 14 }, { header: 'Completed Date', key: 'completedDate', width: 18 }];
      records.forEach(record => {
        events.addRow({ number: record.eventNumber, type: record.eventType, date: record.eventDateTime, reported: record.reportedDate, location: record.location, department: record.department, reportedBy: record.reportedBy, people: record.peopleInvolved, nature: record.eventNature === 'Other' ? record.otherEventNature : record.eventNature, description: record.description, received: record.reportReceived, link: record.reportLink, cost: record.costInvolved, estimated: record.estimatedCost, final: record.finalCost, status: eventStatus(record), closedAt: record.closedAt || '', closedBy: record.closedBy || '' });
        (record.followUps || []).forEach(item => followUps.addRow({ number: record.eventNumber, type: record.eventType, date: record.eventDateTime, description: item.description, due: item.dueDate, completed: item.completed ? 'Yes' : 'No', completedDate: item.completedDate }));
      });
      [events, followUps].forEach(sheet => { sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }; });
      ['estimated', 'final'].forEach(key => { events.getColumn(key).numFmt = '$#,##0.00'; });
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Accident_Near_Miss_Report_${new Date().toISOString().slice(0, 10)}.xlsx"`);
      return res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Unable to create accident and near miss report:', error);
      return res.status(500).json({ error: 'The report could not be created.' });
    } finally { await client.close(); }
  });

  return router;
}

module.exports = { createAccidentNearMissRouter };
