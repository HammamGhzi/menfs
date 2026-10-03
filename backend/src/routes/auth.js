const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, me, changePassword, logout } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Rate limit khusus untuk login — max 5x per 15 menit
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login
router.post('/login', loginLimiter, login);

// GET /api/auth/me (butuh token)
router.get('/me', authMiddleware, me);

// POST /api/auth/change-password (butuh token)
router.post('/change-password', authMiddleware, changePassword);

// POST /api/auth/logout (butuh token)
// Membatalkan semua token yang pernah terbit, bukan hanya milik pemanggil.
router.post('/logout', authMiddleware, logout);

module.exports = router;
