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
      if (u && u.id) {
        setUser(u);
        return u;
      }
    } catch {
      if (!localStorage.getItem('token')) {
        setUser(null);
      }
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
    const userData = r?.user || (r?.email ? r : null);
    if (userData) {
      setUser(userData);
    }
  };

  const login = async (email, password) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password } });
    startSession(res);
    return res;
  };

  const register = async (userData) => {
    const res = await api('/auth/register', { method: 'POST', body: userData });
    if (res?.token && res?.user?.verified) {
      startSession(res);
    }
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
    <AuthContext.Provider value={{ user, setUser, ready, login, register, logout, reloadUser, startSession }}>
      {children}
    </AuthContext.Provider>
  );
}
