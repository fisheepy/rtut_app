const crypto = require('crypto');
const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const {
  hashTrainingCode,
  isAuthorizedTrainingEmail,
  normalizeEmail,
  secureCodeMatch,
} = require('./access');

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function createTrainingAuthRouter({
  uri,
  databaseName,
  sendEmail,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
  codeSecret,
}) {
  const router = express.Router();
  const createClient = () => new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  router.get('/me', (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session || !isAuthorizedTrainingEmail(session.email)) {
      return res.status(401).json({ authenticated: false });
    }
    return res.json({ authenticated: true, email: normalizeEmail(session.email) });
  });

  router.post('/request-code', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isAuthorizedTrainingEmail(email)) {
      return res.status(403).json({ error: 'This email is not authorized for Training Tools.' });
    }

    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('training_login_codes');
      const existing = await collection.findOne({ _id: email });
      const now = new Date();
      if (existing?.requestedAt && now.getTime() - new Date(existing.requestedAt).getTime() < REQUEST_COOLDOWN_MS) {
        return res.status(429).json({ error: 'Please wait one minute before requesting another code.' });
      }

      const code = String(crypto.randomInt(100000, 1000000));
      await collection.updateOne(
        { _id: email },
        {
          $set: {
            codeHash: hashTrainingCode(email, code, codeSecret),
            requestedAt: now,
            expiresAt: new Date(now.getTime() + CODE_LIFETIME_MS),
            attempts: 0,
          },
        },
        { upsert: true },
      );

      try {
        await sendEmail({
          to: email,
          subject: 'Your RTUT Training Tools login code',
          text: `Your RTUT Training Tools login code is ${code}. This code expires in 10 minutes. If you did not request it, you can ignore this email.`,
          html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>RTUT Training Tools</h2><p>Your one-time login code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`,
        });
      } catch (mailError) {
        await collection.deleteOne({ _id: email });
        throw mailError;
      }

      return res.json({ ok: true, expiresInMinutes: 10 });
    } catch (error) {
      console.error('Unable to send Training Tools login code:', error);
      return res.status(500).json({ error: 'The login code could not be sent. Please try again.' });
    } finally {
      await client.close();
    }
  });

  router.post('/verify-code', async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    if (!isAuthorizedTrainingEmail(email) || !/^\d{6}$/.test(code)) {
      return res.status(401).json({ error: 'Invalid or expired login code.' });
    }

    const client = createClient();
    try {
      await client.connect();
      const collection = client.db(databaseName).collection('training_login_codes');
      const record = await collection.findOne({ _id: email });
      const valid = record
        && record.attempts < MAX_ATTEMPTS
        && new Date(record.expiresAt).getTime() > Date.now()
        && secureCodeMatch(record.codeHash, hashTrainingCode(email, code, codeSecret));

      if (!valid) {
        if (record) await collection.updateOne({ _id: email }, { $inc: { attempts: 1 } });
        return res.status(401).json({ error: 'Invalid or expired login code.' });
      }

      await collection.deleteOne({ _id: email });
      setSessionCookie(res, {
        firstName: 'Myra',
        lastName: 'Yu',
        email,
        type: 'training',
      });
      return res.json({ authenticated: true, email });
    } catch (error) {
      console.error('Unable to verify Training Tools login code:', error);
      return res.status(500).json({ error: 'The login code could not be verified. Please try again.' });
    } finally {
      await client.close();
    }
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  return router;
}

module.exports = { createTrainingAuthRouter };
