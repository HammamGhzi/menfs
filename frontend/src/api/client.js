import axios from 'axios';

// Kalau ada VITE_API_URL (production), pakai itu.
// Kalau tidak ada (dev), fallback ke /api (Vite proxy).
//
// Slash di akhir VITE_API_URL harus dibuang lebih dulu. Nilai env di
// Vercel gampang diketik berekor slash ("https://host.onrender.com/"),
// lalu concat di bawah menghasilkan "...onrender.com//api". Backend tidak
// menormalkan double slash, jadi route itu balas 404 dengan
// {"error":"Route tidak ditemukan."} -- sementara header CORS tetap
// terkirim dan health check tetap hijau, sehingga gejalanya mudah
// disalahartikan sebagai "API hidup" padahal setiap request gagal.
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');

const BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor: Sisipkan token JWT ────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response interceptor: Handle 401 (token expired) ──────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      // Redirect ke login jika bukan di halaman login
      if (!window.location.pathname.includes('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
