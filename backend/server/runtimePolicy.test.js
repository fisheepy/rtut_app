const test = require('node:test');
const assert = require('node:assert/strict');
const { runtimePolicy, databaseConfig, requireNotificationDelivery, assertMailRecipients } = require('./runtimePolicy');

test('production defaults are preserved and isolated environments disable side effects', () => {
  assert.equal(runtimePolicy({}).startupReconciliation, true);
  assert.equal(runtimePolicy({}).scheduledJobs, true);
  for (const APP_ENV of ['staging', 'test']) {
    const policy = runtimePolicy({ APP_ENV });
    for (const key of ['startupReconciliation', 'scheduledJobs', 'notifications', 'externalAi']) assert.equal(policy[key], false);
    assert.throws(() => requireNotificationDelivery({ APP_ENV }));
  }
  assert.throws(() => runtimePolicy({ APP_ENV: 'stagng' }));
});

test('staging refuses a production database and escapes MongoDB credentials', () => {
  assert.throws(() => databaseConfig({ APP_ENV: 'staging', MONGODB_DATABASE: 'production' }));
  assert.throws(() => databaseConfig({ APP_ENV: 'test' }));
  const config = databaseConfig({ APP_ENV: 'staging', MONGODB_DATABASE: 'rtut_staging_local', MONGODB_USERNAME: 'user@example', MONGODB_PASSWORD: 'p@ss:/word', MONGODB_HOST: 'example.test' });
  assert.equal(config.databaseName, 'rtut_staging_local');
  assert.match(config.uri, /user%40example:p%40ss%3A%2Fword@example.test/);
});

test('staging email checks every recipient and prevents envelope bypass', () => {
  const env = { APP_ENV: 'staging', STAGING_EMAIL_ALLOWLIST: 'tester@example.test' };
  assert.doesNotThrow(() => assertMailRecipients({ to: 'tester@example.test' }, env));
  assert.doesNotThrow(() => assertMailRecipients({ to: { name: 'Tester', address: 'tester@example.test' } }, env));
  for (const message of [
    { to: 'employee@example.test' },
    { to: 'tester@example.test', bcc: 'employee@example.test' },
    { to: 'tester@example.test', cc: ['tester@example.test', 'employee@example.test'] },
    { to: 'tester@example.test', envelope: { to: 'employee@example.test' } },
    { to: 'tester@example.test', raw: 'To: employee@example.test' },
  ]) assert.throws(() => assertMailRecipients(message, env));
  assert.throws(() => assertMailRecipients({ to: 'tester@example.test' }, { APP_ENV: 'staging' }));
});

test('staging backfill and AI do not access their database or external services', async () => {
  const previous = process.env.APP_ENV;
  process.env.APP_ENV = 'staging';
  try {
    const db = new Proxy({}, { get() { throw new Error('Unexpected database access'); } });
    const { ensureNovemberSalaryEmploymentChanges } = require('./hrPlatform/novemberSalaryBackfill');
    assert.equal((await ensureNovemberSalaryEmploymentChanges(db)).skipped, true);
    const { answerWithSmartAi } = require('./executive/smartAi');
    assert.equal(await answerWithSmartAi({ db, question: 'test' }), null);
  } finally {
    if (previous === undefined) delete process.env.APP_ENV; else process.env.APP_ENV = previous;
  }
});

test('isolated employee scripts load without a Novu secret and notification calls fail closed', async () => {
  const values = { APP_ENV: 'test', MONGODB_DATABASE: 'rtut_staging_import', MONGODB_URI: 'mongodb://127.0.0.1:1/', NOVU_API: undefined, NOVU_SECRET_KEY: undefined };
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  try {
    await import('./mongodbUtilities.mjs');
    const notifications = await import('./novuUtilities.mjs');
    await assert.rejects(notifications.sendNotification('test', [], {}), /disabled/);
    await assert.rejects(notifications.deleteNotification('test'), /disabled/);
    await assert.rejects(notifications.updateEmployeeToNovuSubscriber({}), /disabled/);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
