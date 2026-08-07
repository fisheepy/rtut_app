const test = require('node:test');
const assert = require('node:assert/strict');
const {
  authorizedEmails,
  authorizedHrToolsEmails,
  createRequireTrainingSession,
  hashTrainingCode,
  isAuthorizedTrainingEmail,
  isAuthorizedHrToolsEmail,
  secureCodeMatch,
} = require('./access');

test('allows only the configured Training Tools email', () => {
  const env = {};
  assert.deepEqual(authorizedEmails(env), [
    'myu@royaltrailersales.com',
    'sdallis@royaltrailersales.com',
    'anicholson@royaltrailersales.com',
    'dpurrenhage@royaltrailersales.com',
  ]);
  assert.equal(isAuthorizedTrainingEmail('MYU@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedTrainingEmail('sdallis@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedTrainingEmail('anicholson@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedTrainingEmail('dpurrenhage@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedTrainingEmail('someone@royaltrailersales.com', env), false);
});

test('allows only Myra and Stratos into the HR Tools hub', () => {
  const env = {};
  assert.deepEqual(authorizedHrToolsEmails(env), [
    'myu@royaltrailersales.com',
    'sdallis@royaltrailersales.com',
  ]);
  assert.equal(isAuthorizedHrToolsEmail('myu@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedHrToolsEmail('SDALLIS@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedHrToolsEmail('anicholson@royaltrailersales.com', env), false);
  assert.equal(isAuthorizedHrToolsEmail('dpurrenhage@royaltrailersales.com', env), false);
});

test('supports a future comma-separated allowlist', () => {
  const env = { TRAINING_AUTHORIZED_EMAILS: 'one@example.com, Two@example.com ' };
  assert.deepEqual(authorizedEmails(env), ['one@example.com', 'two@example.com']);
});

test('hashes and compares one-time codes without storing plaintext', () => {
  const hash = hashTrainingCode('myu@royaltrailersales.com', '123456', 'secret');
  assert.equal(secureCodeMatch(hash, hash), true);
  assert.equal(secureCodeMatch(hash, hashTrainingCode('myu@royaltrailersales.com', '654321', 'secret')), false);
});

test('rejects a Training Tools session for another email', () => {
  const middleware = createRequireTrainingSession(() => ({ email: 'other@example.com' }), {});
  let statusCode;
  let responseBody;
  middleware({}, {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  }, () => assert.fail('next should not be called'));
  assert.equal(statusCode, 401);
  assert.equal(responseBody.error, 'Training Tools authentication required');
});

test('reuses an authorized HR Tools session for Training Tools', () => {
  const middleware = createRequireTrainingSession(() => ({
    email: 'myu@royaltrailersales.com',
    type: 'hr-tools',
  }), {});
  let nextCalled = false;
  const request = {};
  middleware(request, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(request.adminSession.type, 'hr-tools');
});
