/**
 * Uji cache pemeriksaan auth (baris Admin untuk cap revokasi).
 *
 * Jalankan: node test-auth-cache.cjs
 *
 * Latar masalah: setiap request terautentikasi membaca baris Admin dari
 * database untuk mencocokkan cap `st`. Di Render itu satu bolak-balik ~365ms,
 * dan itulah sisa biaya terbesar setelah cache bacaan admin. Cache ini
 * menghapus query itu pada request-request berikutnya.
 *
 * Yang diuji di sini:
 *   1. cache benar-benar menghilangkan query pada request kedua;
 *   2. perubahan yang dilakukan PROSES LAIN tidak terlihat sampai TTL habis
 *      (tradeoff yang disengaja, dan batasnya adalah TTL);
 *   3. begitu cache kosong, perubahan itu langsung terlihat;
 *   4. ganti password dan logout membersihkan cache di proses ini seketika;
 *   5. TTL=0 mematikan cache; dan entri benar-benar hilang saat TTL lewat.
 *
 * DB: seperti test-admin-perf.cjs, memakai database sungguhan. Baris uji
 * bernama 'auth-cache-test' dan dihapus di akhir apa pun hasilnya.
 *
 * Exit 0 = semua lolos.
 */
'use strict';

const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

const ROOT = __dirname;

class FakeBot extends EventEmitter {
  on(ev, f) { super.on(ev, f); return this; }
  startPolling() { return Promise.resolve(); }
  stopPolling() { return Promise.resolve(); }
}
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'node-telegram-bot-api') return FakeBot;
  return origLoad.call(this, req, parent, isMain);
};

let ok = 0;
let gagal = 0;
function check(nama, kondisi, info = '') {
  if (kondisi) { ok++; console.log(`OK    ${nama}`); }
  else { gagal++; console.log(`GAGAL ${nama}   ${info}`); }
}

const TANDA = 'auth-cache-test';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// IP unik per login supaya limiter login (5/15 menit) tidak menghalangi
// pengujian yang memang butuh beberapa kali login.
let n = 0;
const ip = () => `10.66.${(n++ % 250) + 1}.${(n % 250) + 1}`;

(async () => {
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.PORT = '0';
  // TTL panjang untuk bagian integrasi: perilaku cache harus stabil tanpa
  // bergantung pada waktu. Kedaluwarsa TTL diuji terpisah di bagian 6.
  process.env.AUTH_CACHE_TTL_MS = '60000';

  const authCachePath = require.resolve(path.join(ROOT, 'src/lib/authCache'));

  const app = require(path.join(ROOT, 'src/index.js'));
  await sleep(700);
  const server = app.listen(0);
  await sleep(300);
  const BASE = `http://127.0.0.1:${server.address().port}`;

  const prisma = require(path.join(ROOT, 'src/lib/prisma'));
  const authCache = require(path.join(ROOT, 'src/lib/authCache'));
  const bcrypt = require('bcryptjs');

  const USER = `${TANDA}-admin`;
  const PASS = 'password-auth-cache-123';
  const PASS2 = 'password-auth-cache-123-baru';
  await prisma.admin.deleteMany({ where: { username: USER } });
  const dibuat = await prisma.admin.create({
    data: { username: USER, password: await bcrypt.hash(PASS, 10) },
  });

  const login = async (password) => {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip() },
      body: JSON.stringify({ username: USER, password }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  const first = await login(PASS);
  const token = first.body && first.body.token;
  check('login admin uji berhasil', !!token, `HTTP ${first.status}`);

  const me = async (tok) => {
    const r = await fetch(`${BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  };

  // Penghitung query pada client yang sama dengan yang dipakai middleware.
  let findCalls = 0;
  const asliFind = prisma.admin.findUnique.bind(prisma.admin);
  prisma.admin.findUnique = (...a) => { findCalls++; return asliFind(...a); };

  console.log('\n== 1. CACHE MENGURANGI QUERY ==\n');
  authCache.invalidate();
  findCalls = 0;
  let r = await me(token);
  check('permintaan pertama lolos', r.status === 200, `HTTP ${r.status}`);
  check('permintaan pertama membaca database', findCalls === 1, `findUnique=${findCalls}`);
  const setelahPertama = findCalls;
  r = await me(token);
  check('permintaan kedua lolos', r.status === 200, `HTTP ${r.status}`);
  check('permintaan kedua TIDAK membaca database', findCalls === setelahPertama,
    `findUnique=${findCalls}`);
  check('cache menyimpan baris admin', !!authCache.get(dibuat.id), 'kosong');

  console.log('\n== 2. PERUBAHAN PROSES LAIN TERTAHAN SAMPAI TTL ==\n');
  // Simulasi proses lain (instance kedua, atau skrip rotasi) yang mengubah
  // baris Admin tanpa memberi tahu proses ini. updatedAt naik, tapi cache
  // proses ini belum tahu.
  await prisma.admin.update({ where: { id: dibuat.id }, data: { username: USER } });
  findCalls = 0;
  r = await me(token);
  check('masih 200 selama cache belum kedaluwarsa (tradeoff)', r.status === 200,
    `HTTP ${r.status}`);
  check('dilayani cache, tidak menyentuh database', findCalls === 0, `findUnique=${findCalls}`);

  console.log('\n== 3. BEGITU CACHE KOSONG, PERUBAHAN TERLIHAT ==\n');
  authCache.invalidate(); // efek yang sama dengan TTL habis
  findCalls = 0;
  r = await me(token);
  check('perubahan proses lain kini terlihat -> 401', r.status === 401, `HTTP ${r.status}`);
  check('permintaan membaca database lagi', findCalls === 1, `findUnique=${findCalls}`);

  console.log('\n== 4. GANTI PASSWORD MEMBERSIHKAN CACHE SEKETIKA ==\n');
  const second = await login(PASS);
  const token2 = second.body && second.body.token;
  check('login ulang berhasil', !!token2, `HTTP ${second.status}`);
  await me(token2);
  check('cache terisi sebelum ganti password', !!authCache.get(dibuat.id), 'kosong');

  const ch = await fetch(`${BASE}/api/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
    body: JSON.stringify({ currentPassword: PASS, newPassword: PASS2 }),
  });
  check('change-password berhasil', ch.status === 200, `HTTP ${ch.status}`);
  check('cache dibersihkan oleh change-password', authCache.get(dibuat.id) === undefined,
    'masih terisi');
  r = await me(token2);
  check('token lama mati seketika -> 401', r.status === 401, `HTTP ${r.status}`);

  console.log('\n== 5. LOGOUT MEMBERSIHKAN CACHE SEKETIKA ==\n');
  const third = await login(PASS2);
  const token3 = third.body && third.body.token;
  check('login dengan password baru berhasil', !!token3, `HTTP ${third.status}`);
  await me(token3);
  check('cache terisi sebelum logout', !!authCache.get(dibuat.id), 'kosong');

  const lo = await fetch(`${BASE}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token3}` },
  });
  check('logout berhasil', lo.status === 200, `HTTP ${lo.status}`);
  check('cache dibersihkan oleh logout', authCache.get(dibuat.id) === undefined,
    'masih terisi');
  r = await me(token3);
  check('token mati seketika setelah logout -> 401', r.status === 401, `HTTP ${r.status}`);

  // Bersihkan penghitung sebelum lanjut.
  prisma.admin.findUnique = asliFind;

  console.log('\n== 6. TTL MODULE ==\n');
  const TTL_ASLI = process.env.AUTH_CACHE_TTL_MS;

  delete require.cache[authCachePath];
  process.env.AUTH_CACHE_TTL_MS = '200';
  const c = require(authCachePath);
  check('TTL terbaca dari env', c.TTL_MS === 200, `TTL=${c.TTL_MS}`);
  c.set('x', { id: 'x' });
  check('entri ada sebelum kedaluwarsa', c.get('x')?.id === 'x', 'kosong');
  await sleep(320);
  check('entri hilang setelah kedaluwarsa', c.get('x') === undefined, 'masih ada');

  delete require.cache[authCachePath];
  process.env.AUTH_CACHE_TTL_MS = '0';
  const c0 = require(authCachePath);
  check('TTL 0 berarti cache mati', c0.TTL_MS === 0, `TTL=${c0.TTL_MS}`);
  c0.set('y', { id: 'y' });
  check('TTL 0 menolak penyimpanan', c0.get('y') === undefined, 'tersimpan');
  process.env.AUTH_CACHE_TTL_MS = TTL_ASLI;

  // Bersih-bersih.
  const sisa = await prisma.admin.deleteMany({ where: { username: { startsWith: TANDA } } });
  server.close();
  await prisma.$disconnect();

  console.log(`\nbaris admin uji dibersihkan: ${sisa.count}`);
  console.log(`HASIL: ${ok} ok, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.stack); process.exit(1); });
