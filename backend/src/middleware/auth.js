const jwt = require('jsonwebtoken');
const { isCurrentStamp } = require('../lib/token');

const prisma = require('../lib/prisma');

/**
 * Middleware: Verifikasi JWT token dari header Authorization
 * Header format: "Bearer <token>"
 *
 * TOKEN SEKARANG BISA DICABUT
 *
 * Sebelumnya middleware ini hanya memeriksa tanda tangan JWT, sehingga
 * setiap token yang pernah terbit tetap sah sampai kedaluwarsa. Ganti
 * password tidak mengeluarkan siapa pun yang sudah memegang token.
 *
 * Sekarang token membawa cap `st` yang dicocokkan dengan `updatedAt` baris
 * Admin. Karena `updatedAt` beranotasi @updatedAt, setiap update baris Admin
 * (termasuk ganti password dan logout) otomatis membatalkan semua token lama.
 * Penjelasan mekanisme ada di src/lib/token.js.
 *
 * KONSEKUENSI UNTUK FRONTEND
 * Token yang bocor dari localStorage bisa dipakai penyerang tanpa perlu
 * password. Sebelumnya tidak ada cara mencabutnya. Sekarang ada: ganti
 * password, dan semua token lain langsung mati.
 *
 * Fail-closed: kalau database tidak bisa dibaca, request DITOLAK. Membuka
 * akses hanya karena database sedang lambat berarti membiarkan middleware
 * dilewati sepenuhnya.
 */
async function authMiddleware(req, res, next) {
  let decoded;

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token autentikasi tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token tidak valid.' });
    }

    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token sudah kadaluarsa. Silakan login ulang.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token tidak valid.' });
    }
    console.error('Auth verify error:', err);
    return res.status(500).json({ error: 'Gagal memverifikasi token.' });
  }

  // id harus string. Kalau bukan, jangan teruskan ke Prisma: dia akan melempar
  // error dan membalas 503 untuk sesuatu yang sebenarnya cuma token rusak.
  if (!decoded || typeof decoded.id !== 'string') {
    return res.status(401).json({ error: 'Token tidak valid.' });
  }

  let admin;
  try {
    admin = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, createdAt: true, updatedAt: true },
    });
  } catch (err) {
    // Fail-closed: database tidak terbaca berarti sesi tidak bisa diverifikasi,
    // dan request ini tidak boleh lewat.
    console.error('Auth DB error:', err);
    return res.status(503).json({
      error: 'Verifikasi sesi gagal sementara. Coba lagi sebentar.',
    });
  }

  if (!admin) {
    return res.status(401).json({ error: 'Token tidak valid.' });
  }

  if (!isCurrentStamp(decoded, admin)) {
    // Password sudah diganti, atau sesi sudah diakhiri lewat logout.
    return res.status(401).json({ error: 'Sesi sudah berakhir. Silakan login ulang.' });
  }

  // Identitas diambil dari database, bukan dari klaim token. Sebelumnya
  // req.admin = decoded, jadi username ikut dipercaya dari token. Sekarang
  // middleware ini memang sudah menanyakan ke database, jadi tidak ada alasan
  // membiarkan klaim token jadi sumber kebenaran.
  req.admin = admin;
  next();
}

module.exports = authMiddleware;
