import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const authState = vi.hoisted(() => ({ current: { user: null, loading: false } }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Navigate: ({ to }) => <span>REDIRECT:{to}</span>,
    Outlet: () => <span>OUTLET_CONTENT</span>
  };
});

vi.mock('../src/auth', () => ({ useAuth: () => authState.current }));

import { AdminRoute, ProtectedRoute } from '../src/components/RouteGuards';

function renderGuardedRoute(Guard) {
  return renderToStaticMarkup(<MemoryRouter initialEntries={['/private']}><Routes>
    <Route element={<Guard />}><Route path="/private" element={<span>PRIVATE_PAGE</span>} /></Route>
  </Routes></MemoryRouter>);
}

describe('route access guards', () => {
  it('shows a loading message while checking the current session', () => {
    authState.current = { user: null, loading: true };
    expect(renderGuardedRoute(ProtectedRoute)).toContain('กำลังตรวจสอบสิทธิ์...');
  });

  it('redirects signed-out visitors to login', () => {
    authState.current = { user: null, loading: false };
    expect(renderGuardedRoute(ProtectedRoute)).toContain('REDIRECT:/auth');
  });

  it('allows signed-in customers into protected pages but redirects them away from admin pages', () => {
    authState.current = { user: { id: 7, role: 'customer' }, loading: false };
    expect(renderGuardedRoute(ProtectedRoute)).toContain('OUTLET_CONTENT');
    expect(renderGuardedRoute(AdminRoute)).toContain('REDIRECT:/');
  });

  it('allows administrators into admin pages', () => {
    authState.current = { user: { id: 1, role: 'admin' }, loading: false };
    expect(renderGuardedRoute(AdminRoute)).toContain('OUTLET_CONTENT');
  });
});
