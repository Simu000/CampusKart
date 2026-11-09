import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  const reloadUser = async () => {
    try {
      const u = await api('/auth/me');
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setReady(true);
      return;
    }
    reloadUser().finally(() => setReady(true));
  }, []);

  const startSession = (r) => {
    if (r?.token) {
      localStorage.setItem('token', r.token);
    }
    setUser(r?.user || null);
  };

  const login = async (email, password) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password } });
    startSession(res);
    return res;
  };

  const register = async (userData) => {
    const res = await api('/auth/register', { method: 'POST', body: userData });
    startSession(res);
    return res;
  };

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch (ignored) {}
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, reloadUser }}>
      {children}
    </AuthContext.Provider>
  );
}
