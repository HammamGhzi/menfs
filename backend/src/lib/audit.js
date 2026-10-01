const crypto = require('crypto');

/**
 * Audit log untuk aksi admin.
 *
 * Kenapa ini penting: sebelum ini, tidak ada jejak sama sekali atas siapa
 * yang memakai panel admin. Kalau password bocor, admin sah dan penyerang
 * terlihat IDENTIK — keduanya cuma meninggalkan `approvedAt`. Itu membuat
 * pertanyaan "saya sudah diretas atau belum" mustahil dijawab, dan jawaban
 * itu dibutuhkan sebelum password bisa diamankan.
 *
 * Format: satu baris JSON per kejadian, diawali [AUDIT], ditulis ke stdout.
 * Render Fabian akan menyimpannya di log explorer, jadi bisa dicari dengan
 *   grep '\[AUDIT\]' | grep '"action":"menfes.delete"'
 *
 * Sengaja TIDAK disimpan ke database:
 *   - menambah tabel berarti mengubah schema.prisma, yang tidak boleh
 *     disentuh untuk perubahan ini;
 *   - log hanya berguna kalau tidak bisa diedit/dihapus oleh pihak yang punya
 *     akses database. Log di stdout tidak bisa dimanipulasi lewat SQL.
 *
 * Yang dicatat TIDAK PERNAH: password, token, atau isi lengkap menfes.
 */

function hashIp(ip) {
  if (!ip) return null;
  return crypto
    .createHash('sha256')
    .update(String(ip) + process.env.JWT_SECRET)
    .digest('hex')
    .substring(0, 16);
}

/**
 * Buang karakter kontrol dari nilai yang masuk ke log.
 *
 * Tanpa ini, penyerang bisa mengirim username seperti
 *   "foo\n[AUDIT] {\"action\":\"login.ok\"}"
 * dan menyisipkan baris log palsu. Log yang bisa dipalsukan tidak layak
 * jadi alat bukti — justru berbahaya, karena membuat(owner mengira
 * aktivitas aman padahal tidak.
 *
 * String dipotong juga supaya request gigantic tidak bisa membanjiri log.
 */
function sanitize(value, depth = 0) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value !== 'string') {
    // objek/array: sanitize satu tingkat, lalu potong agar tidak dalam.
    if (depth >= 2) return '[object]';
    if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitize(v, depth + 1));
    if (typeof value === 'object') {
      const out = {};
      for (const k of Object.keys(value).slice(0, 30)) {
        out[k.replace(/[^\w.@-]/g, '_').slice(0, 64)] = sanitize(value[k], depth + 1);
      }
      return out;
    }
    return String(value).slice(0, 256);
  }
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ').slice(0, 256);
}

/**
 * Catat satu kejadian.
 *
 * Tidak pernah melempar error: audit yang gagal menulis tidak boleh
 * menjatuhkan request yang sedang berjalan. Kalau log hilang, itu masalah
 * logging — bukan alasan admin panel mati.
 */
function audit(action, req, extra = {}) {
  try {
    const entry = sanitize({
      ts: new Date().toISOString(),
      action: String(action).slice(0, 64),
      adminId: req && req.admin ? req.admin.id : null,
      adminName: req && req.admin ? sanitize(req.admin.username, 1) : null,
      ipHash: hashIp(req && req.ip),
      ...extra,
    });
    process.stdout.write(`[AUDIT] ${JSON.stringify(entry)}\n`);
  } catch (err) {
    // stdout bisa ditutup (EPIPE) kalau prosesnya sedang shutting down.
    // Abaikan diam-diam.
    try {
      console.error('[AUDIT] gagal menulis:', err && err.code);
    } catch { /* tidak ada yang bisa dilakukan */ }
  }
}

/**
 * Kejadian keamanan (login gagal, dsb). Dipisah dari `audit` supaya mudah
 * difilter saat dicari: ini yang paling penting dilihat pagi hari.
 */
function auditSecurity(event, req, extra = {}) {
  audit(`security.${event}`, req, extra);
}

module.exports = { audit, auditSecurity, hashIp };