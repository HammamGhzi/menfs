import api from './client';

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }),

  me: () =>
    api.get('/auth/me'),

  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
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

  // Timeout panjang WAJIB di sini. Backend menunggu container Instagram
  // sampai status_code=FINISHED (poll 1x/menit, maks 5x) sebelum publish.
  // Timeout pendek akan memutus request di tengah jalan, dan karena
  // media_publish tidak idempotent, user bisa pressed retry lalu dapat
  // postingan duplikat.
  postInstagram: (id, { imageBase64, caption, autoApprove = true }) =>
    api.post(`/admin/menfes/${id}/post-ig`, { imageBase64, caption, autoApprove }, { timeout: 360000 }),

  getInstagramStatus: () =>
    api.get('/admin/instagram/status'),
};

