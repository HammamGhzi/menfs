/**
 * Rotasi password admin produksi.
 *
 * Dijalankan oleh PEMILIK repo, bukan oleh agent — karena involves
 * kredensial asli. Script ini melakukan:
 *   1. login pakai password lama
 *   2. ganti ke password baru yang di-generate
 *   3. logout-mu: print password baru untuk disimpan di password manager
 *
 * Jalankan:  node rotate-admin-password.mjs
 * Akan meminta password lama secara interaktif (tidak tersimpan di history).
 */
import readline from 'node:readline';
import crypto from 'node:crypto';

const BASE = process.env.ROTATE_TARGET || 'https://menfs.onrender.com';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function askHidden(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const output = process.stdout;
    const onData = (char) => {
      if (['\n', '\r', ''].includes(String(char))) {
        stdin.removeListener('data', onData);
      } else {
        return;
      }
      output.write('\n');
      resolve(answer);
    };
    let answer = '';
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on('data', onData);
    output.write(question);
  });
}

const ask = (q) => new Promise((r) => rl.question(q, r));

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const oldPassword = await askHidden('Password admin saat ini: ');
console.log('');

console.log('→ Mencoba login...');
const login = await api('/api/auth/login', {
  method: 'POST',
  body: JSON.stringify({ username: 'admin', password: oldPassword }),
});

if (login.status === 429) {
  console.error('\n⛔ Rate limit login aktif (5 percobaan / 15 menit).');
  console.error('   Tunggu 15 menit lalu jalankan lagi. Password tidak diubah.');
  process.exit(1);
}
if (login.status !== 200) {
  console.error(`\n⛔ Login gagal (HTTP ${login.status}): ${JSON.stringify(login.body)}`);
  console.error('   Password tidak diubah. Periksa password lama.');
  process.exit(1);
}

console.log('✅ Login berhasil. Token didapat.');

// Generate password kuat yang mudah diketik ulang tapi panjang
const newPassword = `${crypto.randomBytes(9).toString('base64url')}-${crypto.randomBytes(9).toString('base64url')}`;
console.log(`→ Password baru di-generate (${newPassword.length} karakter).`);

const change = await api('/api/auth/change-password', {
  method: 'POST',
  headers: { Authorization: `Bearer ${login.body.token}` },
  body: JSON.stringify({ currentPassword: oldPassword, newPassword }),
});

if (change.status !== 200) {
  console.error(`\n⛔ Ganti password gagal (HTTP ${change.status}): ${JSON.stringify(change.body)}`);
  console.error('   Password lama masih berlaku. Tidak ada yang berubah.');
  process.exit(1);
}

console.log('\n' + '='.repeat(66));
console.log('✅ PASSWORD ADMIN SUDAH DIGANTI');
console.log('='.repeat(66));
console.log('\nPassword baru (SIMPAN SEKARANG di password manager):\n');
console.log(`   ${newPassword}\n`);
console.log('Langkah berikutnya:');
console.log('  1. Simpan password di atas sekarang juga.');
console.log('  2. Hapus file ini setelah tidak dipakai lagi.');
console.log('  3. Verifikasi: buka admin panel, login dengan password baru.');
console.log('  4. Password lama (admin123) sudah tidak berlaku.');

rl.close();
process.exit(0);