import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/auth/me').then((data) => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    setUser(data.user);
    return data.user;
  }

  async function register(email, password) {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
    setUser(data.user);
    return data.user;
  }

  async function googleLogin(credential) {
    const data = await api('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential })
    });
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
