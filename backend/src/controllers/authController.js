const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { audit, auditSecurity } = require('../lib/audit');
const { issueToken } = require('../lib/token');
const {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  byteLength,
  exceedsBcryptLimit,
} = require('../lib/password');

const prisma = new PrismaClient();

/**
 * POST /api/auth/login
 * Login admin dengan username + password
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password wajib diisi.' });
    }

    if (typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Input tidak valid.' });
    }

    // bcrypt hanya membaca 72 byte pertama dan membuang sisanya tanpa error.
    // Menolak input yang lebih panjang di sini memastikan batas yang
    // diverifikasi sama dengan batas yang di-hash, sekaligus menahan string
    // raksasa sebelum masuk ke bcrypt.
    //
    // Catatan: ini tidak mengunci siapa pun. Password admin saat ini
    // (admin123) hanya 8 byte, dan change-password sudah menolak > 72 byte
    // sejak sebelum guard ini ada, jadi tidak ada akun yang bisa terjebak di
    // keadaan "hash-nya terpotong".
    if (exceedsBcryptLimit(password)) {
      auditSecurity('login.rejected_too_long', req, {
        username: username.trim().slice(0, 64),
        bytes: byteLength(password),
      });
      return res.status(400).json({
        error: `Password maksimal ${MAX_PASSWORD_BYTES} byte.`,
      });
    }

    // Cari admin di database
    const admin = await prisma.admin.findUnique({
      where: { username: username.trim().toLowerCase() },
    });

    // Selalu jalankan bcrypt.compare walaupun admin tidak ada (anti timing attack)
    const dummyHash = '$2a$12$invalidhashtopreventtimingattacks000000000000000000';
    const isValid = await bcrypt.compare(password, admin?.password || dummyHash);

    if (!admin || !isValid) {
      // Password TIDAK PERNAH dicatat. Username dicatat karena itu satu-satunya
      // petunjuk untuk membedakan serangan bertarget dari typos biasa.
      auditSecurity('login.failed', req, {
        username: username.trim().slice(0, 64),
        accountExists: !!admin,
      });
      return res.status(401).json({ error: 'Username atau password salah.' });
    }

    auditSecurity('login.ok', req);

    res.json({
      message: 'Login berhasil.',
      token: issueToken(admin),
      admin: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

/**
 * GET /api/auth/me
 * Cek status login (verifikasi token)
 *
 * Tidak perlu query database lagi: authMiddleware sudah mengambil baris Admin
 * untuk mencocokkan cap revokasi token, dan_baris itulah yang dipakai di sini.
 * Sebelumnya endpoint ini melakukan query kedua yang hasilnya sudah diketahui
 * middleware (dan cabang 404-nya tidak akan pernah tercapai).
 */
async function me(req, res) {
  try {
    const { id, username, createdAt } = req.admin;
    res.json({ admin: { id, username, createdAt } });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

/**
 * POST /api/auth/change-password
 * Ganti password admin
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi.' });
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter.` });
    }

    // bcrypt memotong input di 72 byte tanpa error, jadi "rahasia" dan
    // "rahasia-tambahan-apa-saja" menghasilkan hash yang sama. Tolak yang
    // kelewat panjang agar bagian yang benar-benar dipakai saat verifikasi
    // sama dengan bagian yang benar-benar di-hash.
    if (exceedsBcryptLimit(newPassword)) {
      return res.status(400).json({
        error: `Password baru maksimal ${MAX_PASSWORD_BYTES} byte.`,
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    const isValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Password lama tidak sesuai.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    // Update password menaikkan updatedAt secara otomatis (@updatedAt), dan
    // updatedAt itulah cap revokasi yang dibawa setiap token. Efeknya: semua
    // token yang sudah terbit mati di detik yang sama.
    //
    // Baris yang dikembalikan dipakai untuk menerbitkan token pengganti,
    // supaya sesi yang sedang dipakai tidak ikut terputus. Penyerang yang
    // memegang token lama tetap dikeluarkan.
    const updated = await prisma.admin.update({
      where: { id: req.admin.id },
      data: { password: hashed },
      select: { id: true, username: true, updatedAt: true },
    });

    // Catat dengan panjang, bukan isinya, supaya rotasi bisa dibuktikan
    // terjadi tanpa menyalin password ke log.
    audit('auth.password_changed', req, {
      newLength: newPassword.length,
      otherSessionsRevoked: true,
    });

    res.json({
      message: 'Password berhasil diganti. Sesi lain sudah dikeluarkan.',
      token: issueToken(updated),
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

/**
 * POST /api/auth/logout
 *
 * Sebelumnya "logout" di frontend hanya menghapus token dari localStorage.
 * Tokennya sendiri tetap sah sampai kedaluwarsa, jadi menekan logout tidak
 * benar-benar memutus akses: siapa pun yang memakai token itu masih bisa
 * memakainya.
 *
 * Sekarang logout menulis ulang baris Admin, yang menaikkan updatedAt dan
 * karena itu membatalkan seluruh token yang pernah terbit.
 *
 * Untuk panel dengan satu admin ini justru menguntungkan: saat pemilik
 * menekan logout, token yang dicuri ikut mati.
 *
 * Catatan: `data: {}` ditolak Prisma di level SQL, jadi field username ditulis
 * ulang dengan nilai yang sama. Password tidak tersentuh. Hal ini
 * dibuktikan di scripts/prove-token-revocation.cjs.
 */
async function logout(req, res) {
  try {
    await prisma.admin.update({
      where: { id: req.admin.id },
      data: { username: req.admin.username },
      select: { id: true },
    });

    auditSecurity('logout', req, { allSessionsRevoked: true });

    res.json({ message: 'Logout berhasil. Semua sesi dicabut.' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

module.exports = { login, me, changePassword, logout };
