// Cache in-process untuk daftar menfes publik yang sudah disetujui.
//
// Cache hanya halaman 1. Karena limit dijepit 1..20, jumlah kunci maksimal 20
// dan tidak bisa digenomori oleh penyerang dengan mengirim page berbeda.
//
// TTL lewat MENFES_CACHE_TTL_MS (ms). Isi 0 mematikan cache sepenuhnya.

const TTL_MS = Number.parseInt(process.env.MENFES_CACHE_TTL_MS || '30000', 10) || 0;

const store = new Map();

function get(limit) {
  if (TTL_MS <= 0) return undefined;
  const hit = store.get(limit);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(limit);
    return undefined;
  }
  return hit.value;
}

function set(limit, value) {
  if (TTL_MS <= 0) return;
  if (store.size > 64) store.clear();
  store.set(limit, { value, expiresAt: Date.now() + TTL_MS });
}

function invalidate() {
  store.clear();
}

module.exports = { get, set, invalidate, TTL_MS };