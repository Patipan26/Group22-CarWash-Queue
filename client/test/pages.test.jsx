import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../src/auth', () => ({
  useAuth: () => ({
    user: { id: 7, email: 'admin@example.com', name: 'Test User', role: 'admin' },
    loading: false,
    login: vi.fn(), register: vi.fn(), googleLogin: vi.fn(), logout: vi.fn()
  })
}));

import App from '../src/App';
import HomePage from '../src/pages/HomePage';
import ServicesPage from '../src/pages/ServicesPage';
import BookingPage from '../src/pages/BookingPage';
import ContactPage from '../src/pages/ContactPage';
import AuthPage from '../src/pages/AuthPage';
import AdminPage from '../src/pages/AdminPage';
import NotificationsPage from '../src/pages/NotificationsPage';
import ProfilePage from '../src/pages/ProfilePage';
import PaymentPage from '../src/pages/PaymentPage';
import StatusPage from '../src/pages/StatusPage';
import TrackingPage from '../src/pages/TrackingPage';

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function renderPage(Page, path = '/') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><Page /></MemoryRouter>);
}

describe('customer and admin page initial states', () => {
  it('renders the homepage hero and the four-slide carousel controls', () => {
    const html = renderPage(HomePage);
    expect(html).toContain('ล้างรถแบบมีแผน');
    expect((html.match(/aria-label="แสดงภาพที่/g) || []).length).toBe(4);
  });

  it('renders service catalog empty state layout and Monday-Saturday hours', () => {
    const html = renderPage(ServicesPage);
    expect(html).toContain('บริการและอัตราค่าบริการ');
    expect(html).toContain('เปิดรับจองวันจันทร์–เสาร์');
  });

  it('renders booking and contact forms with their primary fields', () => {
    expect(renderPage(BookingPage)).toContain('เลือกวันและเวลา');
    const contact = renderPage(ContactPage);
    expect(contact).toContain('ฝากข้อความถึงทีมงาน');
    expect(contact).toContain('ไม่เกิน 5 MB');
  });

  it('renders auth tabs and starts in login mode', () => {
    const html = renderPage(AuthPage);
    expect(html).toContain('ยินดีต้อนรับกลับ');
    expect(html).toContain('สมัครสมาชิก');
  });

  it('renders profile, booking status, tracking and notification empty states', () => {
    expect(renderPage(ProfilePage)).toContain('กำลังโหลดโปรไฟล์');
    expect(renderPage(StatusPage)).toContain('ประวัติการจอง');
    expect(renderPage(TrackingPage)).toContain('ติดตามสถานะ');
    expect(renderPage(NotificationsPage)).toContain('ยังไม่มีการแจ้งเตือน');
  });

  it('renders payment page for a booking route', () => {
    const html = renderPage(PaymentPage, '/payment/CW-TEST-1');
    expect(html).toContain('ชำระเงิน');
  });

  it('routes an authenticated administrator through the admin guard', () => {
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={['/admin?tab=bookings']}><App /></MemoryRouter>);
    expect(html).toContain('Admin Dashboard');
  });
});
