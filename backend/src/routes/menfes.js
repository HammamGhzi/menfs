const express = require('express');
const rateLimit = require('express-rate-limit');
const { submitMenfes, getApprovedMenfes } = require('../controllers/menfesController');

const router = express.Router();

// Rate limit submit menfes — max 5x per 15 menit per IP
// Jangan pakai X-Forwarded-For mentah: header itu dikontrol client dan bisa
// dipalsukan tiap request untuk lolos dari limit. Dengan 'trust proxy' yang
// diset di src/index.js, req.ip sudah memperhitungkan proxy di depan.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Terlalu banyak pengiriman. Coba lagi dalam 15 menit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/menfes — Ambil menfes approved (publik)
router.get('/', getApprovedMenfes);

// POST /api/menfes — Kirim menfes baru (publik)
router.post('/', submitLimiter, submitMenfes);

module.exports = router;
