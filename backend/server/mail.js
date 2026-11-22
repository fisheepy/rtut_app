const nodemailer = require('nodemailer');
const { assertMailRecipients } = require('./runtimePolicy');

function makeTransporter() {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return { sendMail(message) {
    assertMailRecipients(message);
    return transport.sendMail(message);
  } };
}

function sendEmail(message) {
  return makeTransporter().sendMail({ from: process.env.EMAIL_FROM || 'no-reply@example.com', ...message });
}
module.exports = { makeTransporter, sendEmail };
