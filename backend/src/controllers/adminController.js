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


const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ig = require('../services/instagramGraph');

// Folder yang sudah dilayani sebagai statis publik oleh index.js
// (app.use('/uploads', express.static(...))). Meta akan fetch URL ini.
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Batas ukuran file gambar yang di-unggah (dalam byte).
// Docs IG: maksimal 8MB untuk feed. Kita jauh lebih ketat karena
// ini hasil render canvas di browser (biasanya 200-500KB).
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * POST /api/admin/menfes/:id/post-ig
 * Post menfes ke Instagram feed via Content Publishing API (jalur resmi).
 *
 * Alur:
 *   1. Terima gambar base64 dari browser (sudah dirender oleh ExportModal).
 *   2. Simpan ke uploads/ — route ini memang sudah statis publik di prod.
 *   3. Instagram FETCH URL publik itu dari server Meta (harus publik).
 *   4. Setelah container FINISHED, publish, lalu hapus file sementara.
 *
 * Kenapa file dihapus: disk di Render itu ephemeral — akan hilang sendiri
 * saat deploy/restart. Menghapusnya lebih dulu mencegah file basi menumpuk.
 */
async function postInstagram(req, res) {
  let tmpPath = null;

  try {
    const { id } = req.params;
    const { imageBase64, caption, autoApprove = true } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Data gambar (imageBase64) wajib dikirim.' });
    }

    // Pastikan PUBLIC_BASE_URL terisi DAN masuk akal — tanpa ini, Meta akan
    // gagal fetch gambarnya dengan error 9004 yang jauh lebih sulit
    // diretas daripada pesan konfigurasi di sini.
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    if (!publicBaseUrl) {
      return res.status(500).json({
        error: 'PUBLIC_BASE_URL belum di-set di server. Set di Render: https://menfs.onrender.com',
      });
    }
    if (!/^https?:\/\//.test(publicBaseUrl)) {
      return res.status(500).json({
        error: `PUBLIC_BASE_URL harus berawalan http:// atau https:// (sekarang: "${publicBaseUrl}").`,
      });
    }

    const menfes = await prisma.menfes.findUnique({ where: { id } });
    if (!menfes) {
      return res.status(404).json({ error: 'Menfes tidak ditemukan.' });
    }

    // Dekode base64, toleran terhadap prefix data:image/jpeg;base64,
    // termasuk whitespace / newline dari canvas.toDataURL.
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
    const imageBuffer = Buffer.from(base64Data, 'base64');

    if (imageBuffer.length === 0) {
      return res.status(400).json({ error: 'Gambar kosong setelah didekode. Coba export ulang.' });
    }
    if (imageBuffer.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({
        error: `Ukuran gambar ${(imageBuffer.length / 1024 / 1024).toFixed(1)}MB melebihi batas 8MB.`,
      });
    }

    // Pastikan folder uploads ada (Render bisa fresh setiap deploy).
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }

    // Nama file acak supaya tidak bentrok dan tidak bisa ditebak.
    const fileName = `ig-${crypto.randomUUID()}.jpg`;
    tmpPath = path.join(UPLOADS_DIR, fileName);
    fs.writeFileSync(tmpPath, imageBuffer);

    // URL yang akan di-fetch oleh server Meta.
    // Slash digabung rapi supaya tidak muncul dua slash.
    const imageUrl = `${publicBaseUrl.replace(/\/+$/, '')}/uploads/${fileName}`;

    const sender = menfes.senderName || 'Seseorang';
    const finalCaption =
      caption ||
      `[MENFESS]\nDari: ${sender}\n\n"${menfes.message}"\n\n—\nKirim menfess kamu via link di bio!\n#menfess #harkatnekatt`;

    // ── Instagram Graph API: create container → tunggu FINISHED → publish ──
    console.log('[IG] Membuat media container untuk menfes', {
      menfesId: id,
      imageUrl,
      dryRun: ig.isDryRun(),
    });

    const { mediaId, permalink, containerId } = await ig.publishImage({
      imageUrl,
      caption: finalCaption,
      altText: `Menfes: ${menfes.message.slice(0, 100)}`,
    });

    console.log('[IG] Publish sukses', { menfesId: id, mediaId, containerId });

    // Approve HANYA setelah publish sukses. Kalau publish gagal, menfes
    // tetap PENDING supaya bisa dicoba ulang tanpa efek samping ganda.
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

    return res.json({
      success: true,
      message: 'Menfes berhasil diposting ke Instagram!',
      data: updated,
      instagram: {
        mediaId,
        containerId,
        // permalink tidak selalu dikembalikan API — kirim kalau ada saja.
        ...(permalink ? { permalink } : {}),
      },
    });
  } catch (err) {
    console.error('Post to Instagram error:', err);

    // Error konfigurasi (token/env) → 500, pesan sudah ramah dari service.
    const status = err?.name === 'InstagramGraphError' && err?.code === 190 ? 401 : 500;
    return res.status(status).json({
      error: err.message || 'Gagal posting ke Instagram. Cek konfigurasi IG_* di Render.',
    });
  } finally {
    // Selalu buang file sementara, sukses maupun gagal.
    if (tmpPath) {
      try {
        fs.unlinkSync(tmpPath);
      } catch (cleanupErr) {
        if (cleanupErr.code !== 'ENOENT') {
          console.warn('[IG] Gagal hapus file sementara:', tmpPath, cleanupErr.message);
        }
      }
    }
  }
}

/**
 * GET /api/admin/instagram/status
 * Cek konfigurasi Instagram TANPA memanggil Graph API.
 *
 * Kenapa tidak panggil API: setiap request /me akan membakar rate limit,
 * dan status endpoint ini dipanggil dari dashboard yang sering dibuka.
 * Untuk verifikasi token sungguhan, jalankan backend/scripts/ig-spike.mjs.
 */
async function getInstagramStatus(req, res) {
  try {
    const configured = Boolean(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN);
    const publicBaseUrl = process.env.PUBLIC_BASE_URL || null;

    // Hitung sisa kuota publish hari ini kalau token ada.
    let quota = null;
    let account = null;
    let quotaError = null;

    if (configured && !ig.isDryRun()) {
      try {
        const [quotaRes, accountRes] = await Promise.allSettled([ig.getQuota(), ig.getAccountInfo()]);
        if (quotaRes.status === 'fulfilled') {
          quota = {
            usage: quotaRes.value?.quota_usage,
            total: quotaRes.value?.config?.quota_total,
          };
        } else {
          quotaError = quotaRes.reason?.message || 'Gagal mengambil kuota.';
        }
        if (accountRes.status === 'fulfilled') {
          account = accountRes.value;
        }
      } catch (e) {
        quotaError = e.message;
      }
    }

    res.json({
      configured,
      dryRun: ig.isDryRun(),
      graphVersion: ig.GRAPH_VERSION,
      publicBaseUrl,
      // Upload dir — dipakai untuk diagnosa PUBLIC_BASE_URL yang salah.
      uploadPath: UPLOADS_DIR,
      account,
      quota,
      quotaError,
    });
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
