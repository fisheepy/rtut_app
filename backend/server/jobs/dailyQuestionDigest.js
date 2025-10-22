// jobs/dailyQuestionDigest.js
const { DateTime } = require('luxon');
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const { stringify } = require('fast-csv');
const { Readable } = require('stream');
const crypto = require('crypto');

const TZ = process.env.TIMEZONE || 'America/Detroit';
const CRON = process.env.DIGEST_CRON || '5 7 * * *'; // 每天 07:05(美东)
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@example.com';
const EMAIL_TO = (process.env.EMAIL_TO || 'yang.y.wl@gmail.com').split(',').map(s => s.trim()).filter(Boolean);
const ALERT_EMAIL = process.env.ALERT_EMAIL || '';

function utcRangeForETDay(etDateStr) {
  const startET = DateTime.fromISO(etDateStr, { zone: TZ }).startOf('day');
  const endET   = startET.endOf('day');
  return { startUTC: startET.toUTC().toJSDate(), endUTC: endET.toUTC().toJSDate() };
}
function yesterdayETStr(now = DateTime.now().setZone(TZ)) {
  return now.minus({ days: 1 }).toISODate();
}
function checksumIds(ids) {
  return crypto.createHash('sha256').update(ids.join(','), 'utf8').digest('hex');
}

function htmlOf({ etDate, total, rows }) {
  const solved = rows.filter(r => r.resolved === true).length;
  const unsolved = total - solved;
  const trs = rows.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${r.createdAtET}</td>
      <td>${(r.question||'').replace(/</g,'&lt;')}</td>
      <td>${r.fullName||''}</td>
      <td>${r.email||''}</td>
      <td>${r.phone||''}</td>
      <td>${r.emailed===true?'Yes':'No'}</td>
      <td>${r.resolved===true?'Yes':'No'}</td>
      <td>${r._id}</td>
    </tr>`).join('');
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
    <h2>Daily HR Questions Debrief(${etDate} US East)</h2>
    <p>Total:<b>${total}</b>;Resovled:<b>${solved}</b>;Unresolved:<b>${unsolved}</b></p>
    <table border="1" cellspacing="0" cellpadding="6">
      <thead><tr>
        <th>#</th><th>Time(EST)</th><th>Question</th><th>Name</th><th>Email</th>
        <th>Phone</th><th>Emailed</th><th>Resolved</th><th>ID</th>
      </tr></thead>
      <tbody>${trs || '<tr><td colspan="9">(No Data)</td></tr>'}</tbody>
    </table>
    <p style="color:#666">* Attached CSV with details</p>
  </div>`;
}

function rowsToCsvBuffer(rows) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const stream = stringify({ headers: true })
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
      emailed: r.emailed === true,
      resolved: r.resolved === true,
      id: r._id,
    }))).pipe(stream);
  });
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function runDigest({ db, dateET = yesterdayETStr(), force = false }) {
  const { startUTC, endUTC } = utcRangeForETDay(dateET);

  const digests = db.collection('digests');
  const sent = await digests.findOne({ dateET });
  if (sent && !force) return { ok:true, message:`Already sent for ${dateET}`, skipped:true };

  const docs = await db.collection('hr_questions')
    .find({ created_at: { $gte: startUTC, $lte: endUTC } })
    .sort({ created_at: 1 })
    .toArray();

  const rows = docs.map(d => {
    const createdAtET = DateTime.fromJSDate(d.created_at).setZone(TZ).toFormat('yyyy-LL-dd HH:mm:ss');
    const createdAtUTC = DateTime.fromJSDate(d.created_at).toUTC().toISO();
    const first = (d.firstName||'').trim();
    const last  = (d.lastName||'').trim();
    const fullName = [first,last].filter(Boolean).join(' ');
    return {
      _id: String(d._id),
      question: d.question, phone: d.phone, email: d.email,
      firstName:first, lastName:last, fullName,
      emailed:d.emailed, resolved:d.resolved,
      createdAtET, createdAtUTC,
    };
  });

  const html = htmlOf({ etDate: dateET, total: rows.length, rows });
  const csv = await rowsToCsvBuffer(rows);
  const ids = rows.map(r=>r._id);
  const checksum = checksumIds(ids);

  const transporter = makeTransporter();
  await transporter.sendMail({
    from: EMAIL_FROM,
    to: EMAIL_TO.join(','),
    subject: `Daily HR Questions Debrief ${dateET}(EST)) - Total ${rows.length} Items`,
    html,
    attachments: [{ filename:`questions_${dateET}.csv`, content: csv, contentType:'text/csv' }],
  });

  await digests.updateOne(
    { dateET },
    { $set: { dateET, count: rows.length, questionIds: ids, checksum, recipients: EMAIL_TO, sentAt: new Date() } },
    { upsert: true }
  );

  return { ok:true, count: rows.length, dateET };
}

function scheduleDigest({ db }) {
  cron.schedule(CRON, async () => {
    try { await runDigest({ db }); }
    catch (err) {
      if (!ALERT_EMAIL) return;
      try {
        await makeTransporter().sendMail({
          from: EMAIL_FROM, to: ALERT_EMAIL,
          subject: '[Warning]Daily HR Questions Email Failed',
          html: `<pre>${(err && err.stack) || String(err)}</pre>`,
        });
      } catch (_) {}
    }
  }, { timezone: TZ });
}

module.exports = { runDigest, scheduleDigest };
