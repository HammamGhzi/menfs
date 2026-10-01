const express = require('express');
const authMiddleware = require('../middleware/auth');
const {
  getAllMenfes,
  approveMenfes,
  rejectMenfes,
  deleteMenfes,
  getStats,
  postInstagram,
  getInstagramStatus,
} = require('../controllers/adminController');

const router = express.Router();

// Semua route admin butuh JWT
router.use(authMiddleware);

// GET /api/admin/stats — Statistik dashboard
router.get('/stats', getStats);

// GET /api/admin/instagram/status — Status bot IG
router.get('/instagram/status', getInstagramStatus);

// GET /api/admin/menfes — Ambil semua menfes (dengan filter status)
router.get('/menfes', getAllMenfes);

// PATCH /api/admin/menfes/:id/approve — Approve menfes
router.patch('/menfes/:id/approve', approveMenfes);

// POST /api/admin/menfes/:id/post-ig — Post ke Instagram & auto-approve
router.post('/menfes/:id/post-ig', postInstagram);

// PATCH /api/admin/menfes/:id/reject — Reject menfes
router.patch('/menfes/:id/reject', rejectMenfes);

// DELETE /api/admin/menfes/:id — Hapus menfes
router.delete('/menfes/:id', deleteMenfes);

module.exports = router;

