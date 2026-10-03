const { audit } = require('../lib/audit');
const prisma = require('../lib/prisma');
const cache = require('../lib/menfesCache');
const adminCache = require('../lib/adminCache');
const { parsePaging } = require('../lib/paging');

// Kunci cache untuk daftar admin. Status sudah diambil dari daftar putih di
// bawah dan page serta limit sudah dijepit parsePaging, jadi ruang kuncinya
// terbatas dan tidak bisa digenomari.
function cacheKey(status, page, limit) {
  return `list:${status}:${page}:${limit}`;
}

// Membersihkan kedua cache. Setiap mutasi mengubah tampilan publik dan isi
// dashboard admin sekaligus, jadi kalau hanya cache publik yang dibersihkan
// admin akan melihat data basi selama masa TTL.
function invalidateAll() {
  cache.invalidate();
  adminCache.invalidate();
}

// Status yang dikenal. Nilai lain diabaikan dan diperlakukan sebagai "semua",
// bukan sebagai error, karena inilah perilaku yang berjalan sejak awal.
const STATUS_TERIMA = ['PENDING', 'APPROVED', 'REJECTED'];

/**
 * GET /api/admin/menfes
 * Ambil semua menfes (admin only) — termasuk info pengirim
 */
async function getAllMenfes(req, res) {
  try {
    const { page, limit, skip } = parsePaging(req.query, {
      defaultLimit: 20,
      maxLimit: 50,
      maxPage: 100,
    });
    const status = req.query.status; // PENDING | APPROVED | REJECTED

    const where = status && STATUS_TERIMA.includes(status) ? { status } : {};

    const key = cacheKey(STATUS_TERIMA.includes(status) ? status : 'ALL', page, limit);
    const cached = adminCache.get(key);
    if (cached) return res.json(cached);

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

    const body = {
      data: menfes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
    adminCache.set(key, body);
    return res.json(body);
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
    invalidateAll();

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
    invalidateAll();

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
    invalidateAll();

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
    const cached = adminCache.get('stats');
    if (cached) return res.json(cached);

    // Empat count terpisah diubah menjadi satu query. Semuanya dijawab dari
    // hasil yang sama, dan ukurannya tetap sama persis: jumlah per status
    // ditambah seluruh baris.
    //
    // ::int itu wajib. COUNT(*) di PostgreSQL bertipe bigint, dan bigint tidak
    // bisa diserialisasi jadi JSON. Tanpa pemotongan ini res.json akan
    // melempar TypeError setiap kali statistik diminta.
    const baris = await prisma.$queryRaw`
      SELECT status, COUNT(*)::int AS n FROM "Menfes" GROUP BY status
    `;

    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let total = 0;
    for (const b of baris) {
      total += b.n;
      if (b.status === 'PENDING') pending = b.n;
      else if (b.status === 'APPROVED') approved = b.n;
      else if (b.status === 'REJECTED') rejected = b.n;
    }

    const body = { pending, approved, rejected, total };
    adminCache.set('stats', body);
    return res.json(body);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Gagal mengambil statistik.' });
  }
}

module.exports = { getAllMenfes, approveMenfes, rejectMenfes, deleteMenfes, getStats };
