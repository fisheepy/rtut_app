const STAGING_DATABASE = /^rtut_staging_[a-z0-9_]+$/;

function runtimePolicy(env = process.env) {
  const environment = env.APP_ENV || 'production';
  if (!['production', 'staging', 'test'].includes(environment)) throw new Error('Invalid APP_ENV');
  const isolated = environment !== 'production';
  const enabled = name => env[name] === undefined ? !isolated : env[name] === 'true';
  return { environment, isolated, startupReconciliation: enabled('STARTUP_RECONCILIATION_ENABLED'),
    scheduledJobs: enabled('SCHEDULED_JOBS_ENABLED'), notifications: !isolated,
    externalAi: !isolated || env.STAGING_EXTERNAL_AI_ENABLED === 'true' };
}

function databaseConfig(env = process.env) {
  const policy = runtimePolicy(env);
  const databaseName = env.MONGODB_DATABASE;
  if (!databaseName) throw new Error('MONGODB_DATABASE is required');
  if (policy.isolated && !STAGING_DATABASE.test(databaseName)) {
    throw new Error('Staging/test requires a database named rtut_staging_<suffix>');
  }
  const uri = env.MONGODB_URI || `mongodb+srv://${encodeURIComponent(env.MONGODB_USERNAME || '')}:${encodeURIComponent(env.MONGODB_PASSWORD || '')}@${env.MONGODB_HOST}/?retryWrites=true&w=majority&appName=${encodeURIComponent(databaseName)}`;
  return { uri, databaseName };
}

function requireNotificationDelivery(env = process.env) {
  if (!runtimePolicy(env).notifications) throw new Error('Novu delivery and subscriber changes are disabled in staging/test');
}

function assertMailRecipients(message, env = process.env) {
  if (!runtimePolicy(env).isolated) return;
  if (message.raw || message.envelope) throw new Error('Raw mail and custom envelopes are disabled in staging/test');
  const allowed = new Set(String(env.STAGING_EMAIL_ALLOWLIST || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean));
  const recipients = [message.to, message.cc, message.bcc].flat().filter(Boolean);
  const addresses = recipients.flatMap(value => typeof value === 'object' ? [value.address] : String(value).split(','));
  if (!addresses.length || addresses.some(address => !allowed.has(String(address).trim().toLowerCase()))) {
    throw new Error('Email recipient is not on STAGING_EMAIL_ALLOWLIST');
  }
}

module.exports = { runtimePolicy, databaseConfig, requireNotificationDelivery, assertMailRecipients };
