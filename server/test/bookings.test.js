const { before, after, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const state = {
  availabilityRows: [],
  bookingRows: [],
  customerBookings: [],
  accountRows: [{ loyaltyPoints: 4 }],
  slipRows: [],
  cancelRows: [],
  bookingCount: 0,
  serviceRows: [{ id: 1, price: 250 }],
  addonRows: [],
  lockAcquired: 1,
  rescheduleRows: [],
  affectedRows: 1,
  admins: [{ id: 99 }],
  connectionQueries: []
};

function queryResult(rows) { return [rows, []]; }

const poolMock = {
  async query(sql) {
    if (sql.includes('SELECT slip_path AS slipPath')) return queryResult(state.slipRows);
    if (sql.includes('FROM bookings WHERE booking_code = ? AND user_id = ?')) return queryResult(state.bookingRows);
    if (sql.includes('SELECT loyalty_points AS loyaltyPoints')) return queryResult(state.accountRows);
    if (sql.includes('FROM bookings b JOIN services s') && sql.includes('WHERE b.user_id = ?')) return queryResult(state.customerBookings);
    if (sql.includes('FROM bookings')) return queryResult(state.availabilityRows);
    if (sql.startsWith('UPDATE bookings')) return [{ affectedRows: state.affectedRows }, []];
    return queryResult([]);
  },
  async getConnection() {
    return {
      async query(sql, params = []) {
        state.connectionQueries.push({ sql, params });
        if (sql.includes('GET_LOCK')) return queryResult([{ acquired: state.lockAcquired }]);
        if (sql.includes('COUNT(*) AS bookedCount')) return queryResult([{ bookedCount: state.bookingCount }]);
        if (sql.includes('FROM services')) return queryResult(state.serviceRows);
        if (sql.includes('FROM addons')) return queryResult(state.addonRows);
        if (sql.includes('FROM bookings WHERE booking_code = ? AND user_id = ? FOR UPDATE') && sql.includes('payment_status')) return queryResult(state.cancelRows);
        if (sql.includes('FROM bookings WHERE booking_code = ? AND user_id = ? FOR UPDATE')) return queryResult(state.rescheduleRows);
        if (sql.includes("role = 'admin'")) return queryResult(state.admins);
        if (sql.startsWith('UPDATE bookings')) return [{ affectedRows: state.affectedRows }, []];
        if (sql.startsWith('INSERT INTO bookings')) return [{ insertId: 42 }, []];
        return [{ affectedRows: 1, insertId: 42 }, []];
      },
      async beginTransaction() { state.connectionQueries.push({ sql: 'BEGIN' }); },
      async commit() { state.connectionQueries.push({ sql: 'COMMIT' }); },
      async rollback() { state.connectionQueries.push({ sql: 'ROLLBACK' }); },
      release() { state.connectionQueries.push({ sql: 'RELEASE' }); }
    };
  }
};

const dbPath = require.resolve('../src/db');
const previousDbModule = require.cache[dbPath];
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: poolMock };
const bookingsRouter = require('../src/routes/bookings');
if (previousDbModule) require.cache[dbPath] = previousDbModule;
else delete require.cache[dbPath];

const authToken = jwt.sign(
  { id: 7, email: 'customer@example.com', role: 'customer' },
  process.env.JWT_SECRET || 'development-secret'
);

function isoDatePlus(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextOpenDate(offset = 2) {
  let date = isoDatePlus(offset);
  while (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) date = isoDatePlus(++offset);
  return date;
}

function nextSundayDate() {
  let offset = 1;
  while (new Date(`${isoDatePlus(offset)}T00:00:00Z`).getUTCDay() !== 0) offset += 1;
  return isoDatePlus(offset);
}

function resetState(overrides = {}) {
  Object.assign(state, {
    availabilityRows: [],
    bookingRows: [],
    customerBookings: [],
    accountRows: [{ loyaltyPoints: 4 }],
    slipRows: [],
    cancelRows: [],
    bookingCount: 0,
    serviceRows: [{ id: 1, price: 250 }],
    addonRows: [],
    lockAcquired: 1,
    rescheduleRows: [],
    affectedRows: 1,
    admins: [{ id: 99 }],
    connectionQueries: [],
    ...overrides
  });
}

async function request(path, { method = 'GET', body, authenticated = false, file } = {}) {
  const url = new URL(path, 'http://carwash.test');
  const routePath = url.pathname.replace(/^\/bookings/, '') || '/';
  const pathParts = routePath.split('/').filter(Boolean);
  const routeLayer = bookingsRouter.stack.find((layer) => {
    if (!layer.route?.methods[method.toLowerCase()]) return false;
    const routeParts = String(layer.route.path).split('/').filter(Boolean);
    return routeParts.length === pathParts.length && routeParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
  });
  if (!routeLayer) throw new Error(`No bookings route for ${method} ${routePath}`);

  const routeParts = String(routeLayer.route.path).split('/').filter(Boolean);
  const params = {};
  routeParts.forEach((part, index) => {
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(pathParts[index] || '');
  });
  const req = {
    method,
    headers: authenticated ? { authorization: `Bearer ${authToken}` } : {},
    cookies: {},
    query: Object.fromEntries(url.searchParams.entries()),
    params,
    body: body || {},
    file,
    user: undefined
  };
  const res = {
    statusCode: 200,
    body: null,
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.headersSent = true; return this; },
    sendFile(filename, options, callback) { this.fileResponse = { filename, options }; callback?.(null); this.headersSent = true; return this; }
  };
  let nextError = null;
  const handlers = routeLayer.route.stack.map((layer) => layer.handle);
  // Skip Multer here: these route cases send JSON and intentionally contain no uploaded file.
  if (method === 'POST' && (routePath === '/' || routePath.endsWith('/payment'))) handlers.splice(1, 1);
  for (const handler of handlers) {
    let nextCalled = false;
    await handler(req, res, (error) => { nextError = error || nextError; nextCalled = true; });
    if (!nextCalled || res.headersSent) break;
  }
  if (nextError) return { status: 500, body: { message: nextError.message } };
  return { status: res.statusCode, body: res.body, res, req };
}

before(() => {
  process.env.BOOKING_SLOT_CAPACITY = '1';
});

describe('booking availability API', () => {
  it('rejects a missing date', async () => {
    const result = await request('/bookings/availability');
    assert.equal(result.status, 400);
    assert.match(result.body.message, /วันที่ไม่ถูกต้อง/);
  });

  it('rejects a date with the wrong format', async () => {
    const result = await request('/bookings/availability?date=31-10-2026');
    assert.equal(result.status, 400);
  });

  it('rejects an impossible calendar date', async () => {
    const result = await request('/bookings/availability?date=2026-02-30');
    assert.equal(result.status, 400);
  });

  it('rejects Sunday because the shop is closed', async () => {
    const result = await request(`/bookings/availability?date=${nextSundayDate()}`);
    assert.equal(result.status, 400);
    assert.match(result.body.message, /วันอาทิตย์/);
  });

  it('rejects dates in the past', async () => {
    const result = await request('/bookings/availability?date=2000-01-01');
    assert.equal(result.status, 400);
    assert.match(result.body.message, /ผ่านมาแล้ว/);
  });

  it('returns every slot and remaining capacity for an open date', async () => {
    resetState({ availabilityRows: [{ bookingTime: '09:00 - 10:00', bookedCount: 1 }] });
    const result = await request(`/bookings/availability?date=${nextOpenDate()}`);
    assert.equal(result.status, 200);
    assert.equal(result.body.capacity, 1);
    assert.equal(result.body.slots.length, 6);
    assert.equal(result.body.slots[0].available, false);
    assert.equal(result.body.slots[0].remaining, 0);
    assert.equal(result.body.slots[1].available, true);
    assert.equal(result.body.slots[1].remaining, 1);
  });

  it('uses a safe default capacity for an invalid configuration', async () => {
    const oldCapacity = process.env.BOOKING_SLOT_CAPACITY;
    process.env.BOOKING_SLOT_CAPACITY = '0';
    try {
      const result = await request(`/bookings/availability?date=${nextOpenDate()}`);
      assert.equal(result.body.capacity, 1);
    } finally {
      process.env.BOOKING_SLOT_CAPACITY = oldCapacity;
    }
  });
});

describe('creating bookings', () => {
  const validBody = () => ({
    serviceId: 1,
    bookingDate: nextOpenDate(),
    bookingTime: '09:00 - 10:00',
    customerName: 'Test Customer',
    customerPhone: '0812345678',
    carModel: 'Honda Civic',
    carPlate: 'กข1234'
  });

  it('requires an authenticated customer', async () => {
    const result = await request('/bookings', { method: 'POST', body: validBody() });
    assert.equal(result.status, 401);
  });

  it('rejects incomplete booking details', async () => {
    const result = await request('/bookings', { method: 'POST', body: { serviceId: 1 }, authenticated: true });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /กรอกข้อมูลการจองให้ครบ/);
  });

  it('blocks Sunday bookings on the server', async () => {
    const result = await request('/bookings', { method: 'POST', body: { ...validBody(), bookingDate: nextSundayDate() }, authenticated: true });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /วันอาทิตย์/);
  });

  it('rejects a malformed service id', async () => {
    const result = await request('/bookings', { method: 'POST', body: { ...validBody(), serviceId: 'abc' }, authenticated: true });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /บริการที่เลือกไม่ถูกต้อง/);
  });

  it('rejects when another request holds the slot lock', async () => {
    resetState({ lockAcquired: 0 });
    const result = await request('/bookings', { method: 'POST', body: validBody(), authenticated: true });
    assert.equal(result.status, 409);
    assert.match(result.body.message, /กำลังจองช่วงเวลานี้/);
  });

  it('rejects a full slot even after acquiring the lock', async () => {
    resetState({ bookingCount: 1 });
    const result = await request('/bookings', { method: 'POST', body: validBody(), authenticated: true });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'SLOT_FULL');
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'ROLLBACK'));
  });

  it('rejects a service that is inactive or missing', async () => {
    resetState({ serviceRows: [] });
    const result = await request('/bookings', { method: 'POST', body: validBody(), authenticated: true });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /ไม่พบบริการ/);
  });

  it('rejects add-ons that are missing or inactive', async () => {
    resetState({ addonRows: [] });
    const result = await request('/bookings', {
      method: 'POST', body: { ...validBody(), addonIds: '[3]' }, authenticated: true
    });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /บริการเสริม/);
  });

  it('creates a booking and notifies the customer', async () => {
    resetState({ addonRows: [{ id: 3, price: 100 }] });
    const result = await request('/bookings', {
      method: 'POST', body: { ...validBody(), addonIds: '[3,3]' }, authenticated: true
    });
    assert.equal(result.status, 201);
    assert.equal(result.body.totalPrice, 350);
    assert.equal(result.body.paymentStatus, 'unpaid');
    assert.match(result.body.bookingCode, /^CW/);
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'COMMIT'));
    assert.ok(state.connectionQueries.some(({ sql }) => sql.includes('INSERT INTO notifications')));
    assert.ok(state.connectionQueries.some(({ sql }) => sql.includes('RELEASE_LOCK')));
  });
});

describe('rescheduling bookings', () => {
  const destination = () => ({ bookingDate: nextOpenDate(5), bookingTime: '10:00 - 11:00' });
  const eligibleBooking = () => ({
    id: 12, userId: 7, status: 'confirmed', bookingDate: nextOpenDate(2), bookingTime: '09:00 - 10:00'
  });

  it('rejects closed Sundays', async () => {
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: { bookingDate: nextSundayDate(), bookingTime: '09:00 - 10:00' }, authenticated: true
    });
    assert.equal(result.status, 400);
    assert.match(result.body.message, /วันอาทิตย์/);
  });

  it('rejects a destination in the past', async () => {
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: { bookingDate: '2000-01-01', bookingTime: '09:00 - 10:00' }, authenticated: true
    });
    assert.equal(result.status, 400);
  });

  it('returns not found for a code owned by nobody', async () => {
    resetState({ rescheduleRows: [] });
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: destination(), authenticated: true
    });
    assert.equal(result.status, 404);
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'ROLLBACK'));
  });

  it('allows a valid booking to remain at the same time', async () => {
    const booking = eligibleBooking();
    resetState({ rescheduleRows: [booking] });
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: { bookingDate: booking.bookingDate, bookingTime: booking.bookingTime }, authenticated: true
    });
    assert.equal(result.status, 200);
    assert.match(result.body.message, /เวลาเดิม/);
  });

  it('rejects a slot that has reached capacity', async () => {
    resetState({ rescheduleRows: [eligibleBooking()], bookingCount: 1 });
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: destination(), authenticated: true
    });
    assert.equal(result.status, 409);
    assert.match(result.body.message, /เต็มแล้ว/);
  });

  it('updates the booking and sends a status notification', async () => {
    resetState({ rescheduleRows: [eligibleBooking()] });
    const result = await request('/bookings/CWTEST/reschedule', {
      method: 'PATCH', body: destination(), authenticated: true
    });
    assert.equal(result.status, 200);
    assert.match(result.body.message, /เลื่อนวันและเวลา/);
    assert.ok(state.connectionQueries.some(({ sql }) => sql.startsWith('UPDATE bookings')));
    assert.ok(state.connectionQueries.some(({ sql }) => sql.includes('INSERT INTO notifications')));
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'COMMIT'));
  });
});

describe('booking history, private slips and cancellation', () => {
  it('requires authentication before returning booking history or slips', async () => {
    assert.equal((await request('/bookings/me')).status, 401);
    assert.equal((await request('/bookings/CWTEST/slip')).status, 401);
  });

  it('returns only the customer booking history and loyalty balance', async () => {
    resetState({ customerBookings: [{ id: 3, bookingCode: 'CW3' }], accountRows: [{ loyaltyPoints: 12 }] });
    const result = await request('/bookings/me', { authenticated: true });
    assert.equal(result.status, 200);
    assert.equal(result.body.loyaltyPoints, 12);
    assert.equal(result.body.bookings[0].bookingCode, 'CW3');
  });

  it('returns 404 for absent slips and serves a valid stored slip privately', async () => {
    resetState({ slipRows: [] });
    assert.equal((await request('/bookings/CW-MISSING/slip', { authenticated: true })).status, 404);
    resetState({ slipRows: [{ slipPath: '/uploads/123-456.pdf' }] });
    const result = await request('/bookings/CW-OWN/slip', { authenticated: true });
    assert.equal(result.status, 200);
    assert.equal(result.res.fileResponse.filename, '123-456.pdf');
    assert.equal(result.res.fileResponse.options.headers['Cache-Control'], 'private, no-store');
    assert.match(result.res.fileResponse.options.headers['Content-Disposition'], /^attachment/);
  });

  it('does not let customers cancel another person’s or an ineligible booking', async () => {
    resetState({ cancelRows: [] });
    assert.equal((await request('/bookings/CW-OTHER/cancel', { method: 'PATCH', authenticated: true })).status, 404);
    resetState({ cancelRows: [{ id: 9, userId: 7, status: 'completed', paymentStatus: 'verified', bookingDate: nextOpenDate(2), bookingTime: '09:00 - 10:00' }] });
    assert.equal((await request('/bookings/CW-DONE/cancel', { method: 'PATCH', authenticated: true })).status, 409);
  });

  it('cancels an upcoming booking and notifies admins when a verified payment needs follow-up', async () => {
    resetState({ cancelRows: [{ id: 10, userId: 7, status: 'confirmed', paymentStatus: 'verified', bookingDate: nextOpenDate(3), bookingTime: '15:00 - 16:00' }], admins: [{ id: 99 }] });
    const result = await request('/bookings/CW-PAID/cancel', { method: 'PATCH', authenticated: true });
    assert.equal(result.status, 200);
    assert.match(result.body.message, /ติดต่อร้านค้า/);
    assert.equal(state.connectionQueries.filter(({ sql }) => sql.includes('INSERT INTO notifications')).length, 2);
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'COMMIT'));
  });
});

describe('cash payment requests', () => {
  const paymentBooking = (overrides = {}) => ({ id: 42, subtotal: 250, paymentStatus: 'unpaid', status: 'pending', ...overrides });

  it('rejects an unknown promotion code', async () => {
    resetState({ bookingRows: [paymentBooking()] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash', promoCode: 'NOTREAL' }, authenticated: true
    });
    assert.equal(result.status, 400);
  });

  it('returns not found when the booking does not belong to the customer', async () => {
    resetState({ bookingRows: [] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash' }, authenticated: true
    });
    assert.equal(result.status, 404);
  });

  it('prevents a second payment after the booking was paid', async () => {
    resetState({ bookingRows: [paymentBooking({ paymentStatus: 'verified' })] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash' }, authenticated: true
    });
    assert.equal(result.status, 409);
    assert.match(result.body.message, /ชำระเงินเรียบร้อย/);
  });

  it('prevents payment on a cancelled booking', async () => {
    resetState({ bookingRows: [paymentBooking({ status: 'cancelled' })] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash' }, authenticated: true
    });
    assert.equal(result.status, 409);
    assert.match(result.body.message, /ถูกยกเลิก/);
  });

  it('prevents duplicate payment review requests', async () => {
    resetState({ bookingRows: [paymentBooking({ paymentStatus: 'pending_review' })] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash' }, authenticated: true
    });
    assert.equal(result.status, 409);
    assert.match(result.body.message, /รอแอดมิน/);
  });

  it('calculates VAT, accepts PROMO10 and notifies the admin for cash', async () => {
    resetState({ bookingRows: [paymentBooking()], admins: [{ id: 99 }, { id: 100 }] });
    const result = await request('/bookings/CWTEST/payment', {
      method: 'POST', body: { paymentMethod: 'cash', promoCode: 'promo10' }, authenticated: true
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.paymentMethod, 'cash');
    assert.equal(result.body.paymentStatus, 'pending_review');
    assert.equal(result.body.subtotal, 250);
    assert.equal(result.body.discount, 25);
    assert.equal(result.body.vat, 15.75);
    assert.equal(result.body.amountDue, 240.75);
    assert.equal(state.connectionQueries.filter(({ sql }) => sql.includes('INSERT INTO notifications')).length, 2);
    assert.ok(state.connectionQueries.some(({ sql }) => sql === 'COMMIT'));
  });

  it('rejects a valid image when Slip2Go reports that it contains no QR code', async () => {
    const originalFetch = global.fetch;
    const originalSecret = process.env.SLIP2GO_SECRET;
    const originalReceiver = process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER;
    const filePath = path.join(os.tmpdir(), `carwash-slip-${Date.now()}.png`);
    await fs.writeFile(filePath, Buffer.from('fake image bytes'));
    process.env.SLIP2GO_SECRET = 'test-only-secret';
    process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER = '0000000000';
    global.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-only-secret');
      return { ok: true, async json() { return { code: '400001', message: 'QR not found' }; } };
    };
    try {
      resetState({ bookingRows: [paymentBooking()] });
      const response = await request('/bookings/CWTEST/payment', {
        method: 'POST', body: { paymentMethod: 'promptpay' }, authenticated: true,
        file: { path: filePath, filename: 'slip.png', originalname: 'slip.png', mimetype: 'image/png' }
      });
      assert.equal(response.status, 422);
      assert.match(response.body.message, /ไม่พบ QR Code/);
      await assert.rejects(fs.access(filePath));
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.SLIP2GO_SECRET;
      else process.env.SLIP2GO_SECRET = originalSecret;
      if (originalReceiver === undefined) delete process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER;
      else process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER = originalReceiver;
      await fs.rm(filePath, { force: true });
    }
  });

  it('accepts only a matching, verified transfer and records the Slip2Go reference', async () => {
    const originalFetch = global.fetch;
    const originalSecret = process.env.SLIP2GO_SECRET;
    const originalReceiver = process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER;
    const filePath = path.join(os.tmpdir(), `carwash-slip-${Date.now()}-valid.png`);
    await fs.writeFile(filePath, Buffer.from('fake image bytes'));
    process.env.SLIP2GO_SECRET = 'test-only-secret';
    process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER = '0000000000';
    global.fetch = async (_url, options) => {
      const form = options.body;
      const payload = JSON.parse(form.get('payload'));
      assert.equal(payload.checkAmount.amount, '267.50');
      return { ok: true, async json() { return { code: '200200', data: { amount: '267.50', transRef: 'TEST-TRANSFER-1', referenceId: 'TEST-REF-1' } }; } };
    };
    try {
      resetState({ bookingRows: [paymentBooking()] });
      const response = await request('/bookings/CWTEST/payment', {
        method: 'POST', body: { paymentMethod: 'promptpay' }, authenticated: true,
        file: { path: filePath, filename: 'slip.png', originalname: 'slip.png', mimetype: 'image/png' }
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.paymentStatus, 'verified');
      assert.equal(response.body.slipReference, 'TEST-TRANSFER-1');
    } finally {
      global.fetch = originalFetch;
      if (originalSecret === undefined) delete process.env.SLIP2GO_SECRET;
      else process.env.SLIP2GO_SECRET = originalSecret;
      if (originalReceiver === undefined) delete process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER;
      else process.env.SLIP2GO_RECEIVER_ACCOUNT_NUMBER = originalReceiver;
      await fs.rm(filePath, { force: true });
    }
  });
});
