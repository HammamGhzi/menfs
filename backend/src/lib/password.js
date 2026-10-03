/**
 * Aturan panjang password, dipakai bersama oleh login, change-password
 * dan seed.
 *
 * Kenapa 72 byte dan bukan 72 karakter:
 * bcrypt hanya membaca 72 byte PERTAMA dari input, lalu membuang sisanya
 * TANPA memberi error. Bukti eksekusinya ada di
 * scripts/prove-bcrypt-truncation.cjs:
 *
 *   hash("A" x 72 + "RAHASIA")  ==  hash("A" x 72 + "Z" x 500)
 *
 * Artinya kalau sebuah password lebih dari 72 byte, siapa pun yang hanya
 * tahu 72 byte pertama tetap bisa login, dan bagian rahasia di belakang
 * 72 byte itu tidak pernah dicek. Menolak input yang lebih panjang membuat
 * batas yang diverifikasi sama dengan batas yang di-hash.
 *
 * Multibyte penting: 30 emoji itu 30 karakter tapi 120 byte, sehingga
 * pengecekan `password.length > 72` akan lolos padahal isinya sudah
 * terpotong. Karena itu yang diukur adalah byte.
 */

// Batas keras bcrypt. Tidak bisa dinegosiasikan tanpa mengganti algoritma.
const MAX_PASSWORD_BYTES = 72;

// Minimum untuk ganti password lewat panel.
const MIN_PASSWORD_LENGTH = 8;

// Minimum untuk seed: lebih tinggi karena seed dijalankan sekali di
// server dengan akses database, bukan lewat UI.
const MIN_SEED_PASSWORD_LENGTH = 12;

/**
 * Panjang dalam BYTE, aman untuk string apa pun.
 */
function byteLength(password) {
  return Buffer.byteLength(String(password), 'utf8');
}

/**
 * True kalau password melebihi batas bcrypt.
 */
function exceedsBcryptLimit(password) {
  return byteLength(password) > MAX_PASSWORD_BYTES;
}

module.exports = {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  MIN_SEED_PASSWORD_LENGTH,
  byteLength,
  exceedsBcryptLimit,
};