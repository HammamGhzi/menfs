// Cache in-process untuk hasil bacaan dashboard admin.
//
// KENAPA MODULE TERPISAH DARI menfesCache.js
//
// Cache publik hanya menyimpan empat field yang memang sudah dirancang untuk
// dipublikasikan: id, message, approvedAt, createdAt.
//
// Cache admin menyimpan respons yang memuat senderName, senderInfo, dan ipHash
// untuk setiap menfes. Meletakkannya di modul terpisah dengan TTL sendiri
// membuat dua hal ini eksplisit:
//
//   - batas kebocoran keduanya bisa diatur terpisah
//   - ADMIN_CACHE_TTL_MS=0 mematikan cache admin tanpa menyentuh cache publik
//
// Kenapa cache ini dibutuhkan: setelah connection pool diperbaiki, satu klik
// tab tetap membayar satu bolak-balik database yang tidak bisa dikecilkan dari
// kode. Cache inilah yang membuat klik kedua dan seterusnya terasa seketika.
//
// TTL jauh lebih pendek dari cache publik (bawaan 10 detik, bukan 30). Alasannya
// instance lain masih bisa menulis ke database yang sama tanpa memberi tahu
// proses ini. Selama instance lain masih hidup, TTL pendek inilah satu-satunya
// batas penuaan data yang terjamin.
//
// Cache ini per-proses dan sengaja tidak persisten: kalau proses restart, isi
// cache hilang dan pembacaan ulang dari database adalah perilaku yang benar.

const TTL_MS = Number.parseInt(process.env.ADMIN_CACHE_TTL_MS || '10000', 10) || 0;

// Kunci dibentuk dari status yang sudah divalidasi, page 1..100, dan limit 1..50,
// jadi ruang kuncinya terbatas dan tidak bisa digenomari seperti cache publik
// yang harus dijaga dengan page === 1.
const store = new Map();

const MAX_ENTRIES = 64;

function get(key) {
  if (TTL_MS <= 0) return undefined;
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value;
}

function set(key, value) {
  if (TTL_MS <= 0) return;
  // Kebijakan pembuangan yang sama dipakai menfesCache: kalau kunci bertambah
  // tidak terkendali, kosongkan sekaligus. Lebih sederhana daripada LRU dan
  // volumenya memang kecil.
  if (store.size > MAX_ENTRIES) store.clear();
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

function invalidate() {
  store.clear();
}

module.exports = { get, set, invalidate, TTL_MS };