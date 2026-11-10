const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { invoke, loadRouter, makeToken } = require('./helpers/router');

const customerToken = makeToken({ id: 7, email: 'customer@example.com', role: 'customer' });
const adminToken = makeToken({ id: 99, email: 'admin@example.com', role: 'admin' });
const customerHeaders = { authorization: `Bearer ${customerToken}` };
const adminHeaders = { authorization: `Bearer ${adminToken}` };
const rows = (data) => [data, []];

describe('authentication routes', () => {
  const state = { user: null, insert: 0, registeredEmail: null };
  const pool = { async query(sql, params) {
    if (sql.startsWith('SELECT id FROM users')) return rows(state.registeredEmail === params[0] ? [{ id: 21 }] : []);
    if (sql.startsWith('SELECT id, email, password_hash')) return rows(state.user ? [state.user] : []);
    if (sql.startsWith('INSERT INTO users')) { state.insert++; state.registeredEmail = params[0]; return [{ insertId: 21 }, []]; }
    return rows([]);
  } };
  const router = loadRouter('../../src/routes/auth', pool);

  it('validates registration fields and duplicate emails', async () => {
    assert.equal((await invoke(router, '/register', { method: 'POST' })).status, 400);
    assert.equal((await invoke(router, '/register', { method: 'POST', body: { email: 'A@EXAMPLE.COM', password: '123456' } })).status, 201);
    assert.equal(state.insert, 1);
    assert.equal((await invoke(router, '/register', { method: 'POST', body: { email: 'a@example.com', password: '123456' } })).status, 409);
  });

  it('normalizes login email, rejects wrong credentials and issues a scoped cookie', async () => {
    state.user = { id: 9, email: 'member@example.com', password_hash: '$2a$10$invalidhash', name: 'Member', phone: null, role: 'customer' };
    assert.equal((await invoke(router, '/login', { method: 'POST', body: { email: 'missing@example.com', password: 'wrong' } })).status, 401);
    // A malformed stored hash is treated as an invalid password without leaking an error.
    const wrong = await invoke(router, '/login', { method: 'POST', body: { email: ' MEMBER@example.com ', password: 'wrong' } });
    assert.equal(wrong.status, 401);
    assert.equal((await invoke(router, '/logout', { method: 'POST', headers: { 'x-session-id': 'admin-tab' } })).res.cookiesCleared[0], 'token_admin-tab');
  });

  it('logs in a user with a valid password and scopes the cookie to the browser tab', async () => {
    state.user = { id: 9, email: 'member@example.com', password_hash: await bcrypt.hash('correct-pass', 4), name: 'Member', phone: null, role: 'customer' };
    const response = await invoke(router, '/login', {
      method: 'POST', body: { email: ' MEMBER@example.com ', password: 'correct-pass' }, headers: { 'x-session-id': 'customer-tab' }
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.user.id, 9);
    assert.ok(response.res.cookiesSet['token_customer-tab'].value);
  });

  it('returns null for absent and invalid sessions, and accepts a valid bearer token', async () => {
    assert.deepEqual((await invoke(router, '/me')).body, { user: null });
    assert.deepEqual((await invoke(router, '/me', { headers: { authorization: 'Bearer bad' } })).body, { user: null });
    assert.equal((await invoke(router, '/me', { headers: customerHeaders })).body.user.id, 7);
  });

  it('reports Google login as unavailable without server configuration', async () => {
    const old = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;
    try {
      assert.equal((await invoke(router, '/google', { method: 'POST', body: { credential: 'fake' } })).status, 503);
      process.env.GOOGLE_CLIENT_ID = 'configured';
      assert.equal((await invoke(router, '/google', { method: 'POST' })).status, 400);
    } finally {
      if (old === undefined) delete process.env.GOOGLE_CLIENT_ID;
      else process.env.GOOGLE_CLIENT_ID = old;
    }
  });
});

describe('profile and notification routes', () => {
  const state = { duplicate: false, affected: 1, queries: [], passwordHash: null };
  const pool = { async query(sql, params) {
    state.queries.push({ sql, params });
    if (sql.includes('COUNT(*) AS unreadCount')) return rows([{ unreadCount: 2 }]);
    if (sql.startsWith('UPDATE notifications')) return [{ affectedRows: state.affected }, []];
    if (sql.startsWith('SELECT id, email, name')) return rows([{ id: 7, email: 'customer@example.com', name: 'Customer', phone: null, loyaltyPoints: 3 }]);
    if (sql.includes('COUNT(*) AS bookingCount')) return rows([{ bookingCount: 2, completedCount: 1, totalSpent: 250 }]);
    if (sql.includes('AS all_cars')) return rows([{ carModel: 'Civic', carPlate: 'ABC123', lastUsedAt: null }]);
    if (sql.includes('FROM bookings b JOIN services')) return rows([{ id: 1, bookingCode: 'CW1' }]);
    if (sql.startsWith('INSERT INTO customer_cars')) {
      if (state.duplicate) { const error = new Error('duplicate'); error.code = 'ER_DUP_ENTRY'; throw error; }
      return [{ insertId: 12 }, []];
    }
    if (sql.startsWith('DELETE FROM customer_cars')) return [{ affectedRows: state.affected }, []];
    if (sql.startsWith('SELECT password_hash')) return rows([{ passwordHash: state.passwordHash }]);
    return [{ affectedRows: 1 }, []];
  } };
  const profile = loadRouter('../../src/routes/profile', pool);
  const notifications = loadRouter('../../src/routes/notifications', pool);

  it('requires authentication for profile and notification routes', async () => {
    assert.equal((await invoke(profile, '/')).status, 401);
    assert.equal((await invoke(notifications, '/')).status, 401);
  });

  it('returns profile summary and validates then saves profile fields', async () => {
    const summary = await invoke(profile, '/', { headers: customerHeaders });
    assert.equal(summary.body.stats.completedCount, 1);
    assert.equal(summary.body.cars[0].carModel, 'Civic');
    assert.equal((await invoke(profile, '/', { method: 'PATCH', headers: customerHeaders, body: { name: ' ', phone: '' } })).status, 400);
    assert.equal((await invoke(profile, '/', { method: 'PATCH', headers: customerHeaders, body: { name: 'C'.repeat(121) } })).status, 400);
    const saved = await invoke(profile, '/', { method: 'PATCH', headers: customerHeaders, body: { name: ' New Name ', phone: '' } });
    assert.deepEqual(saved.body.user, { id: 7, name: 'New Name', phone: null });
  });

  it('changes passwords and validates short passwords', async () => {
    state.passwordHash = await bcrypt.hash('current-pass', 4);
    assert.equal((await invoke(profile, '/password', { method: 'POST', headers: customerHeaders, body: { newPassword: '123' } })).status, 400);
    assert.equal((await invoke(profile, '/password', { method: 'POST', headers: customerHeaders, body: { currentPassword: 'wrong', newPassword: 'strong-pass' } })).status, 400);
    assert.equal((await invoke(profile, '/password', { method: 'POST', headers: customerHeaders, body: { currentPassword: 'current-pass', newPassword: 'strong-pass' } })).status, 200);
    state.passwordHash = null;
    assert.equal((await invoke(profile, '/password', { method: 'POST', headers: customerHeaders, body: { newPassword: 'strong-pass' } })).status, 200);
    assert.ok(state.queries.some(({ sql }) => sql.startsWith('UPDATE users SET password_hash')));
  });

  it('validates car fields, normalizes plates, handles duplicates, and removes cars', async () => {
    assert.equal((await invoke(profile, '/cars', { method: 'POST', headers: customerHeaders, body: { carModel: 'Civic' } })).status, 400);
    const created = await invoke(profile, '/cars', { method: 'POST', headers: customerHeaders, body: { carModel: ' Civic ', carPlate: 'abc 123' } });
    assert.deepEqual(created.body.car, { id: 12, carModel: 'Civic', carPlate: 'ABC 123' });
    state.duplicate = true;
    assert.equal((await invoke(profile, '/cars', { method: 'POST', headers: customerHeaders, body: { carModel: 'Civic', carPlate: 'ABC123' } })).status, 409);
    state.duplicate = false;
    assert.equal((await invoke(profile, '/cars/12', { method: 'DELETE', headers: customerHeaders })).status, 200);
  });

  it('lists user notifications and marks one or all as read', async () => {
    assert.equal((await invoke(notifications, '/', { headers: customerHeaders })).status, 200);
    assert.equal((await invoke(notifications, '/read-all', { method: 'PATCH', headers: customerHeaders })).status, 200);
    state.affected = 0;
    assert.equal((await invoke(notifications, '/3/read', { method: 'PATCH', headers: customerHeaders })).status, 404);
    state.affected = 1;
    assert.equal((await invoke(notifications, '/3/read', { method: 'PATCH', headers: customerHeaders })).status, 200);
  });
});

describe('public catalog and contact routes', () => {
  const state = { queries: [] };
  const pool = { async query(sql, params) { state.queries.push({ sql, params }); return rows([]); } };
  const services = loadRouter('../../src/routes/services', pool);
  const contacts = loadRouter('../../src/routes/contacts', pool);

  it('returns customer catalog and admin catalog variants', async () => {
    assert.equal((await invoke(services, '/')).status, 200);
    assert.equal((await invoke(services, '/catalog')).status, 200);
    assert.equal(state.queries.length, 4);
  });

  it('validates contact messages and stores anonymous or authenticated sender data', async () => {
    assert.equal((await invoke(contacts, '/', { method: 'POST', skipRouteHandlerIndexes: [1] })).status, 400);
    const payload = { senderName: 'Name', senderContact: 'email@example.com', subject: 'Help', message: 'Hello' };
    assert.equal((await invoke(contacts, '/', { method: 'POST', body: payload, skipRouteHandlerIndexes: [1] })).status, 201);
    const logged = await invoke(contacts, '/', { method: 'POST', body: payload, headers: customerHeaders, skipRouteHandlerIndexes: [1] });
    assert.equal(logged.status, 201);
    assert.equal(state.queries.at(-1).params[0], 7);
  });
});
