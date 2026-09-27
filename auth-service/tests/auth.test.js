const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

test('auth-service: bcrypt password hashing and comparison', async () => {
  const password = 'StrongPassword123!';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);

  assert.notEqual(hash, password);
  assert.equal(typeof hash, 'string');

  const isMatch = await bcrypt.compare(password, hash);
  assert.equal(isMatch, true);

  const isWrongMatch = await bcrypt.compare('WrongPassword456!', hash);
  assert.equal(isWrongMatch, false);
});

test('auth-service: JWT token generation and verification', () => {
  const secret = 'test_secret_for_finguard_unit_test';
  const payload = {
    userId: '11111111-2222-3333-4444-555555555555',
    email: 'user@example.com',
    fullName: 'Jane Doe',
  };

  const token = jwt.sign(payload, secret, { expiresIn: '1h' });
  assert.equal(typeof token, 'string');

  const decoded = jwt.verify(token, secret);
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.email, payload.email);
  assert.equal(decoded.fullName, payload.fullName);

  assert.throws(() => {
    jwt.verify(token, 'invalid_different_secret');
  });
});

test('auth-service: email and input validation logic', () => {
  const validator = require('validator');

  assert.equal(validator.isEmail('valid.user@fintech.io'), true);
  assert.equal(validator.isEmail('not-an-email'), false);
  assert.equal(validator.isEmail('missing@domain'), false);

  const isPasswordValid = (pwd) => typeof pwd === 'string' && pwd.length >= 8;
  assert.equal(isPasswordValid('12345678'), true);
  assert.equal(isPasswordValid('short'), false);
});

test('auth-service: Prometheus metrics registry produces valid metrics', async () => {
  const { register, httpRequestsTotal, authLoginsTotal } = require('../src/metrics');
  
  httpRequestsTotal.inc({ method: 'GET', route: '/health', status_code: '200' });
  authLoginsTotal.inc({ status: 'success' });

  const metricsOutput = await register.metrics();
  assert.ok(typeof metricsOutput === 'string');
  assert.ok(metricsOutput.includes('http_requests_total'));
  assert.ok(metricsOutput.includes('auth-service'));
  assert.ok(metricsOutput.includes('auth_logins_total'));
});
