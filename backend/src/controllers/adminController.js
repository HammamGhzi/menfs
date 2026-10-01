const { PrismaClient } = require('@prisma/client');

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


const instagramBot = require('../services/instagramBot');


/**
 * POST /api/admin/menfes/:id/post-ig
 * Post menfes langsung ke Instagram feed & tandai diapprove
 */
async function postInstagram(req, res) {
  try {
    const { id } = req.params;
    const { imageBase64, caption, autoApprove = true } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Data gambar (imageBase64) wajib dikirim.' });
    }

    const menfes = await prisma.menfes.findUnique({ where: { id } });
    if (!menfes) {
      return res.status(404).json({ error: 'Menfes tidak ditemukan.' });
    }

    // Bersihkan header base64 jika ada (e.g. data:image/jpeg;base64,...)
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Buat default caption jika tidak ada
    const sender = menfes.senderName ? menfes.senderName : 'Seseorang';
    const finalCaption = caption || `[MENFESS]\nDari: ${sender}\n\n"${menfes.message}"\n\n—\nKirim menfess kamu via link di bio!\n#menfess #harkatnekatt`;

    // Kirim postingan via bot
    const result = await instagramBot.publishPhoto({
      imageBuffer,
      caption: finalCaption,
    });

    let updated = menfes;
    if (autoApprove) {
      updated = await prisma.menfes.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      message: 'Menfes berhasil diposting ke Instagram!',
      data: updated,
      instagram: result,
    });
  } catch (err) {
    console.error('Post to Instagram error:', err);
    res.status(500).json({
      error: err.message || 'Gagal posting ke Instagram. Pastikan akun & password di .env sudah benar.',
    });
  }
}

/**
 * GET /api/admin/instagram/status
 * Cek status konfigurasi dan koneksi Instagram
 */
async function getInstagramStatus(req, res) {
  try {
    const status = instagramBot.getStatus();
    res.json(status);
  } catch (err) {
    console.error('Instagram status error:', err);
    res.status(500).json({ error: 'Gagal mengecek status Instagram.' });
  }
}

module.exports = {
  getAllMenfes,
  approveMenfes,
  rejectMenfes,
  deleteMenfes,
  getStats,
  postInstagram,
  getInstagramStatus,
};
