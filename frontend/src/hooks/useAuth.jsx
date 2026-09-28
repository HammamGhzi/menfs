import { useState, useEffect, createContext, useContext } from 'react';
import { authAPI } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cek token saat app load
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const savedAdmin = localStorage.getItem('admin_user');

    if (token && savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
        // Verifikasi token ke server di background
        authAPI.me()
          .then(({ data }) => setAdmin(data.admin))
          .catch(() => logout());
      } catch {
        logout();
      }
    }
    setLoading(false);
  }, []);

  async function login(username, password) {
    const { data } = await authAPI.login(username, password);
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify(data.admin));
    setAdmin(data.admin);
    return data;
  }

  function logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdmin(null);
  }

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, isLoggedIn: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}
