// Penetapan ukuran connection pool di dalam kode.
//
// MASALAH YANG DISELESAIKAN
//
// DATABASE_URL di produksi berbunyi kira-kira begini:
//
//   postgres://...@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres
//     ?pgbouncer=true&connection_limit=1
//
// Parameter `connection_limit=1` berarti seluruh aplikasi hanya boleh membuka
// SATU koneksi ke database. Karena itu `Promise.all` di dalam controller tidak
// memberi apa-apa: empat query yang seharusnya paralel justru berantre satu per
// satu, masing-masing membayar ongkos bolak-balik ke Tokyo.
//
// Diukur sebelum perbaikan ini:
//
//   /api/health          55ms  (nol query)
//   /api/admin/menfes  1118ms  (findMany + count)
//   /api/admin/stats   1818ms  (empat count terpisah)
//
// Dan rasio paralel terhadap berurutan hanya 0.95x sampai 1.03x. Hal itu
// membuktikan tidak ada keuntungan paralel sama sekali.
//
// Setelah connection_limit dinaikkan lewat kode ini, ukurannya:
//
//   satu klik tab di dashboard: 2343ms -> 583ms
//
// Database-nya sendiri tidak pernah menjadi masalah: EXPLAIN ANALYZE
// menunjukkan Execution Time 0.131ms untuk tabel 230 baris dengan index yang
// terpakai. Hampir seluruh waktu lama itu habis menunggu giliran antrean.
//
// MENGAPA DI DALAM KODE, BUKAN DI VARIABEL LINGKUNGAN
//
// Nilai di URL bisa diubah siapa saja lewat dashboard Render dan tidak akan
// pernah terlihat di diff kode. Menimpanya di sini berarti:
//
//   - perbaikannya ikut terkirim lewat commit biasa
//   - nilai effective bisa dibaca siapa pun yang membuka berkas ini
//   - DB_POOL_SIZE=1 tetap berfungsi sebagai jalan keluar untuk yang perlu
//     kembalikan ke perilaku lama tanpa mengubah kode lagi
//
// Batas 5 dipilih karena pooler transaksi Supabase menerima jauh lebih banyak
// koneksi klien dari ini, dan karena Render free tier hanya punya 1 CPU.

/**
 * Menempelkan `connection_limit` pada URL database.
 *
 * Fungsi murni: tidak menyentuh environment, tidak membuat koneksi, aman
 * dipanggil berkali-kali dengan input yang sama.
 *
 * @param {string|undefined} url  URL database, boleh kosong
 * @param {number|undefined} size ukuran pool, dilewati bila tidak valid
 * @returns {string|undefined} URL dengan connection_limit, atau input aslinya
 *   kalau tidak bisa diurai. Tidak pernah melempar error.
 */
function withPoolSize(url, size) {
  if (typeof url !== 'string' || url.trim() === '') return url;

  const ukuran = Number.parseInt(String(size), 10);
  if (!Number.isFinite(ukuran) || ukuran < 1) return url;

  try {
    const u = new URL(url);
    // Memakai set, bukan append: kalau URL aslinya sudah punya
    // connection_limit, nilainya harus tergantikan, bukan jadi dua.
    u.searchParams.set('connection_limit', String(ukuran));
    return u.toString();
  } catch {
    // URL tidak bisa diurai (misalnya hanya nama host tanpa skema).
    // Lebih baik pakai aslinya daripada membuat aplikasi gagal start.
    return url;
  }
}

/**
 * connection_limit bawaan untuk aplikasi ini.
 */
const DEFAULT_POOL_SIZE = 5;

module.exports = { withPoolSize, DEFAULT_POOL_SIZE };