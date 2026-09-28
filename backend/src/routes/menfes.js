const express = require('express');
const rateLimit = require('express-rate-limit');
const { submitMenfes, getApprovedMenfes } = require('../controllers/menfesController');

const router = express.Router();

// Rate limit submit menfes — max 5x per 15 menit per IP
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak pengiriman. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  },
});

// GET /api/menfes — Ambil menfes approved (publik)
router.get('/', getApprovedMenfes);

// POST /api/menfes — Kirim menfes baru (publik)
router.post('/', submitLimiter, submitMenfes);

module.exports = router;
