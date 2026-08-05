const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const FAISS_SERVER_URL = process.env.FAISS_SERVER_URL || "https://rtut-app-faiss-0a3485bd0bc8.herokuapp.com/";
console.log(`ðŸ”— Using FAISS Server URL: ${FAISS_SERVER_URL}`);
const axios = require("axios");
const nodemailer = require('nodemailer'); 
const cron = require('node-cron');
const { DateTime } = require('luxon');
const { format } = require('@fast-csv/format'); 
const { Readable } = require('stream');
const { createPayrollVerificationRouter } = require('./payrollVerification/routes');
const { createInsuranceBreakoutRouter } = require('./insuranceBreakout/routes');
const { createCommissionRosterRouter } = require('./commissionRoster/routes');
const { createTrainingRouter } = require('./training/routes');
const { createTrainingAuthRouter } = require('./training/authRoutes');
const { createRequireHrToolsSession, createRequireTrainingSession, isAuthorizedHrToolsEmail } = require('./training/access');
const { createHrPlatformRouter } = require('./hrPlatform/routes');
const {
    buildEarliestAcceptanceMap,
    employeeForExport,
    resolveAppRegistrationDate,
    shouldActivateRegisteredEmployee,
} = require('./registrationDate');
const {
    clearSessionCookie,
    findAdminByEmail,
    getSessionFromRequest,
    publicSession,
    requireAdminSession,
    setSessionCookie,
    validateOtpAdmin,
    verifyGoogleCredential,
} = require('./adminAuth');

function buildDigestHtml({ etDate, rows }) {
  const total = rows.length;
  const solved = rows.filter(r => r.resolved === true).length;
  const unsolved = total - solved;
  const detail = rows.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${r.createdAtET}</td>
      <td>${(r.question || '').replace(/</g, '&lt;')}</td>
      <td>${r.fullName || ''}</td>
      <td>${r.email || ''}</td>
      <td>${r.phone || ''}</td>
      <td>${r.emailed ? 'Yes' : 'No'}</td>
      <td>${r.resolved ? 'Yes' : 'No'}</td>
      <td>${r._id}</td>
    </tr>`).join('');

  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
    <h2>Daily HR Question Debrief(${etDate} EST)</h2>
    <p>Total:<b>${total}</b>;Resolved:<b>${solved}</b>;Unresolved:<b>${unsolved}</b></p>
    <table border="1" cellspacing="0" cellpadding="6">
      <thead>
        <tr>
          <th>#</th><th>Time(ET)</th><th>Question</th><th>Name</th><th>Email</th>
          <th>Phone</th><th>Emailed</th><th>Resolved</th><th>ID</th>
        </tr>
      </thead>
      <tbody>${detail || '<tr><td colspan="9">(No Data)</td></tr>'}</tbody>
    </table>
  </div>`;
}

function rowsToCsvBuffer(rows) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const csv = format({ headers: true })            // â† ç”¨ format()
      .on('data', c => chunks.push(Buffer.from(c)))
      .on('end', () => resolve(Buffer.concat(chunks)))
      .on('error', reject);

    Readable.from(rows.map(r => ({
      created_at_ET: r.createdAtET,
      created_at_UTC: r.createdAtUTC,
      question: r.question || '',
      firstName: r.firstName || '',
      lastName: r.lastName || '',
      fullName: r.fullName || '',
      email: r.email || '',
      phone: r.phone || '',
      emailed: !!r.emailed,
      resolved: !!r.resolved,
      id: r._id,
    }))).pipe(csv);
  });
}

// ç»Ÿä¸€çš„å‘ä¿¡å‡½æ•°ï¼ˆä½ å·²å¼•è¿‡ nodemailerï¼Œä¸é‡å¤æ”¹ä½ çŽ°æœ‰é£Žæ ¼ï¼‰
function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}
async function sendEmail({ to, subject, text, html, attachments }) {
  const transporter = makeTransporter();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    text,
    html,
    attachments,
  });
}

const uploadDirectory = path.join(__dirname, 'uploads');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function sendEmail({ to, subject, text, html, attachments }) {
  const transporter = makeTransporter();
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    to: Array.isArray(to) ? to.join(',') : to,
    subject,
    text,
    html,
    attachments,
  });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

const app = express();
app.use(express.json());
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../client/build'), { index: false }))

// Set the limit to 10MB or more as needed
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const port = 3101;

const database_username = process.env.MONGODB_USERNAME;
const database_password = process.env.MONGODB_PASSWORD;
const host_name = process.env.MONGODB_HOST;
const database_name = process.env.MONGODB_DATABASE;

const uri = `mongodb+srv://${database_username}:${database_password}@${host_name}/?retryWrites=true&w=majority&appName=${database_name}`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function reconcileHistoricalAppRegistrationDates() {
    const migrationClient = new MongoClient(uri, {
        serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
    });
    try {
        await migrationClient.connect();
        const db = migrationClient.db(database_name);
        const collection = db.collection('employees');
        const employees = await collection.find({}).project({ username: 1, activationDate: 1, 'App Registration Date': 1, 'Account Active': 1, 'Position Status': 1, isActivated: 1 }).toArray();
        const usernames = employees.map(employee => employee.username).filter(Boolean);
        const acceptances = usernames.length
            ? await db.collection('disclaimer acceptances').find({
                accepted: true,
                username: { $in: usernames },
            }).collation({ locale: 'en', strength: 2 }).project({ username: 1, timestamp: 1, accepted: 1 }).toArray()
            : [];
        const earliestAcceptanceByUsername = buildEarliestAcceptanceMap(acceptances);
        const operations = employees.flatMap(employee => {
            const registrationDate = resolveAppRegistrationDate(employee, earliestAcceptanceByUsername);
            const storedDate = employee['App Registration Date'] ? new Date(employee['App Registration Date']) : null;
            const needsRegistrationDate = registrationDate && (!storedDate || Number.isNaN(storedDate.getTime()) || storedDate.getTime() !== registrationDate.getTime());
            const needsActivation = shouldActivateRegisteredEmployee(employee, registrationDate);
            if (!needsRegistrationDate && !needsActivation) return [];
            const update = {};
            if (needsRegistrationDate) update['App Registration Date'] = registrationDate;
            if (needsActivation) update.isActivated = 'true';
            return [{
                updateOne: {
                    filter: { _id: employee._id },
                    update: { $set: update },
                },
            }];
        });
        if (operations.length) await collection.bulkWrite(operations);
        console.log(`App registration date reconciliation completed: ${operations.length} employee record(s) updated.`);
    } catch (error) {
        console.error('App registration date reconciliation failed:', error.message);
    } finally {
        await migrationClient.close();
    }
}

// ======= Daily Digest ä¸»å‡½æ•°ï¼ˆç‹¬ç«‹è¿žæŽ¥/ç‹¬ç«‹å…³é—­ï¼‰ =======
async function runDailyDigest(etDateOpt) {
  const TZ = process.env.TIMEZONE || 'America/Detroit';
  const etDate = etDateOpt || DateTime.now().setZone(TZ).minus({ days: 1 }).toISODate(); // æ˜¨æ—¥ï¼ˆç¾Žä¸œï¼‰
  const startET = DateTime.fromISO(etDate, { zone: TZ }).startOf('day');
  const endET   = startET.endOf('day');
  const startUTC = startET.toUTC().toJSDate();
  const endUTC   = endET.toUTC().toJSDate();

  // ç”¨ç‹¬ç«‹ MongoClientï¼Œä¸å¹²æ‰°ä½ å…¶ä»–è·¯ç”±é‡Œçš„ connect/close
  const localClient = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
  });

  try {
    await localClient.connect();
    const db = localClient.db(database_name);

    // å¹‚ç­‰ï¼ˆå¯åˆ ï¼‰ï¼šå½“å¤©å·²å‘è¿‡å°±è·³è¿‡
    const digests = db.collection('digests');
    const sent = await digests.findOne({ dateET: etDate });
    if (sent && !process.env.DIGEST_FORCE_ON_START) {
      return { ok: true, message: `Already sent for ${etDate}`, skipped: true };
    }

    const docs = await db.collection('hr_questions')
      .find({ created_at: { $gte: startUTC, $lte: endUTC } })
      .sort({ created_at: 1 })
      .toArray();

    const rows = docs.map(d => {
      const createdAtET = DateTime.fromJSDate(d.created_at).setZone(TZ).toFormat('yyyy-LL-dd HH:mm:ss');
      const createdAtUTC = DateTime.fromJSDate(d.created_at).toUTC().toISO();
      const first = (d.firstName || '').trim();
      const last  = (d.lastName || '').trim();
      return {
        _id: String(d._id),
        question: d.question,
        phone: d.phone,
        email: d.email,
        firstName: first,
        lastName: last,
        fullName: [first, last].filter(Boolean).join(' '),
        emailed: d.emailed,
        resolved: d.resolved,
        createdAtET,
        createdAtUTC,
      };
    });

    const html = buildDigestHtml({ etDate, rows });
    const csvBuffer = await rowsToCsvBuffer(rows);
    const to = (process.env.EMAIL_TO || '').split(',').map(s => s.trim()).filter(Boolean);

    if (to.length) {
      await sendEmail({
        to,
        subject: `Daily HR Question Debrief ${etDate}(EST) - Total ${rows.length} Items`,
        html,
        attachments: [{ filename: `questions_${etDate}.csv`, content: csvBuffer, contentType: 'text/csv' }],
      });
    }

    await digests.updateOne(
      { dateET: etDate },
      { $set: { dateET: etDate, count: rows.length, sentAt: new Date(), recipients: to } },
      { upsert: true }
    );

    return { ok: true, count: rows.length, dateET: etDate };
  } catch (err) {
    console.error('âŒ Daily digest error:', err);
    const alertTo = (process.env.ALERT_EMAIL || '').split(',').filter(Boolean);
    if (alertTo.length) {
      try {
        await sendEmail({
          to: alertTo,
          subject: '[Error]Daily HR Question Debrief Failed',
          text: String(err && err.stack || err),
        });
      } catch (_) {}
    }
    return { ok: false, error: String(err) };
  } finally {
    await localClient.close();
  }
}

app.get("/status", async (req, res) => {
    try {
        const response = await axios.get(`${FAISS_SERVER_URL}/status`);
        res.json(response.data);
    } catch (error) {
        console.error("âŒ Error calling FAISS server:", error.message);
        res.status(500).json({ error: "Could not connect to FAISS server." });
    }
});

// âœ… Route: Chat with AI
app.post("/chat", async (req, res) => {
    console.log("ðŸŸ¢ Received chat request:", req.body);

    try {
        const { query } = req.body;  // âŒ This should be "question"
        if (!query) {
            return res.status(400).json({ error: "Missing 'query' parameter." });
        }

        const response = await axios.post(`${FAISS_SERVER_URL}/chat`, { question: query }, { timeout: 30000 });

        console.log("âœ… Chat response received:", response.data);
        return res.json(response.data);
    } catch (error) {
        console.error("âŒ Error calling FAISS server:", error.message, error.response?.data);

        if (error.response) {
            return res.status(error.response.status).json(error.response.data);
        }

        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
});

app.post('/api/hr-question', async (req, res) => {
  try {
    const { question, phone, email, firstName, lastName } = req.body;
    if (!question) return res.status(400).send('Question is required');

    await client.connect();
    const db = client.db(database_name);

    // å…ˆå†™å…¥ emailed: falseï¼›å‘é‚®ä»¶æˆåŠŸå†æ”¹ trueï¼ˆé¿å…â€œå†™å‡â€ï¼‰
    const insert = await db.collection('hr_questions').insertOne({
      question,
      phone,
      email,
      firstName,
      lastName,
      created_at: new Date(),
      emailed: false,
      resolved: false,
    });

    // ç»„è£…å¹¶å‘é€é‚®ä»¶ï¼ˆå¦‚æžœæ²¡é…ç½®æ”¶ä»¶äººå°±è·³è¿‡ï¼‰
    const to = (process.env.HR_QUESTION_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (to.length) {
      const subject = 'New HR Question Submitted';
      const text = [
        `Question: ${question}`,
        phone ? `Phone: ${phone}` : '',
        email ? `Email: ${email}` : '',
        (firstName || lastName) ? `Name: ${firstName || ''} ${lastName || ''}` : '',
      ].filter(Boolean).join('\n');

      try {
        await sendEmail({ to, subject, text });
        await db.collection('hr_questions').updateOne(
          { _id: insert.insertedId },
          { $set: { emailed: true } }
        );
      } catch (mailErr) {
        console.error('âš ï¸ å‘é€å•æ¡æäº¤é€šçŸ¥å¤±è´¥ï¼š', mailErr.message);
        // ä¸æŠ›å‡ºï¼Œè®©æäº¤æµç¨‹ä»ç„¶è¿”å›ž 200
      }
    }

    res.status(200).send('Question submitted');
  } catch (err) {
    console.error('Failed to handle HR question', err);
    res.stat×xâÚ$z{-®éÜj×R‚tf—'7BæÖR—2&WV—&VBr’ÀÐ¢&öG’‚vÆ7DæÖRr’ææ÷DV×G’‚’çv—F„ÖW76vR‚tÆ7BæÖR—2&WV—&VBr’ÀÐ¢&öG’‚w77v÷&Br’æ—4ÆVæwF‚‡²Ö–ã¢‚Ò’çv—F„ÖW76vR‚u77v÷&B×W7B&RBÆV7B‚6†&7FW'2ÆöærrÐ¢æÖF6†W2‚õ´Õ¦×¥Òò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæRÆWGFW"rÐ¢æÖF6†W2‚õÆBò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæRçVÖ&W"rÐ¢æÖF6†W2‚õ´BR¢3òeÒò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæR7V6–Â6†&7FW"r’ÀÐ¢ÒÀÐ¢7–æ2‡&WÂ&W2’Óâ°Ð¢6öç7BW'&÷'2ÒfÆ–FF–öå&W7VÇB‡&W“°Ð¢–b‚W'&÷'2æ—4V×G’‚’’°Ð¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷'3¢W'&÷'2æ'&’‚’Ò“°Ð¢ÐÐ¢6öç7B²f—'7DæÖRÂÆ7DæÖRÂ77v÷&BÂG—RÂ†öæTçVÖ&W"ÂVÖ–ÂÒÒ&Wæ&öG“°Ð¢òòW†V7WFRF†R67&—@Ð¢W†V2†æöFRâö&6¶VæB÷6W'fW"÷&Vv—7FW$W‡FW&æÂæÖ§2"G¶f—'7DæÖWÒ""G¶Æ7DæÖWÒ""G·77v÷&GÒ""G·G—WÒ""G·†öæTçVÖ&W'Ò""G¶VÖ–ÇÒ&Â†W'&÷"Â7FF÷WBÂ7FFW'"’Óâ°Ð¢–b†W'&÷"’°Ð¢6öç6öÆRæW'&÷"†W'&÷"W†V7WF–ær67&—C¢G¶W'&÷"æÖW76vWÖ“°Ð¢&W2ç7FGW2ƒS’ç6VæB†–çFW&æÂ6W'fW"W'&÷#¢G¶W'&÷"æÖW76vWÖ“°Ð¢&WGW&ã°Ð¢ÐÐ¢6öç6öÆRæÆör‡7FF÷WB“°Ð¢–b‡7FF÷WBæ–æ6ÇVFW2‚%&Vv—7FW"fÆ–C¢G'VR"’’°Ð¢&W2ç7FGW2ƒ#’ç6VæB‚%&Vv—7FW"7V66W76gVÂ"“°Ð¢ÒVÇ6R°Ð¢&W2ç7FGW2ƒC’ç6VæB‚%&Vv—7FW"f–ÆVB"“°Ð¢ÐÐ¢Ò“°Ð¢ÐÐ¢“°Ð Ð¦ç÷7B‚rö’÷7V&Ö—BÖfVVF&6²rÂ7–æ2‡&WÂ&W2’Óâ°Ð¢G'’°Ð¢òò&WG&–WfRF†RfVVF&6²FFg&öÒF†R&WVW7B&öGÐ¢6öç7B²æÖRÂfVVF&6²ÒÒ&Wæ&öG“°Ð Ð¢òò6öææV7BFòÖöævôD Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç6öÆRæÆör‚t6öææV7FVBFòÖöævôD"r“°Ð Ð¢òò66W72F†RFF&6PÐ¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vfVVF&6²r“°Ð Ð¢òò–ç6W'BF†RfVVF&6²FF–çFòF†RÖöævôD"6öÆÆV7F–öàÐ¢v—B6öÆÆV7F–öâæ–ç6W'DöæR‡²æÖRÂfVVF&6²ÂF–ÖW7F×¢æWrFFR‚’Ò“°Ð Ð¢6öç6öÆRæÆör‚tfVVF&6²FF–ç6W'FVB7V66W76gVÆÇ’r“°Ð¢&W2ç7FGW2ƒ#’ç6VæB‚tfVVF&6²&V6V—fVB7V66W76gVÆÇ’r“°Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ærfVVF&6²7V&Ö—76–öã¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢òò6Æ÷6RF†RÖöævôD"6öææV7F–öàÐ¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢6öç6öÆRæÆör‚t6öææV7F–öâFòÖöævôD"6Æ÷6VBr“°Ð¢ÐÐ§Ò“°Ð Ð¦ç÷7B‚rö’öfWF6‚ÖWfVçG2rÂ7–æ2‡&WÂ&W2’Óâ°Ð¢G'’°Ð¢òò6öææV7BFòÖöævôD Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç6öÆRæÆör‚t6öææV7FVBFòÖöævôD"r“°Ð¢òò66W72F†RFF&6PÐ¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vWfVçG2r“°Ð¢6öç7BFFÒv—B6öÆÆV7F–öâæf–æB‚’çFô'&’‚“°Ð¢òò6†V6²–bFF—2&WG&–WfV@Ð¢–b‚FFÇÂFFæÆVæwF‚ÓÓÒ’°Ð¢6öç6öÆRæW'&÷"‚tæòFFf÷VæB–âÖöævôD"6öÆÆV7F–öâr“°Ð¢&W2ç7FGW2ƒCB’ç6VæB‚tæòFFf÷VæBr“°Ð¢&WGW&ã°Ð¢ÐÐ¢&W2æ§6öâ†FF“°Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ærWfVçBfWF6†–æs¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢òò6Æ÷6RF†RÖöævôD"6öææV7F–öàÐ¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢6öç6öÆRæÆör‚t6öææV7F–öâFòÖöævôD"6Æ÷6VBr“°Ð¢ÐÐ§Ò“°Ð Ð¦ç÷7B‚rö’÷&Vv—7FW%÷Fö¶VârÂ‡&WÂ&W2’Óâ°Ð¢G'’°Ð¢6öç7B²Fö¶VâÂW6W"ÒÒ&Wæ&öG“°Ð¢6öç6öÆRæÆör‚u&V6V—fVBFö¶Vã¢rÂFö¶Vâ“°Ð¢6öç6öÆRæÆör‚u&V6V—fVBW6W"–æfó¢rÂW6W"“°Ð Ð¢6öç7Bf—'7DæÖRÒW6W"çW6W$f—'7DæÖS²ò÷&Wæ&öG’æf—'7DæÖS°Ð¢6öç7BÆ7DæÖRÒW6W"çW6W$Æ7DæÖS²ò÷&Wæ&öG’æÆ7DæÖS°Ð Ð¢òòW†V7WFRF†R67&—BæB72F†RFV×÷&'’f–ÆRF‚2â&wVÖVç@Ð¢W†V2†æöFRâö&6¶VæB÷6W'fW"÷WFFTV×Æ÷–VUFö¶VâæÖ§2"G¶f—'7DæÖWÒ""G¶Æ7DæÖWÒ""G·Fö¶VçÒ&Â†W'&÷"Â7FF÷WBÂ7FFW'"’Óâ°Ð¢–b†W'&÷"’°Ð¢6öç6öÆRæW'&÷"†W'&÷"W†V7WF–ær67&—C¢G¶W'&÷"æÖW76vWÖ“°Ð¢&W2ç7FGW2ƒS’ç6VæB†–çFW&æÂ6W'fW"W'&÷#¢G¶W'&÷"æÖW76vWÖ“°Ð¢&WGW&ã°Ð¢ÐÐ Ð¢&W2ç7FGW2ƒ#’æ§6öâ‡²ÖW76vS¢uFö¶VâæBW6W"–æfò&V6V—fVB7V66W76gVÆÇ’rÒ“°Ð¢Ò“°Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ær77v÷&B&W6WC¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢ÐÐ§Ò“°Ð Ð¦ç÷7B‚rö’÷&W6WB×77v÷&BrÀÐ¢°Ð¢&öG’‚wW6W$–Br’ææ÷DV×G’‚’çv—F„ÖW76vR‚uW6W"”B—2&WV—&VBr’ÀÐ¢&öG’‚væWu77v÷&BrÐ¢æ—4ÆVæwF‚‡²Ö–ã¢‚Ò’çv—F„ÖW76vR‚u77v÷&B×W7B&RBÆV7B‚6†&7FW'2ÆöærrÐ¢æÖF6†W2‚õ´Õ¦×¥Òò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæRÆWGFW"rÐ¢æÖF6†W2‚õÆBò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæRçVÖ&W"rÐ¢æÖF6†W2‚õ´BR¢3òeÒò’çv—F„ÖW76vR‚u77v÷&B×W7B6öçF–âBÆV7BöæR7V6–Â6†&7FW"r’ÀÐ¢ÒÀÐ¢7–æ2‡&WÂ&W2’Óâ°Ð¢6öç7BW'&÷'2ÒfÆ–FF–öå&W7VÇB‡&W“°Ð¢–b‚W'&÷'2æ—4V×G’‚’’°Ð¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²W'&÷'3¢W'&÷'2æ'&’‚’Ò“°Ð¢ÐÐ Ð¢6öç7B²W6W$–BÂæWu77v÷&BÒÒ&Wæ&öG“°Ð¢G'’°Ð¢òò6öææV7BFòÖöævôD Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç6öÆRæÆör‚t6öææV7FVBFòÖöævôD"r“°Ð Ð¢òò66W72F†RFF&6RæB6öÆÆV7F–öàÐ¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vV×Æ÷–VW2r“°Ð Ð¢òòf–æBF†RW6W Ð¢6öç7BW6W"Òv—B6öÆÆV7F–öâæf–æDöæR‡²W6W&æÖS¢W6W$–BÒ“°Ð Ð¢òò6†V6²–bW6W"W†—7G0Ð¢–b‚W6W"’°Ð¢6öç6öÆRæW'&÷"‚tæòfÆ–BÆöv–âf÷VæB–âÖöævôD"6öÆÆV7F–öâr“°Ð¢&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢uW6W"æ÷Bf÷VæBrÒ“°Ð¢&WGW&ã°Ð¢ÐÐ Ð¢òòWFFRF†RW6W"w277v÷&BæB6WBF†R77v÷&B&W6WBFFPÐ¢6öç7BWFFU&W7VÇBÒv—B6öÆÆV7F–öâçWFFTöæR€Ð¢²W6W&æÖS¢W6W$–BÒÀÐ¢²G6WC¢²77v÷&C¢æWu77v÷&BÂ77v÷&E&W6WDFFS¢æWrFFR‚’ÒÐÐ¢“°Ð Ð¢–b‡WFFU&W7VÇBæÖöF–f–VD6÷VçBÓÓÒ’°Ð¢&W2ç7FGW2ƒ#’æ§6öâ‡²ÖW76vS¢u77v÷&B&W6WB7V66W76gVÂrÒ“°Ð¢ÒVÇ6R°Ð¢&W2ç7FGW2ƒS’æ§6öâ‡²ÖW76vS¢tf–ÆVBFòWFFR77v÷&BrÒ“°Ð¢ÐÐ Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ær77v÷&B&W6WC¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢òò6Æ÷6RF†RÖöævôD"6öææV7F–öàÐ¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢6öç6öÆRæÆör‚t6öææV7F–öâFòÖöævôD"6Æ÷6VBr“°Ð¢ÐÐ¢ÐÐ¢“°Ð Ð¢òò’VæGö–çBFò†æFÆRf÷&vWB×77v÷&B&WVW7G0Ð¦ç÷7B‚rö’öf÷&vWB×77v÷&BrÂ7–æ2‡&WÂ&W2’Óâ°Ð¢6öç7B²†öæRÒÒ&Wæ&öG“°Ð¢G'’°Ð¢6öç7BF–v—G2Ò†öæRç&WÆ6R‚õÄBörÂrr“°Ð¢–b†F–v—G2æÆVæwF‚ÓÒ’°Ð¢F‡&÷ræWrW'&÷"‚t–çfÆ–B†öæRçVÖ&W"f÷&ÖBâ×W7B6öçF–âF–v—G2âr“°Ð¢ÐÐ¢6öç7B†öæRÒ‚G¶F–v—G2ç6Æ–6RƒÂ2—Ò’G¶F–v—G2ç6Æ–6Rƒ2Âb—ÒÒG¶F–v—G2ç6Æ–6Rƒb—Ö°Ð¢6öç6öÆRæÆör†f÷&ÖGFVB†öæS¢Gµ†öæWÖ“°Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vV×Æ÷–VW2r“°Ð Ð¢òò6öç7G'V7B&VvW‚GFW&àÐ¢6öç7B&VvW…GFW&âÒâ¢G¶F–v—G2ç7Æ—B‚rr’æ¦ö–â‚râ¢r—Òâ¦°Ð Ð¢òòÖF6‚W6W"'’&VvW€Ð¢6öç7BW6W"Òv—B6öÆÆV7F–öâæf–æDöæR‡°Ð¢†öæS¢²G&VvWƒ¢&VvW…GFW&âÐÐ¢Ò“°Ð¢6öç6öÆRæÆör‡W6W"“°Ð Ð¢–b‚W6W"’°Ð¢6öç6öÆRæW'&÷"‚uW6W"æ÷Bf÷VæBr“°Ð¢&W2ç7FGW2ƒCB’æ§6öâ‡²ÖW76vS¢uW6W"æ÷Bf÷VæBrÒ“°Ð¢&WGW&ã°Ð¢ÐÐ¢VÇ6R°Ð¢6öç7BW6W$–BÒW6W"çW6W&æÖS°Ð¢6öç6öÆRæÆör‡W6W$–B“°Ð Ð¢òòW†V7WFRF†RÔ¥267&—Bv—F‚æV6W76'’&ÖWFW'0Ð¢W†V2†æöFRâö&6¶VæB÷6W'fW"öf÷&vWE77v÷&BæÖ§2"G·W6W$–GÒ""G·W&—Ò""G¶FF&6UöæÖWÒ&Â†W'&÷"Â7FF÷WBÂ7FFW'"’Óâ°Ð¢–b†W'&÷"’°Ð¢6öç6öÆRæW'&÷"†W'&÷"W†V7WF–ær67&—C¢G¶W'&÷"æÖW76vWÖ“°Ð¢&W2ç7FGW2ƒS’ç6VæB†–çFW&æÂ6W'fW"W'&÷#¢G¶W'&÷"æÖW76vWÖ“°Ð¢&WGW&ã°Ð¢ÐÐ Ð¢6öç6öÆRæÆör‡7FF÷WB“°Ð¢&W2ç7FGW2ƒ#’æ§6öâ‡²ÖW76vS¢u77v÷&B&W6WB7V66W76gVÂrÒ“°Ð¢Ò“°Ð¢ÐÐ¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ærf÷&vWB77v÷&C¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢ÐÐ§Ò“°Ð Ð¦ç÷7B‚rö’ö66WBÖF—66Æ–ÖW"rÂ7–æ2‡&WÂ&W2’Óâ°Ð¢7–æ2gVæ7F–öâ7F—fFUW6W$–dæVVFVB‡W6W$–æfòÂ66WFVBÂ6öÆÆV7F–öâ’°Ð¢–b‡W6W$–æfòæ—47F—fFVBÓÒwG'VRrbb66WFVB’°Ð¢òòWFFRW6W"Fò7F—fFR66÷VçBæB6WB7F—fF–öâFFPÐ¢6öç7B&Vv—7G&F–öäFFRÒæWrFFR‚“°Ð¢v—B6öÆÆV7F–öâçWFFTöæR€Ð¢²W6W&æÖS¢²G&VvWƒ¢æWr&VtW‡†âG·W6W$–æfòçW6W&æÖWÒFÂv’r’ÒÒÀÐ¢°Ð¢G6WC¢°Ð¢—47F—fFVC¢wG'VRrÀÐ¢7F—fF–öäFFS¢&Vv—7G&F–öäFFRÀÐ¢t&Vv—7G&F–öâFFRs¢&Vv—7G&F–öäFFPÐ¢ÐÐ¢ÐÐ¢“°Ð¢ÐÐ¢ÐÐ Ð¢7–æ2gVæ7F–öâÆötF—66Æ–ÖW$66WFæ6R‡W6W$–æfòÂ66WFVBÂfW'6–öâÂFWf–6T–æfòÂF"’°Ð¢òòÆör66WFæ6RFWF–Ç2–â6W&FR6öÆÆV7F–öàÐ¢6öç7B66WFæ6U&V6÷&BÒ°Ð¢W6W&æÖS¢W6W$–æfòçW6W&æÖRÀÐ¢66WFVBÀÐ¢fW'6–öâÀÐ¢FWf–6T–æfòÀÐ¢F–ÖW7F×¢æWrFFR‚Ð¢Ó°Ð¢6öç7BÆöt6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vF—66Æ–ÖW"66WFæ6W2r“°Ð¢v—BÆöt6öÆÆV7F–öâæ–ç6W'DöæR†66WFæ6U&V6÷&B“°Ð¢ÐÐ Ð¢G'’°Ð¢6öç7B²66WFVBÂW6W&æÖRÂfW'6–öâÂFWf–6T–æfòÒÒ&Wæ&öG“°Ð Ð¢–b‚66WFVBÇÂW6W&æÖR’°Ð¢&WGW&â&W2ç7FGW2ƒC’ç6VæB‚tÖ—76–ær&WV—&VBf–VÆG2r“°Ð¢ÐÐ Ð¢òò6öææV7BFòÖöævôD Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç6öÆRæÆör‚t6öææV7FVBFòÖöævôD"r“°Ð Ð¢òò66W72F†RFF&6RæB6öÆÆV7F–öàÐ¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vV×Æ÷–VW2r“°Ð Ð¢òòfWF6‚F†RW6W"g&öÒF†RFF&6PÐ¢6öç7BW6W"Òv—B6öÆÆV7F–öâæf–æDöæR‡°Ð¢W6W&æÖS¢²G&VvWƒ¢æWr&VtW‡†âG·W6W&æÖWÒFÂv’r’ÐÐ¢Ò“°Ð Ð¢–b‚W6W"’°Ð¢6öç6öÆRæW'&÷"‚uW6W"æ÷Bf÷VæB–âÖöævôD"6öÆÆV7F–öâr“°Ð¢&WGW&â&W2ç7FGW2ƒCB’ç6VæB‚uW6W"æ÷Bf÷VæBr“°Ð¢ÐÐ Ð¢òò7F—fFRW6W"–bæVVFV@Ð¢v—B7F—fFUW6W$–dæVVFVB‡W6W"Â66WFVBÂ6öÆÆV7F–öâ“°Ð Ð¢òòÆörF†RF—66Æ–ÖW"66WFæ6RFò6W&FR6öÆÆV7F–öàÐ¢v—BÆötF—66Æ–ÖW$66WFæ6R‡W6W"Â66WFVBÂfW'6–öâÂFWf–6T–æfòÂF"“°Ð Ð¢&W2ç7FGW2ƒ#’ç6VæB‚tF—66Æ–ÖW"66WFVBæBÆövvVBr“°Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ærF—66Æ–ÖW"66WFæ6S¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢òòVç7W&RF†RÖöævôD"6öææV7F–öâ—26Æ÷6V@Ð¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢6öç6öÆRæÆör‚t6öææV7F–öâFòÖöævôD"6Æ÷6VBr“°Ð¢ÐÐ§Ò“°Ð Ð¦ç÷7B‚rö’öWF†VçF–6F–öârÂ7–æ2‡&WÂ&W2’Óâ°Ð¢G'’°Ð¢ÆWB²W6W$æÖRÂ77v÷&BÒÒ&Wæ&öG“°Ð¢W6W$æÖRÒW6W$æÖRçG&–Ò‚“°Ð Ð¢òò6öææV7BFòÖöævôD Ð¢v—B6Æ–VçBæ6öææV7B‚“°Ð¢6öç6öÆRæÆör‚t6öææV7FVBFòÖöævôD"r“°Ð Ð¢òò66W72F†RFF&6PÐ¢6öç7BF"Ò6Æ–VçBæF"†FF&6UöæÖR“°Ð¢6öç7B6öÆÆV7F–öâÒF"æ6öÆÆV7F–öâ‚vV×Æ÷–VW2r“°Ð Ð¢6öç7BW6W"Òv—B6öÆÆV7F–öâæf–æB‡°Ð¢W6W&æÖS¢²G&VvWƒ¢æWr&VtW‡†âG·W6W$æÖWÒFÂv’r’ÒÀÐ¢77v÷&C¢77v÷&@Ð¢Ò’çFô'&’‚“°Ð Ð¢–b‚W6W"ÇÂW6W"æÆVæwF‚ÓÓÒ’°Ð¢6öç6öÆRæW'&÷"‚tæòfÆ–BÆöv–âf÷VæB–âÖöævôD"6öÆÆV7F–öâr“°Ð¢&W2ç7FGW2ƒCB’ç6VæB‚ufÆ–FF–öâf–ÆVBr“°Ð¢&WGW&ã°Ð¢ÐÐ Ð¢òòW‡G&7BF†RW6W"ö&¦V7@Ð¢6öç7BW6W$–æfòÒW6W%³Ó°Ð Ð¢&W2æ§6öâ…·W6W$–æfõÒ“²òò&W7öæBv—F‚F†RW6W"–æfò'&Ð¢Ò6F6‚†W'&÷"’°Ð¢6öç6öÆRæW'&÷"‚tW'&÷"†æFÆ–ærfÆ–FF–öã¢rÂW'&÷"æÖW76vR“°Ð¢&W2ç7FGW2ƒS’ç6VæB‚t–çFW&æÂ6W'fW"W'&÷"r“°Ð¢Òf–æÆÇ’°Ð¢òò6Æ÷6RF†RÖöævôD"6öææV7F–öàÐ¢v—B6Æ–VçBæ6Æ÷6R‚“°Ð¢6öç6öÆRæÆör‚t6öææV7F–öâFòÖöævôD"6Æ÷6VBr“°Ð¢ÐÐ§Ò“°Ð Ð¦ævWB‚rö’ö†VÇF‚rÂ‡&WÂ&W2’Óâ°Ð¢&W2æ§6öâ‡²ö³¢G'VRÂF–ÖS¢æWrFFR‚’çFô•4õ7G&–ær‚’ÒÐ§ÒÐ Ð¢òòÓÓÓÓÓÓÒjøþiz^Zé®i{nK»¾XªûÈƒs£RUNûÉ¾XúþiK’æVçbD”tU5Eô5$ôîûÈ’ÓÓÓÓÓÓÐÐ¦7&öâç66†VGVÆR‡&ö6W72æVçbäD”tU5Eô5$ôâÇÂsRr¢¢¢rÂ7–æ2‚’Óâ°Ð¢v—B'VäF–Ç”F–vW7B‚“²òò›¹ŽŠêNk~h¾(	ÎiŠŽiz^ûÈŽ{èîK‰ÎûÈž(	ÐÐ§ÒÂ²F–ÖW¦öæS¢&ö6W72æVçbåD”ÔU¤ôäRÇÂtÖW&–6ôFWG&ö—BrÒ“°Ð Ð¢òòÓÓÓÓÓÓÒh˜¾XªŽŠznXùhê^Xú>ûÉ¢öFÖ–âöF–vW7CöFFSÕ•••’ÔÔÒÔDBÓÓÓÓÓÓÐÐ¦gVæ7F–öâ”¶W”wV&B‡&WÂ&W2ÂæW‡B’°Ð¢6öç7B¶W’Ò&Wæ†VFW'5²w‚Ö’Ö¶W’uÓ°Ð¢–b‚&ö6W72æVçbäDÔ”åô•ô´U’ÇÂ¶W’ÓÓÒ&ö6W72æVçbäDÔ”åô•ô´U’’&WGW&âæW‡B‚“°Ð¢&WGW&â&W2ç7FGW2ƒC’æ§6öâ‡²ö³¢fÇ6RÂW'&÷#¢wVæWF†÷&—¦VBrÒ“°Ð§ÐÐ Ð¦ç÷7B‚röFÖ–âöF–vW7BrÂ”¶W”wV&BÂ7–æ2‡&WÂ&W2’Óâ°Ð¢G'’°Ð¢6öç7BFFTUBÒ‡&WçVW'’æFFRÇÂrr’çG&–Ò‚“²òòKÊz›£Þ›¹ŽŠêNiŠŽizPÐ¢6öç7B&W7VÇBÒv—B'VäF–Ç”F–vW7B†FFTUBÇÂVæFVf–æVB“°Ð¢&W2æ§6öâ‡&W7VÇB“°Ð¢Ò6F6‚†R’°Ð¢&W2ç7FGW2ƒS’æ§6öâ‡²ö³¢fÇ6RÂW'&÷#¢7G&–ær†R’Ò“°Ð¢ÐÐ§Ò“°Ð Ð¦6öç7BöÆDF—"ÒF‚æ¦ö–â…õöF—&æÖRÂrââö6Æ–VçBö'V–ÆBr“°Ð¦çW6R†W‡&W72ç7FF–2†öÆDF—"Â²–æFWƒ¢fÇ6RÒ’“°Ð¦6öç7BæWtF—"ÒF‚æ¦ö–â…õöF—&æÖRÂrââòââöFÖ–â×vV"öF—7Br“°Ð¦çW6R‚röFÖ–ârÂW‡&W72ç7FF–2†æWtF—"’“°Ð¦çW6R‚rö‡"×FööÇ2rÂW‡&W72ç7FF–2†æWtF—"Â²–æFWƒ¢fÇ6RÒ’“°Ð¦çW6R‚röÖ6öç6öÆRrÂW‡&W72ç7FF–2†öÆDF—"Â²–æFWƒ¢fÇ6RÒ’“°Ð Ð¦ævWB‚röFÖ–âò¢rÂ‡&WÂ&W2’Óâ°Ð¢&W2ç6VæDf–ÆR‡F‚æ¦ö–â†æWtF—"Âv–æFW‚æ‡FÖÂr’“°Ð§Ò“°Ð Ð¦ævWB…²rö‡"×FööÇ2rÂrö‡"×FööÇ2÷—&öÆÂ×fW&–f–6F–öârÂrö‡"×FööÇ2ö–ç7W&æ6RÖ'&V¶÷WBrÂrö‡"×FööÇ2ö6öÖÖ—76–öâ×&÷7FW"rÂrö‡"×FööÇ2÷G&–æ–ærrÂrö‡"×FööÇ2ö‡"×ÆFf÷&ÒrÂrö‡"×FööÇ2ö‡"×ÆFf÷&ÒöæWrÖ†—&RrÂrö‡"×FööÇ2ö‡"×ÆFf÷&Ò÷FW&Ö–æF–öârÂrö‡"×FööÇ2ö‡"×ÆFf÷&ÒöV×Æ÷–ÖVçBÖ6†ævRuÒÂ‡&WÂ&W2’Óâ°¢&W2ç6VæDf–ÆR‡F‚æ¦ö–â†æWtF—"Âv–æFW‚æ‡FÖÂr’“°Ð§Ò“°Ð Ð¦ævWB…²röÖ6öç6öÆRrÂröÖ6öç6öÆRò¢uÒÂ‡&WÂ&W2’Óâ°Ð¢6öç7B6W76–öâÒvWE6W76–öäg&öÕ&WVW7B‡&W“°Ð¢–b‚6W76–öâ’&WGW&â&W2ç&VF—&V7B‚röFÖ–âr“°Ð¢&W2ç6VæDf–ÆR‡F‚æ¦ö–â†öÆDF—"Âv–æFW‚æ‡FÖÂr’“°Ð§Ò“°Ð Ð¦ævWB‚ròrÂ‡&WÂ&W2’Óâ°Ð¢&W2ç&VF—&V7B‚röFÖ–âr“°Ð§Ò“°Ð Ð¦ævWB‚õåÂòƒò—ÆFÖ–çÆ‡"×FööÇ2’â¢òÂ‡&WÂ&W2’Óâ°Ð¢&W2ç&VF—&V7B‚röFÖ–âr“°Ð§Ò“°Ð Ð¢òò7F'BF†R6W'fW Ð¦æÆ—7FVâ‡&ö6W72æVçbåõ%BÇÂ÷'BÂ‚’Óâ°Ð¢6öç6öÆRæÆör†6W'fW"—2'Vææ–æröâ÷'BG·÷'GÖ“°Ð¢&V6öæ6–ÆT†—7F÷&–6Ä&Vv—7G&F–öäFFW2‚“°Ð§Ò“°Ð