const API_URL = import.meta.env.VITE_API_URL || '/api';

export function apiUrl(path) {
  return `${API_URL}${path}`;
}

function getTabSessionId() {
  if (typeof window === 'undefined') return null;
  let sessionId = window.sessionStorage.getItem('carwash-tab-session-id');
  if (!sessionId) {
    const cryptoApi = window.crypto;
    if (cryptoApi?.randomUUID) {
      sessionId = cryptoApi.randomUUID();
    } else if (cryptoApi?.getRandomValues) {
      const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
      sessionId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    } else {
      return null;
    }
    window.sessionStorage.setItem('carwash-tab-session-id', sessionId);
  }
  return sessionId;
}

export async function apiFile(path) {
  const sessionId = getTabSessionId();
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    headers: sessionId ? { 'X-Session-Id': sessionId } : {}
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'เปิดไฟล์แนบไม่ได้');
  }
  return response.blob();
}

export async function api(path, options = {}) {
  const sessionId = getTabSessionId();
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(sessionId ? { 'X-Session-Id': sessionId } : {}),
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 413
      ? 'ไฟล์มีขนาดใหญ่เกินกำหนด กรุณาเลือกไฟล์ไม่เกิน 5 MB'
      : data.message || `เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`;
    throw new Error(message);
  }
  return data;
}
