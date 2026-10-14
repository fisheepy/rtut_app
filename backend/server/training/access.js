const crypto = require('crypto');

const DEFAULT_AUTHORIZED_EMAILS = [
  'myu@royaltrailersales.com',
  'sdallis@royaltrailersales.com',
  'anicholson@royaltrailersales.com',
  'dpurrenhage@royaltrailersales.com',
];
const DEFAULT_HR_TOOLS_EMAILS = [
  'myu@royaltrailersales.com',
  'sdallis@royaltrailersales.com',
];
const DEFAULT_COMPENSATION_EMAILS = [
  'apigeon@royaltrailersales.com',
  'jigielski@royaltrailersales.com',
  'kbumgardner@royaltrailersales.com',
  'myu@royaltrailersales.com',
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function authorizedEmails(env = process.env) {
  const configured = String(env.TRAINING_AUTHORIZED_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_AUTHORIZED_EMAILS;
}

function isAuthorizedTrainingEmail(email, env = process.env) {
  return authorizedEmails(env).includes(normalizeEmail(email));
}

function authorizedHrToolsEmails(env = process.env) {
  const configured = String(env.HR_TOOLS_AUTHORIZED_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_HR_TOOLS_EMAILS;
}

function isAuthorizedHrToolsEmail(email, env = process.env) {
  return authorizedHrToolsEmails(env).includes(normalizeEmail(email));
}

function authorizedCompensationEmails(env = process.env) {
  const configured = String(env.COMPENSATION_AUTHORIZED_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_COMPENSATION_EMAILS;
}

function isAuthorizedCompensationEmail(email, env = process.env) {
  return authorizedCompensationEmails(env).includes(normalizeEmail(email));
}

function hashTrainingCode(email, code, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${normalizeEmail(email)}:${String(code)}`)
    .digest('hex');
}

function secureCodeMatch(actualHash, expectedHash) {
  if (!actualHash || !expectedHash || actualHash.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedHash));
}

function createRequireTrainingSession(getSessionFromRequest, env = process.env) {
  return (req, res, next) => {
    const session = getSessionFromRequest(req);
    if (!session || !isAuthorizedTrainingEmail(session.email, env)) {
      return res.status(401).json({ error: 'Training Tools authentication required' });
    }
    req.adminSession = session;
    return next();
  };
}

function createRequireHrToolsSession(getSessionFromRequest, env = process.env) {
  return (req, res, next) => {
    const session = getSessionFromRequest(req);
    if (!session || !isAuthorizedHrToolsEmail(session.email, env)) {
      return res.status(401).json({ error: 'HR Tools authentication required' });
    }
    req.adminSession = session;
    return next();
  };
}

function createRequireCompensationSession(getSessionFromRequest, env = process.env) {
  return (req, res, next) => {
    const session = getSessionFromRequest(req);
    if (!session || !isAuthorizedCompensationEmail(session.email, env)) {
      return res.status(401).json({ error: 'Compensation Analysis authentication required' });
    }
    req.adminSession = session;
    return next();
  };
}

module.exports = {
  authorizedEmails,
  authorizedHrToolsEmails,
  authorizedCompensationEmails,
  createRequireCompensationSession,
  createRequireTrainingSession,
  createRequireHrToolsSession,
  hashTrainingCode,
  isAuthorizedTrainingEmail,
  isAuthorizedHrToolsEmail,
  isAuthorizedCompensationEmail,
  normalizeEmail,
  secureCodeMatch,
};
