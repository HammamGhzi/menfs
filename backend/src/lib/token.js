const jwt = require('jsonwebtoken');

/**
 * Revocasi token tanpa tabel tambahan.
 *
 * MASALAH YANG DISELESAIKAN
 *
 * Token yang sudah terbit tetap valid sampai kedaluwarsa, apa pun yang
 * terjadi pada password. Jadi rotasi password tidak mengeluarkan siapa pun
 * yang sudah memegang token: pintunya diganti, tapi kuncinya masih nempel
 * sampai 24 jam.
 *
 * CARA KERJANYA
 * Setiap token membawa klaim `st` = nilai `updatedAt` baris Admin pada saat
 * token itu dibuat. Kolom `updatedAt` sudah ada di schema dan beranotasi
 * @updatedAt, jadi Prisma memperbaruinya otomatis pada setiap update baris
 * Admin — termasuk update password yang sudah dilakukan change-password.
 *
 * Memakai kolom yang sudah ada deliberate, bukan sekadar Hemat baris kode:
 * menambah kolom berarti menambah migrasi, dan di repo ini sisi PostgreSQL
 * (produksi) memakai `prisma migrate deploy` sementara sisi MariaDB lokal
 * memakai `prisma db push` tanpa folder migration. Dua sisi itu bisa
 * divergen diam-diam. Dengan cara ini tidak ada yang perlu di-migrate.
 *
 * AKIBATNYA
 * - Ganti password -> semua token lama mati, kecuali yang baru diterbitkan.
 * - Logout       -> semua token mati, termasuk yang sedang dipakai.
 * - Update baris Admin lain di masa depan (misal ganti username) juga akan
 *   mengeluarkan semua sesi. Ganggu, bukan tidak aman.
 *
 * BUKTI
 * scripts/prove-token-revocation.cjs membuktikannya terhadap database sungguhan:
 * update password memang menaikkan updatedAt (termasuk saat passwordnya sama
 * persis), presisi milidetik bertahan, dan `data: {}` ditolak Prisma sehingga
 * logout harus menulis field nyata.
 */

/**
 * Terbitkan token untuk satu admin.
 *
 * `admin` harus berisi `updatedAt`. Dipakai oleh login dan change-password
 * (untuk menerbitkan token pengganti), jadi bentuk klaimnya tidak boleh
 * berbeda di antara keduanya.
 */
function issueToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      username: admin.username,
      st: admin.updatedAt.getTime(),
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

/**
 * True kalau token ini masih berlaku untuk baris admin saat ini.
 *
 * Token tanpa `st` (misalnya token yang terbit sebelum perubahan ini
 * di-deploy) otomatis tidak valid. Itu disengaja: deploy ini adalah
 * kesempatan untuk mencabut seluruh token yang pernah terbit, termasuk yang
 * dipegang penyerang yang berhasil login dengan password bocor.
 */
function isCurrentStamp(decoded, admin) {
  return typeof decoded.st === 'number' && decoded.st === admin.updatedAt.getTime();
}

module.exports = { issueToken, isCurrentStamp };
