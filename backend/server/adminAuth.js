const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const COOKIE_NAME = 'rtut_admin_session';
const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS || 8);
const SESSION_MAX_AGE_MS = SESSION_HOURS * 60 * 60 * 1000;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

function getSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_API_KEY || process.env.MONGODB_PASSWORD || 'dev-only-session-secret';
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function createSessionToken(admin) {
  const now = Date.now();
  const payload = base64UrlEncode(JSON.stringify({
    firstName: admin['First Name'] || admin.firstName,
    lastName: admin['Last Name'] || admin.lastName,
    email: admin.Email || admin.email || admin['Google Email'] || null,
    type: admin.Type || admin.type || 'admin',
    iat: now,
    exp: now + SESSION_MAX_AGE_MS,
  }));
  return `${payload}.${signPayload(payload)}`;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return header.split(';').reduce((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (key) acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

function verifySessionToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = signPayload(payload);
  if (signature.length !== expected.length) return null;
  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;

  const session = JSON.parse(base64UrlDecode(payload));
  if (!session.exp || Date.now() > session.exp) return null;
  return session;
}

function cookieOptions(maxAgeMs = SESSION_MAX_AGE_MS) {
  const secure = process.env.NODE_ENV === 'production';
  return [
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function setSessionCookie(res, admin) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(createSessionToken(admin))}; ${cookieOptions()}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

function getSessionFromRequest(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  try {
    return verifySessionToken(token);
  } catch (_) {
    return null;
  }
}

function requireAdminSession(req, res, next) {
  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ error: 'Admin authentication required' });
  req.adminSession = session;
  return next();
}

function publicAdminAuthRoutes() {
  return ['/api/admin-auth/me', '/api/admin-auth/otp-login', '/api/admin-auth/google', '/api/admin-auth/logout'];
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function adminEmailQuery(email) {
  const normalized = String(email || '').trim().toLowerCase();
  const exact = new RegExp(`^${escapeRegex(normalized)}$`, 'i');
  return {
    $or: [
      { Email: exact },
      { email: exact },
      { 'Google Email': exact },
      { 'Google Emails': exact },
      { googleEmail: exact },
      { googleEmails: exact },
      { 'Test Google Email': exact },
      { testGoogleEmail: exact },
      { 'Allowed Google Emails': exact },
      { allowedGoogleEmails: exact },
      { 'Allowed Emails': exact },
      { allowedEmails: exact },
    ],
  };
}

async function findAdminByName(db, firstName, lastName) {
  return db.collection('admins').findOne({ 'First Name': firstName, 'Last Name': lastName });
}

async function findAdminByEmail(db, email) {
  return db.collection('admins').findOne(adminEmailQuery(email));
}

async function validateOtpAdmin(db, firstName, lastName, enteredCode) {
  const admin = await findAdminByName(db, firstName, lastName);
  if (!admin) return null;
  const elapsedTime = Date.now() - admin.timestamp;
  if ((elapsedTime > 0) && (elapsedTime < 3 * 60 * 1000) && admin.requestedCode === enteredCode) {
    return admin;
  }
  return null;
}

async function verifyGoogleCredential(credential) {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    throw new Error('Google sign-in is not configured. Missing GOOGLE_CLIENT_ID.');
  }
  const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    throw new Error('Google account email is not verified.');
  }
  return payload;
}

function publicSession(session) {
  if (!session) return null;
  return {
    firstName: session.firstName,
    lastName: session.lastName,
    email: session.email,
    type: session.type,
    expiresAt: new Date(session.exp).toISOString(),
  };
}

module.exports = {
  clearSessionCookie,
  findAdminByEmail,
  getSessionFromRequest,
  publicSession,
  requireAdminSession,
  publicAdminAuthRoutes,
  setSessionCookie,
  validateOtpAdmin,
  verifyGoogleCredential,
};
