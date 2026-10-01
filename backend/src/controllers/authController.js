const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { audit, auditSecurity } = require('../lib/audit');

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

    // Generate JWT
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username,
        role: 'admin',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      message: 'Login berhasil.',
      token,
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
 */
async function me(req, res) {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
      select: { id: true, username: true, createdAt: true },
    });

    if (!admin) {
      return res.status(404).json({ error: 'Admin tidak ditemukan.' });
    }

    res.json({ admin });
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

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password baru minimal 8 karakter.' });
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.admin.id },
    });

    const isValid = await bcrypt.compare(currentPassword, admin.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Password lama tidak sesuai.' });
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.admin.update({
      where: { id: req.admin.id },
      data: { password: hashed },
    });

    // Catat dengan panjang, bukan isinya, supaya rotasi bisa dibuktikan
    // terjadi tanpa menyalin password ke log.
    audit('auth.password_changed', req, { newLength: newPassword.length });

    res.json({ message: 'Password berhasil diganti.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan server.' });
  }
}

module.exports = { login, me, changePassword };
