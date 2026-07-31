const test = require('node:test');
const assert = require('node:assert/strict');
const {
  authorizedEmails,
  createRequireTrainingSession,
  hashTrainingCode,
  isAuthorizedTrainingEmail,
  secureCodeMatch,
} = require('./access');

test('allows only the configured Training Tools email', () => {
  const env = {};
  assert.deepEqual(authorizedEmails(env), ['myu@royaltrailersales.com']);
  assert.equal(isAuthorizedTrainingEmail('MYU@royaltrailersales.com', env), true);
  assert.equal(isAuthorizedTrainingEmail('someone@royaltrailersales.com', env), false);
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
