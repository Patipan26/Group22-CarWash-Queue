const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { invoke, loadRouter, makeToken } = require('./helpers/router');

const adminHeaders = { authorization: `Bearer ${makeToken({ id: 1, role: 'admin', email: 'admin@example.com' })}` };
const customerHeaders = { authorization: `Bearer ${makeToken({ id: 2, role: 'customer', email: 'customer@example.com' })}` };
const result = (data) => [data, []];
const state = { queries: [], booking: null, customerRows: [{ id: 2, name: 'Customer', loyaltyPoints: 8 }], bookingRows: [], duplicate: false, contactRows: [], contacts: [], affected: 1 };

const pool = {
  async query(sql, params = []) {
    state.queries.push({ sql, params });
    if (sql.includes('SELECT id FROM services WHERE id')) return result([]);
    if (sql.includes('SELECT id FROM addons WHERE id')) return result([]);
    if (sql.startsWith('INSERT INTO services') || sql.startsWith('INSERT INTO addons')) {
      if (state.duplicate) { const e = new Error('duplicate'); e.code = 'ER_DUP_ENTRY'; throw e; }
      return [{ insertId: 45 }, []];
    }
    if (sql.includes('AS paidCount') && sql.includes('GROUP BY DATE')) return result([{ date: '2026-11-01', revenue: 267.5, paidCount: 1 }]);
    if (sql.includes('AS totalRevenue')) return result([{ totalRevenue: 267.5, beforeVat: 250, vatTotal: 17.5, paidCount: 1, cancelledPaidAmount: 0, cancelledPaidCount: 0 }]);
    if (sql.includes('GROUP BY s.id, s.name')) return result([{ service: 'Wash', revenue: 267.5, paidCount: 1 }]);
    if (sql.includes('AS bookingCode') && sql.includes('paidDate')) return result([{ bookingCode: 'CW1', amount: 267.5 }]);
    if (sql.includes('FROM users u LEFT JOIN bookings')) return result(state.customerRows);
    if (sql.includes('FROM users u WHERE u.id')) return result(state.customerRows);
    if (sql.includes('FROM bookings b JOIN services s') && sql.includes('WHERE b.user_id')) return result(state.bookingRows);
    if (sql.includes('FROM contacts WHERE id')) return result(state.contactRows);
    if (sql.includes('FROM contacts ORDER BY')) return result(state.contacts);
    if (sql.startsWith('UPDATE')) return [{ affectedRows: state.affected }, []];
    if (sql.startsWith('SELECT id, name, description')) return result([]);
    return result([]);
  },
  async getConnection() {
    return {
      async beginTransaction() {}, async commit() { state.committed = true; }, async rollback() { state.rolledBack = true; }, release() {},
      async query(sql, params = []) {
        state.queries.push({ sql, params });
        if (sql.includes('FROM bookings WHERE id = ? FOR UPDATE')) return result(state.booking ? [state.booking] : []);
        if (sql.includes("role = 'admin'")) return result([{ id: 1 }]);
        if (sql.startsWith('UPDATE bookings')) return [{ affectedRows: 1 }, []];
        if (sql.startsWith('INSERT INTO notifications')) return [{ insertId: 1 }, []];
        if (sql.startsWith('UPDATE users')) return [{ affectedRows: 1 }, []];
        return result([]);
      }
    };
  }
};
const router = loadRouter('../../src/routes/admin', pool);

describe('admin routes and access control', () => {
  it('blocks unauthenticated users and customers from admin endpoints', async () => {
    assert.equal((await invoke(router, '/bookings')).status, 401);
    assert.equal((await invoke(router, '/bookings', { headers: customerHeaders })).status, 403);
    assert.equal((await invoke(router, '/bookings', { headers: adminHeaders })).status, 200);
  });

  it('validates revenue date ranges and returns aggregated revenue data', async () => {
    assert.equal((await invoke(router, '/revenue?from=bad&to=2026-11-01', { headers: adminHeaders })).status, 400);
    assert.equal((await invoke(router, '/revenue?from=2026-11-02&to=2026-11-01', { headers: adminHeaders })).status, 400);
    const response = await invoke(router, '/revenue?from=2026-11-01&to=2026-11-30', { headers: adminHeaders });
    assert.equal(response.status, 200);
    assert.equal(response.body.summary.totalRevenue, 267.5);
    assert.equal(response.body.payments[0].bookingCode, 'CW1');
  });

  it('validates catalog creation, creates services/addons, and handles duplicate names', async () => {
    const invalid = await invoke(router, '/services', { method: 'POST', headers: adminHeaders, body: { name: '', price: -1, active: true, durationMinutes: 60 } });
    assert.equal(invalid.status, 400);
    const service = { name: ' Wash ', description: ' Basic ', price: 250, durationMinutes: 60, active: true };
    assert.equal((await invoke(router, '/services', { method: 'POST', headers: adminHeaders, body: service })).status, 201);
    assert.equal(state.queries.at(-1).params[0], 'Wash');
    state.duplicate = true;
    assert.equal((await invoke(router, '/addons', { method: 'POST', headers: adminHeaders, body: { ...service, durationMinutes: undefined } })).status, 409);
    state.duplicate = false;
    assert.equal((await invoke(router, '/catalog', { headers: adminHeaders })).status, 200);
  });

  it('validates and updates catalog IDs while returning not found for missing records', async () => {
    assert.equal((await invoke(router, '/services/nope', { method: 'PATCH', headers: adminHeaders, body: { name: 'Wash', price: 250, durationMinutes: 60, active: true } })).status, 400);
    state.affected = 0;
    assert.equal((await invoke(router, '/services/5', { method: 'PATCH', headers: adminHeaders, body: { name: 'Wash', price: 250, durationMinutes: 60, active: true } })).status, 404);
    assert.equal((await invoke(router, '/addons/5', { method: 'PATCH', headers: adminHeaders, body: { name: 'Wax', price: 50, active: true } })).status, 404);
    state.affected = 1;
  });

  it('returns customer lists, validates IDs, and returns customer booking history', async () => {
    assert.equal((await invoke(router, '/customers', { headers: adminHeaders })).status, 200);
    assert.equal((await invoke(router, '/customers/nope', { headers: adminHeaders })).status, 400);
    assert.equal((await invoke(router, '/customers/2', { headers: adminHeaders })).status, 200);
    state.customerRows = [];
    assert.equal((await invoke(router, '/customers/44', { headers: adminHeaders })).status, 404);
    state.customerRows = [{ id: 2, name: 'Customer', loyaltyPoints: 8 }];
  });

  it('approves cash payments transactionally, calculates VAT, and rejects invalid states', async () => {
    assert.equal((await invoke(router, '/bookings/0/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'verified' } })).status, 400);
    state.booking = null;
    assert.equal((await invoke(router, '/bookings/8/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'verified' } })).status, 404);
    state.booking = { id: 8, userId: 2, bookingStatus: 'pending', subtotal: 250, paymentStatus: 'pending_review', paymentMethod: 'cash', discountAmount: 0, slipPath: null };
    const approved = await invoke(router, '/bookings/8/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'verified' } });
    assert.equal(approved.status, 200);
    assert.ok(state.queries.some(({ sql, params }) => sql.startsWith('UPDATE bookings SET payment_status') && params[0] === 17.5 && params[1] === 267.5));
    assert.equal(state.committed, true);
    state.booking = { ...state.booking, paymentStatus: 'verified', slipPath: null };
    assert.equal((await invoke(router, '/bookings/8/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'rejected' } })).status, 409);
    state.booking = { id: 8, userId: 2, bookingStatus: 'pending', subtotal: 250, paymentStatus: 'pending_review', paymentMethod: 'cash', discountAmount: 0, slipPath: null };
    assert.equal((await invoke(router, '/bookings/8/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'rejected' } })).status, 400);
    state.booking = { ...state.booking, bookingStatus: 'cancelled' };
    assert.equal((await invoke(router, '/bookings/8/payment', { method: 'PATCH', headers: adminHeaders, body: { paymentStatus: 'verified' } })).status, 409);
  });

  it('requires verified payment before progressing a booking and awards loyalty points on completion', async () => {
    assert.equal((await invoke(router, '/bookings/1/status', { method: 'PATCH', headers: adminHeaders, body: { status: 'unknown' } })).status, 400);
    state.booking = { id: 1, user_id: 2, status: 'in_service', paymentStatus: 'unpaid', total_price: 250, pointsAwarded: 0 };
    assert.equal((await invoke(router, '/bookings/1/status', { method: 'PATCH', headers: adminHeaders, body: { status: 'completed' } })).status, 409);
    state.booking.paymentStatus = 'verified';
    const completed = await invoke(router, '/bookings/1/status', { method: 'PATCH', headers: adminHeaders, body: { status: 'completed' } });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.awardedPoints, 10);
    assert.ok(state.queries.some(({ sql }) => sql.startsWith('UPDATE users SET loyalty_points')));
  });

  it('validates contact status and protects attachments when missing', async () => {
    assert.equal((await invoke(router, '/contacts/1/status', { method: 'PATCH', headers: adminHeaders, body: { status: 'bad' } })).status, 400);
    assert.equal((await invoke(router, '/contacts/1/status', { method: 'PATCH', headers: adminHeaders, body: { status: 'read' } })).status, 200);
    state.contactRows = [];
    assert.equal((await invoke(router, '/contacts/1/attachment', { headers: adminHeaders })).status, 404);
    state.contacts = [{ id: 1, attachmentOriginalName: 'report.pdf' }];
    const contacts = await invoke(router, '/contacts', { headers: adminHeaders });
    assert.equal(contacts.body.contacts[0].attachmentOriginalName, 'report.pdf');
    state.contactRows = [{ attachmentPath: '/uploads/1731123456789-123456.pdf' }];
    const attachment = await invoke(router, '/contacts/1/attachment', { headers: adminHeaders });
    assert.equal(attachment.res.fileResponse.filename, '1731123456789-123456.pdf');
    assert.equal((await invoke(router, '/contacts/1', { method: 'DELETE', headers: adminHeaders })).status, 200);
  });

  it('lists slip verification details and validates verification IDs', async () => {
    assert.equal((await invoke(router, '/bookings/nope/slip-verifications', { headers: adminHeaders })).status, 400);
    assert.deepEqual((await invoke(router, '/bookings/4/slip-verifications', { headers: adminHeaders })).body, { verifications: [] });
  });
});
