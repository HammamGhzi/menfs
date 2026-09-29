const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { notifyNewMenfes } = require('../services/telegramBot');

const prisma = new PrismaClient();

/**
 * Hash IP address untuk anti-spam tanpa menyimpan IP asli
 */
function hashIp(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + process.env.JWT_SECRET).digest('hex').substring(0, 16);
}

/**
 * POST /api/menfes
 * Submit menfes baru (publik, anonim)
 */
async function submitMenfes(req, res) {
  try {
    const { message, senderName, senderInfo } = req.body;

    // Validasi pesan
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Pesan menfes wajib diisi.' });
    }

    const trimmed = message.trim();
    if (trimmed.length < 5) {
      return res.status(400).json({ error: 'Pesan minimal 5 karakter.' });
    }
    if (trimmed.length > 500) {
      return res.status(400).json({ error: 'Pesan maksimal 500 karakter.' });
    }

    // Ambil IP pengirim (di-hash untuk privasi)
    const rawIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
    const ipHash = hashIp(rawIp);

    // Simpan ke database
    const menfes = await prisma.menfes.create({
      data: {
        message: trimmed,
        senderName: senderName?.trim()?.substring(0, 100) || null,
        senderInfo: senderInfo?.trim()?.substring(0, 200) || null,
        status: 'PENDING',
        ipHash,
      },
    });

    // Kirim notifikasi Telegram ke admin (non-blocking — tidak ganggu response)
    notifyNewMenfes(menfes).catch((err) =>
      console.error('Telegram notif error (non-fatal):', err.message)
    );

    // Response publik — JANGAN tampilkan info pengirim
    res.status(201).json({
      message: 'Menfes berhasil dikirim! Menunggu persetujuan admin.',
      id: menfes.id,
    });
  } catch (err) {
    console.error('Submit menfes error:', err);
    res.status(500).json({ error: 'Gagal mengirim menfes.' });
  }
}

/**
 * GET /api/menfes
 * Ambil semua menfes yang sudah APPROVED (publik)
 */
async function getApprovedMenfes(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const [menfes, total] = await Promise.all([
      prisma.menfes.findMany({
        where: { status: 'APPROVED' },
        select: {
          id: true,
          message: true,
          approvedAt: true,
          createdAt: true,
          // senderName, senderInfo, ipHash TIDAK diambil
        },
        orderBy: { approvedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.menfes.count({ where: { status: 'APPROVED' } }),
    ]);

    res.json({
      data: menfes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get menfes error:', err);
    res.status(500).json({ error: 'Gagal mengambil data menfes.' });
  }
}

module.exports = { submitMenfes, getApprovedMenfes };
