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
          .catch(() => clearSession());
      } catch {
        clearSession();
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

  // Membersihkan sesi di sisi browser saja, tanpa menyentuh server.
  // Dipakai saat token sudah tidak berlaku atau server tidak bisa dihubungi:
  // memanggil API logout di sana hanya menambah permintaan yang pasti gagal.
  function clearSession() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdmin(null);
  }

  // Logout sungguhan: server membatalkan SEMUA token yang pernah terbit.
  // Sebelumnya logout hanya menghapus token dari localStorage, sehingga
  // tokennya tetap sah sampai kedaluwarsa dan siapa pun yang memegangnya
  // masih bisa memakainya.
  //
  // Local storage tetap dibersihkan apa pun hasil server: kalau network mati
  // atau token sudah dicabut, pengguna tetap harus dikeluarkan dari panel.
  async function logout() {
    try {
      await authAPI.logout();
    } catch {
      // diabaikan: clearSession di bawah yang menentukan perilaku
    } finally {
      clearSession();
    }
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
