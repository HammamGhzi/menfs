const { PrismaClient } = require('@prisma/client');
const { audit } = require('../lib/audit');

const prisma = new PrismaClient();

/**
 * GET /api/admin/menfes
 * Ambil semua menfes (admin only) — termasuk info pengirim
 */
async function getAllMenfes(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;
    const status = req.query.status; // PENDING | APPROVED | REJECTED

    const where = status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
      ? { status }
      : {};

    const [menfes, total] = await Promise.all([
      prisma.menfes.findMany({
        where,
        // Admin dapat melihat SEMUA field termasuk pengirim
        select: {
          id: true,
          message: true,
          senderName: true,
          senderInfo: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          ipHash: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.menfes.count({ where }),
    ]);

    // Membaca daftar admin adalah aksi paling sensitif di aplikasi ini:
    // responsnya memuat senderName, senderInfo dan ipHash untuk setiap menfes.
    // Kalau password pernah bocor, ini yang pertama dilakukan penyerang.
    // Dicatat supaya aktivitas baca bisa dibedakan dari tidak ada aktivitas.
    audit('menfes.list', req, {
      page,
      limit,
      filter: status || 'ALL',
      returned: menfes.length,
    });

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
    console.error('Admin getAllMenfes error:', err);
    res.status(500).json({ error: 'Gagal mengambil data menfes.' });
  }
}

/**
 * PATCH /api/admin/menfes/:id/approve
 * Approve menfes
 */
async function approveMenfes(req, res) {
  try {
    const { id } = req.params;

    const menfes = await prisma.menfes.findUnique({ where: { id } });
    if (!menfes) {
      return res.status(404).json({ error: 'Menfes tidak ditemukan.' });
    }

    const updated = await prisma.menfes.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
      },
    });

    audit('menfes.approve', req, { menfesId: id });

    res.json({ message: 'Menfes berhasil diapprove.', data: updated });
  } catch (err) {
    console.error('Approve menfes error:', err);
    res.status(500).json({ error: 'Gagal approve menfes.' });
  }
}

/**
 * PATCH /api/admin/menfes/:id/reject
 * Reject menfes
 */
async function rejectMenfes(req, res) {
  try {
    const { id } = req.params;

    const menfes = await prisma.menfes.findUnique({ where: { id } });
    if (!menfes) {
      return res.status(404).json({ error: 'Menfes tidak ditemukan.' });
    }

    const updated = await prisma.menfes.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    audit('menfes.reject', req, { menfesId: id });

    res.json({ message: 'Menfes berhasil direject.', data: updated });
  } catch (err) {
    console.error('Reject menfes error:', err);
    res.status(500).json({ error: 'Gagal reject menfes.' });
  }
}

/**
 * DELETE /api/admin/menfes/:id
 * Hapus menfes permanen
 */
async function deleteMenfes(req, res) {
  try {
    const { id } = req.params;

    const menfes = await prisma.menfes.findUnique({ where: { id } });
    if (!menfes) {
      return res.status(404).json({ error: 'Menfes tidak ditemukan.' });
    }

    await prisma.menfes.delete({ where: { id } });

    audit('menfes.delete', req, { menfesId: id });

    res.json({ message: 'Menfes berhasil dihapus.' });
  } catch (err) {
    console.error('Delete menfes error:', err);
    res.status(500).json({ error: 'Gagal menghapus menfes.' });
  }
}

/**
 * GET /api/admin/stats
 * Statistik dashboard admin
 */
async function getStats(req, res) {
  try {
    const [pending, approved, rejected, total] = await Promise.all([
      prisma.menfes.count({ where: { status: 'PENDING' } }),
      prisma.menfes.count({ where: { status: 'APPROVED' } }),
      prisma.menfes.count({ where: { status: 'REJECTED' } }),
      prisma.menfes.count(),
    ]);

    res.json({ pending, approved, rejected, total });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Gagal mengambil statistik.' });
  }
}

module.exports = { getAllMenfes, approveMenfes, rejectMenfes, deleteMenfes, getStats };
