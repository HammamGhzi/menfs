// Cache in-process untuk baris Admin yang dibaca middleware auth.
//
// MASALAH YANG DISELESAIKAN
//
// Setiap request terautentikasi membaca baris Admin dari database untuk
// mencocokkan cap revokasi `st` (lihat src/lib/token.js). Di Render, satu
// bolak-balik ke database Tokyo memakan ~365ms. Setelah cache bacaan admin
// menghapus biaya pengambilan data dashboard, query ini adalah sisa biaya
// terbesar pada setiap klik admin. Cache ini menghapusnya pada request-request
// berikutnya.
//
// TRADEOFF YANG DISENGAJA
//
// Cache ini per-proses. Kalau PROSES LAIN mengubah baris Admin (instance kedua,
// atau skrip rotasi yang menyentuh instance lain), proses ini tidak diberi
// tahu; token yang baru saja dicabut di sana masih dilayani di sini sampai TTL
// habis. Karena itu TTL-nya pendek. Batas penuaan yang terjamin = TTL_MS.
//
// Di dalam proses ini sendiri tidak ada kelambatan: ganti password dan logout
// memanggil invalidate() seketika, jadi token dicabut langsung mati di proses
// yang melayani permintaan itu.
//
// Fail-closed tetap terjaga: proses yang baru start punya cache kosong, dan
// kalau database tidak terbaca saat itu, request ditolak 503. Cache hanya
// menyimpan hasil bacaan database yang benar-benar berhasil.
//
// AUTH_CACHE_TTL_MS=0 mematikan cache ini sepenuhnya, tanpa menyentuh cache
// admin maupun cache publik.

const TTL_MS = Number.parseInt(process.env.AUTH_CACHE_TTL_MS || '10000', 10) || 0;

// Panel ini hanya punya satu admin, jadi ruang kuncinya praktis satu. Batas
// entri tetap dipasang supaya kunci tidak tumbuh tak terkendali kalau nanti
// baris admin bertambah.
const store = new Map();

const MAX_ENTRIES = 64;

function get(id) {
  if (TTL_MS <= 0) return undefined;
  const hit = store.get(id);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(id);
    return undefined;
  }
  return hit.value;
}

function set(id, admin) {
  if (TTL_MS <= 0) return;
  if (store.size > MAX_ENTRIES) store.clear();
  store.set(id, { value: admin, expiresAt: Date.now() + TTL_MS });
}

function invalidate() {
  store.clear();
}

module.exports = { get, set, invalidate, TTL_MS };
