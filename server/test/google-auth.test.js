const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { invoke, loadRouter } = require('./helpers/router');

const state = { payload: null, user: null, inserted: false, updates: [] };
class FakeOAuthClient {
  async verifyIdToken() {
    if (state.payload instanceof Error) throw state.payload;
    return { getPayload: () => state.payload };
  }
}

const googleModulePath = require.resolve('google-auth-library');
const oldGoogleModule = require.cache[googleModulePath];
require.cache[googleModulePath] = {
  id: googleModulePath,
  filename: googleModulePath,
  loaded: true,
  exports: { OAuth2Client: FakeOAuthClient }
};

const pool = {
  async query(sql, params = []) {
    if (sql.startsWith('SELECT id, email, password_hash, google_id')) return [[...(state.user ? [state.user] : [])], []];
    if (sql.startsWith('UPDATE users SET google_id')) { state.updates.push(params); return [{ affectedRows: 1 }, []]; }
    if (sql.startsWith('INSERT INTO users')) { state.inserted = true; return [{ insertId: 501 }, []]; }
    return [[], []];
  }
};
const router = loadRouter('../../src/routes/auth', pool);
if (oldGoogleModule) require.cache[googleModulePath] = oldGoogleModule;
else delete require.cache[googleModulePath];

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe('Google authentication route branches', () => {
  it('rejects failed verification and payloads without verified identity', async () => {
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    try {
      state.payload = new Error('bad credential');
      assert.equal((await invoke(router, '/google', { method: 'POST', body: { credential: 'bad' } })).status, 401);
      state.payload = { sub: '', email: 'person@example.com', email_verified: true };
      assert.equal((await invoke(router, '/google', { method: 'POST', body: { credential: 'unverified' } })).status, 401);
    } finally { restoreEnv('GOOGLE_CLIENT_ID', oldClientId); }
  });

  it('refuses to silently relink an email already connected to another Google account', async () => {
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    state.payload = { sub: 'google-new', email: 'user@example.com', email_verified: true };
    state.user = { id: 7, email: 'user@example.com', google_id: 'google-old', name: 'Existing', phone: null, role: 'customer' };
    try {
      const response = await invoke(router, '/google', { method: 'POST', body: { credential: 'valid' } });
      assert.equal(response.status, 409);
      assert.match(response.body.message, /เชื่อมกับบัญชี Google อื่น/);
    } finally { restoreEnv('GOOGLE_CLIENT_ID', oldClientId); }
  });

  it('links an existing email account and issues a session cookie', async () => {
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    state.payload = { sub: 'google-existing', email: ' USER@example.com ', email_verified: true, name: 'Google Name' };
    state.user = { id: 8, email: 'user@example.com', google_id: null, name: null, phone: '0800000000', role: 'customer' };
    state.updates = [];
    try {
      const response = await invoke(router, '/google', { method: 'POST', body: { credential: 'valid' } });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.name, 'Google Name');
      assert.ok(response.res.cookiesSet.token.value);
      assert.equal(state.updates[0][0], 'google-existing');
    } finally { restoreEnv('GOOGLE_CLIENT_ID', oldClientId); }
  });

  it('creates a new customer for a verified Google identity', async () => {
    const oldClientId = process.env.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    state.payload = { sub: 'google-new-user', email: 'new@example.com', email_verified: true, name: 'New Person' };
    state.user = null;
    state.inserted = false;
    try {
      const response = await invoke(router, '/google', { method: 'POST', body: { credential: 'valid' } });
      assert.equal(response.status, 200);
      assert.equal(response.body.user.id, 501);
      assert.equal(response.body.user.email, 'new@example.com');
      assert.equal(state.inserted, true);
    } finally { restoreEnv('GOOGLE_CLIENT_ID', oldClientId); }
  });
});
