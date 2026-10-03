import api from './client';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  me: () =>
    api.get('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),

  // Memanggil ini membatalkan SEMUA token yang pernah terbit, bukan hanya
  // token milik pemanggil. Untuk panel satu admin itu menguntungkan: token
  // yang dicuri ikut mati saat pemilik logout.
  logout: () =>
    api.post('/auth/logout'),
};

// ─── Menfes Publik ────────────────────────────────────────────────────────
export const menfesAPI = {
  submit: (data) =>
    api.post('/menfes', data),

  getApproved: (page = 1, limit = 10) =>
    api.get('/menfes', { params: { page, limit } }),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getStats: () =>
    api.get('/admin/stats'),

  getMenfes: (status, page = 1, limit = 20) =>
    api.get('/admin/menfes', { params: { status, page, limit } }),

  approve: (id) =>
    api.patch(`/admin/menfes/${id}/approve`),

  reject: (id) =>
    api.patch(`/admin/menfes/${id}/reject`),

  delete: (id) =>
    api.delete(`/admin/menfes/${id}`),
};
