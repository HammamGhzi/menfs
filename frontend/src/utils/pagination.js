// Logika murni paginasi. Tidak menyentuh DOM dan tidak mengimpor apa pun,
// supaya bisa diuji dengan `node --test` tanpa test runner tambahan.

/**
 * Jumlah halaman. Mengembalikan 0 kalau memang tidak ada data, supaya
 * pemanggil bisa membedakan "tidak ada data" dari "satu halaman kosong".
 */
export function pageCount(total, limit) {
  if (!Number.isFinite(total) || !Number.isFinite(limit)) return 0;
  if (total <= 0 || limit <= 0) return 0;
  return Math.ceil(total / limit);
}

/**
 * Jaga nomor halaman tetap di dalam 1..totalPages. Kalau belum ada halaman
 * sama sekali (totalPages 0), tetap kembalikan 1 supaya permintaan pertama
 * tidak jatuh ke halaman nol.
 */
export function clampPage(page, totalPages) {
  const p = Number.parseInt(page, 10);
  if (!Number.isFinite(p) || p < 1) return 1;
  const max = totalPages > 0 ? totalPages : 1;
  return Math.min(p, max);
}

/**
 * Daftar token untuk tombol nomor halaman. Angka adalah nomor halaman,
 * '…' adalah penanda lompatan.
 *
 * Kalau halaman sedikit (<= 7) semua ditampilkan. Kalau banyak, hanya
 * halaman pertama, terakhir, dan jendela di sekitar halaman aktif yang
 * ditampilkan, dengan elipsis sebagai pengganti bagian yang disembunyikan.
 */
export function paginationItems(current, totalPages) {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return [];

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const c = clampPage(current, totalPages);
  const items = [1];
  const start = Math.max(2, c - 1);
  const end = Math.min(totalPages - 1, c + 1);

  if (start > 2) items.push('…');
  for (let p = start; p <= end; p++) items.push(p);
  if (end < totalPages - 1) items.push('…');
  items.push(totalPages);

  return items;
}
