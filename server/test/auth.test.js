const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { authenticate, optionalAuthenticate, requireAdmin, getToken } = require('../src/middleware/auth');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function token(payload = { id: 7, email: 'member@example.com', role: 'customer' }) {
  return jwt.sign(payload, process.env.JWT_SECRET || 'development-secret');
}

describe('authentication middleware', () => {
  it('reads a bearer token', () => {
    assert.equal(getToken({ headers: { authorization: 'Bearer abc' } }), 'abc');
  });

  it('reads the default cookie when there is no session header', () => {
    assert.equal(getToken({ headers: {}, cookies: { token: 'cookie-token' } }), 'cookie-token');
  });

  it('reads a cookie scoped to a valid browser tab session', () => {
    assert.equal(getToken({ headers: { 'x-session-id': 'tab-123' }, cookies: { 'token_tab-123': 'scoped-token' } }), 'scoped-token');
  });

  it('rejects unsafe session identifiers instead of reading a cookie', () => {
    assert.equal(getToken({ headers: { 'x-session-id': '../admin' }, cookies: { 'token_../admin': 'token' } }), null);
  });

  it('rejects session identifiers longer than 80 characters', () => {
    assert.equal(getToken({ headers: { 'x-session-id': 'x'.repeat(81) }, cookies: {} }), null);
  });

  it('returns null when a valid tab has no scoped cookie', () => {
    assert.equal(getToken({ headers: { 'x-session-id': 'tab-1' }, cookies: { token: 'other-tab-token' } }), null);
  });

  it('returns 401 when there is no token', () => {
    const res = responseRecorder();
    let nextCalled = false;
    authenticate({ headers: {}, cookies: {} }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'กรุณาเข้าสู่ระบบก่อน');
    assert.equal(nextCalled, false);
  });

  it('returns 401 for an invalid token', () => {
    const res = responseRecorder();
    authenticate({ headers: { authorization: 'Bearer not-a-jwt' } }, res, () => assert.fail('next should not run'));
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /เซสชันหมดอายุ/);
  });

  it('attaches a verified user and continues', () => {
    const req = { headers: { authorization: `Bearer ${token()}` } };
    let nextCalled = false;
    authenticate(req, responseRecorder(), () => { nextCalled = true; });
    assert.equal(req.user.id, 7);
    assert.equal(req.user.role, 'customer');
    assert.equal(nextCalled, true);
  });

  it('allows optional authentication to continue anonymously', () => {
    const req = { headers: {}, cookies: {} };
    let nextCalled = false;
    optionalAuthenticate(req, responseRecorder(), () => { nextCalled = true; });
    assert.equal(req.user, undefined);
    assert.equal(nextCalled, true);
  });

  it('ignores an invalid optional token and continues anonymously', () => {
    const req = { headers: { authorization: 'Bearer invalid' } };
    let nextCalled = false;
    optionalAuthenticate(req, responseRecorder(), () => { nextCalled = true; });
    assert.equal(req.user, undefined);
    assert.equal(nextCalled, true);
  });

  it('attaches a valid optional token and continues', () => {
    const req = { headers: { authorization: `Bearer ${token()}` } };
    let nextCalled = false;
    optionalAuthenticate(req, responseRecorder(), () => { nextCalled = true; });
    assert.equal(req.user.email, 'member@example.com');
    assert.equal(nextCalled, true);
  });

  it('allows administrators through the admin guard', () => {
    let nextCalled = false;
    requireAdmin({ user: { role: 'admin' } }, responseRecorder(), () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  it('denies customers at the admin guard', () => {
    const res = responseRecorder();
    let nextCalled = false;
    requireAdmin({ user: { role: 'customer' } }, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'ไม่มีสิทธิ์ใช้งานส่วนนี้');
    assert.equal(nextCalled, false);
  });

  it('denies requests with no user at the admin guard', () => {
    const res = responseRecorder();
    requireAdmin({}, res, () => assert.fail('next should not run'));
    assert.equal(res.statusCode, 403);
  });
});
