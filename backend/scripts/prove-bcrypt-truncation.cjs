/**
 * Bukti: bcrypt MEMOTONG input di 72 byte tanpa memberi error.
 *
 * Ini yang membuat batas panjang password jadi penting, bukan sekadar
 * penghematan CPU. Kalau password yang tersimpan lebih dari 72 byte,
 * maka siapa pun yang hanya tahu 72 byte PERTAMA akan tetap bisa login
 * sisa passwordnya tidak pernah dicek sama sekali.
 */
const bcrypt = require('bcryptjs');

(async () => {
  console.log('=== 1. Suffix diabaikan ===');
  const asli = 'A'.repeat(72) + 'RAHASIA';
  const hash = await bcrypt.hash(asli, 4);
  console.log('  tersimpan       : 72x A + "RAHASIA" (' + asli.length + ' karakter)');

  const banyakZ = await bcrypt.compare('A'.repeat(72) + 'Z'.repeat(500), hash);
  console.log('  72x A + 500x Z : ' + (banyakZ ? 'DITERIMA  <-- password berbeda tetap masuk' : 'ditolak'));

  const sembarang = await bcrypt.compare('A'.repeat(72) + 'apa saja', hash);
  console.log('  72x A + "apa saja": ' + (sembarang ? 'DITERIMA  <-- siapa pun yang tahu 72 A pertama bisa login' : 'ditolak'));

  const batas = await bcrypt.compare('A'.repeat(71) + 'B', hash);
  console.log('  71x A + "B"    : ' + (batas ? 'DITERIMA' : 'ditolak, batas tepat di 72'));

  console.log('');
  console.log('=== 2. Yang dihitung adalah BYTE, bukan karakter ===');
  const emoji = 'X'.repeat(40) + '\u{1F600}'.repeat(30);
  const byte = Buffer.byteLength(emoji, 'utf8');
  console.log('  40 huruf + 30 emoji: ' + emoji.length + ' karakter, ' + byte + ' byte');
  console.log('  Panjang karakter (< 72) tapi byte-nya (' + byte + ') MELEBIHI 72.');
  const h2 = await bcrypt.hash(emoji, 4);
  const dipotong = emoji.slice(0, 72);
  console.log('  compare 72 karakter pertama -> '
    + (await bcrypt.compare(dipotong, h2) ? 'DITERIMA (terpotong)' : 'ditolak'));

  const emoji72 = '\u{1F600}'.repeat(72);
  const h3 = await bcrypt.hash(emoji72, 4);
  console.log('  72 emoji (288 byte) vs 24 emoji pertama (96 byte): '
    + (await bcrypt.compare('\u{1F600}'.repeat(24), h3) ? 'DITERIMA' : 'ditolak'));
  console.log('  72 emoji vs 72 emoji                             : '
    + (await bcrypt.compare(emoji72, h3) ? 'DITERIMA' : 'ditolak'));

  console.log('');
  console.log('=== 3. Celah yang masih terbuka di aplikasi ini ===');
  console.log('  changePassword SUDAH menolak > 72 byte (baris 109-114).');
  console.log('  Tapi itu belum menutup dua hal:');
  console.log('   a) login() tidak punya batas panjang sama sekali;');
  console.log('   b) prisma/seed.js hanya enforces min 12, TANPA batas maksimal.');

  const seedPass = 'S'.repeat(72) + 'RAHASIA-SEED';
  const seedHash = await bcrypt.hash(seedPass, 4);
  const hanya72 = await bcrypt.compare('S'.repeat(72), seedHash);
  console.log('');
  console.log('  seed dengan 72x S + "RAHASIA-SEED":');
  console.log('  orang yang hanya tahu 72x S -> '
    + (hanya72 ? 'BISA LOGIN. bagian rahasia tidak pernah dicek.' : 'ditolak'));
})();