import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, apiFile, apiUrl } from '../src/api.js';

const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;

function installWindow({ sessionId = null, crypto = { randomUUID: () => 'generated-tab-id' } } = {}) {
  const store = new Map(sessionId ? [['carwash-tab-session-id', sessionId]] : []);
  globalThis.window = {
    crypto,
    sessionStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value)
    }
  };
  return store;
}

function response({ ok = true, status = 200, data = {}, blob = { type: 'application/pdf' }, jsonError = false } = {}) {
  return {
    ok,
    status,
    async json() {
      if (jsonError) throw new Error('invalid json');
      return data;
    },
    async blob() { return blob; }
  };
}

afterEach(() => {
  globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('client API helpers', () => {
  it('joins API paths to the configured base URL', () => {
    expect(apiUrl('/bookings')).toBe('/api/bookings');
  });

  it('sends a request without a tab id during server-side rendering', async () => {
    delete globalThis.window;
    const fetchMock = vi.fn().mockResolvedValue(response({ data: { ok: true } }));
    globalThis.fetch = fetchMock;
    await expect(api('/health')).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      credentials: 'include', headers: { 'Content-Type': 'application/json' }
    }));
  });

  it('reuses the current tab session id in the request header', async () => {
    installWindow({ sessionId: 'tab-current' });
    const fetchMock = vi.fn().mockResolvedValue(response({ data: { bookings: [] } }));
    globalThis.fetch = fetchMock;
    await api('/bookings');
    expect(fetchMock.mock.calls[0][1].headers['X-Session-Id']).toBe('tab-current');
  });

  it('creates and stores a UUID session id when a tab has none', async () => {
    const store = installWindow();
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    await api('/me');
    expect(store.get('carwash-tab-session-id')).toBe('generated-tab-id');
    expect(fetchMock.mock.calls[0][1].headers['X-Session-Id']).toBe('generated-tab-id');
  });

  it('uses secure random bytes when randomUUID is unavailable', async () => {
    const store = installWindow({
      crypto: { getRandomValues: (bytes) => { bytes.fill(15); return bytes; } }
    });
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    await api('/me');
    expect(store.get('carwash-tab-session-id')).toBe('0f'.repeat(16));
  });

  it('continues without a tab id if the browser exposes no secure random generator', async () => {
    installWindow({ crypto: {} });
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    await api('/me');
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
  });

  it('lets caller headers override defaults and sends JSON bodies', async () => {
    installWindow({ sessionId: 'tab-1' });
    const fetchMock = vi.fn().mockResolvedValue(response({ data: { saved: true } }));
    globalThis.fetch = fetchMock;
    await expect(api('/profile', {
      method: 'PATCH', body: JSON.stringify({ name: 'A' }), headers: { 'X-Trace': 'trace-1' }
    })).resolves.toEqual({ saved: true });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      'Content-Type': 'application/json', 'X-Session-Id': 'tab-1', 'X-Trace': 'trace-1'
    });
  });

  it('does not set JSON content type for FormData uploads', async () => {
    installWindow({ sessionId: 'tab-1' });
    const fetchMock = vi.fn().mockResolvedValue(response());
    globalThis.fetch = fetchMock;
    const form = new FormData();
    form.append('field', 'value');
    await api('/contacts', { method: 'POST', body: form });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ 'X-Session-Id': 'tab-1' });
  });

  it('returns an empty object when a successful response has no JSON body', async () => {
    installWindow({ sessionId: 'tab-1' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ jsonError: true }));
    await expect(api('/logout')).resolves.toEqual({});
  });

  it('uses the server error message for a failed API request', async () => {
    installWindow({ sessionId: 'tab-1' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ ok: false, status: 400, data: { message: 'ข้อมูลไม่ครบ' } }));
    await expect(api('/bookings', { method: 'POST' })).rejects.toThrow('ข้อมูลไม่ครบ');
  });

  it('shows the specific 5 MB message when the server rejects an oversized file', async () => {
    installWindow({ sessionId: 'tab-1' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ ok: false, status: 413, data: { message: 'too large' } }));
    await expect(api('/contacts', { method: 'POST' })).rejects.toThrow(/ไม่เกิน 5 MB/);
  });

  it('falls back to the HTTP status when an error response has no JSON', async () => {
    installWindow({ sessionId: 'tab-1' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ ok: false, status: 503, jsonError: true }));
    await expect(api('/health')).rejects.toThrow('เซิร์ฟเวอร์ตอบกลับผิดพลาด (503)');
  });

  it('downloads a private attachment and includes the tab session header', async () => {
    installWindow({ sessionId: 'tab-9' });
    const attachment = new Blob(['pdf']);
    const fetchMock = vi.fn().mockResolvedValue(response({ blob: attachment }));
    globalThis.fetch = fetchMock;
    await expect(apiFile('/bookings/CW1/slip')).resolves.toBe(attachment);
    expect(fetchMock.mock.calls[0][1]).toEqual({
      credentials: 'include', headers: { 'X-Session-Id': 'tab-9' }
    });
  });

  it('shows a clear message when downloading an attachment fails', async () => {
    installWindow({ sessionId: 'tab-9' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ ok: false, status: 404, data: { message: 'ไม่พบสลิป' } }));
    await expect(apiFile('/bookings/CW1/slip')).rejects.toThrow('ไม่พบสลิป');
  });

  it('uses a fallback download message when the error response is not JSON', async () => {
    installWindow({ sessionId: 'tab-9' });
    globalThis.fetch = vi.fn().mockResolvedValue(response({ ok: false, status: 500, jsonError: true }));
    await expect(apiFile('/bookings/CW1/slip')).rejects.toThrow('เปิดไฟล์แนบไม่ได้');
  });
});
