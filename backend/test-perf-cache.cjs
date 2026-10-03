/**
 * Uji cache daftar publik dan clamp pagination. Jalankan: node test-perf-cache.cjs
 *
 * App dijalankan DI PROSES YANG SAMA (bukan spawn), supaya cache dan prisma
 * yang di-patch di sini benar-benar objek yang dipakai controller.
 *
 * Exit 0 = semua lolos.
 */
'use strict';

const path = require('path');
const Module = require('module');
const { EventEmitter } = require('events');

const ROOT = path.join(__dirname);

// Modul Telegram di-stub supaya tidak ada request sungguhan keluar.
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

(async () => {
  process.env.TELEGRAM_BOT_TOKEN = '999999:FAKE-TOKEN-FOR-PERF-TEST';
  process.env.PORT = '0';
  process.env.MENFES_CACHE_TTL_MS = '30000';

  const app = require(path.join(ROOT, 'src/index.js'));
  await new Promise((r) => setTimeout(r, 700));
  const server = app.listen(0);
  await new Promise((r) => setTimeout(r, 300));
  const BASE = `http://127.0.0.1:${server.address().port}`;

  const cache = require(path.join(ROOT, 'src/lib/menfesCache'));
  const prisma = require(path.join(ROOT, 'src/lib/prisma'));

  const get = async (p) => {
    const r = await fetch(BASE + p);
    return { status: r.status, body: await r.json() };
  };

  // Penghitung query di client yang sama dengan yang dipakai controller.
  let calls = 0;
  const asli = prisma.menfes.findMany.bind(prisma.menfes);
  prisma.menfes.findMany = (...a) => { calls++; return asli(...a); };

  const probe = await prisma.menfes.create({
    data: { message: `perf cache probe ${Date.now()}`, status: 'APPROVED', approvedAt: new Date() },
  });

  console.log('\n== 1. CLAMP PAGINATION ==');
  for (const q of ['limit=-5', 'limit=-1', 'limit=0', 'limit=99999', 'page=-3', 'page=99999999']) {
    const { body } = await get(`/api/menfes?${q}`);
    const p = body.pagination;
    check(`${q} -> limit 1..20 dan page 1..100`,
      p.limit >= 1 && p.limit <= 20 && p.page >= 1 && p.page <= 100,
      `limit=${p.limit} page=${p.page}`);
    check(`${q} -> totalPages tidak negatif`, p.totalPages >= 0, `totalPages=${p.totalPages}`);
  }

  console.log('\n== 2. CACHE HIT ==');
  cache.invalidate();
  calls = 0;
  const first = await get('/api/menfes?limit=10');
  const afterMiss = calls;
  const second = await get('/api/menfes?limit=10');
  const afterHit = calls;

  check('request pertama query database', afterMiss === 1, `calls=${afterMiss}`);
  check('request kedua TIDAK query database', afterHit === afterMiss, `calls=${afterHit}`);
  check('kedua respons identik', JSON.stringify(first.body) === JSON.stringify(second.body));
  check('probe ada di respons', first.body.data.some((m) => m.id === probe.id), 'tidak ketemu');

  console.log('\n== 3. HALAMAN 2 TIDAK DI-CACHE ==');
  calls = 0;
  await get('/api/menfes?page=2&limit=10');
  await get('/api/menfes?page=2&limit=10');
  check('halaman 2 selalu query database', calls === 2, `calls=${calls}`);

  console.log('\n== 4. INVALIDATE LEWAT ADMIN CONTROLLER ==');
  // Sengaja lewat HTTP, bukan update langsung ke database. Cache hanya
  // di-invalidate oleh adminController; menulis langsung ke DB memang TIDAK
  // membatalkannya, jadi menguji jalur controller adalah satu-satunya cara
  // membuktikan kabelnya tersambung.
  const bcrypt = require('bcryptjs');
  const USER = 'perf-cache-admin';
  const PASS = 'password-perf-cache-123';
  await prisma.admin.deleteMany({ where: { username: USER } });
  await prisma.admin.create({
    data: { username: USER, password: await bcrypt.hash(PASS, 10) },
  });
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const token = (await login.json()).token;
  check('login admin berhasil', !!token, `HTTP ${login.status}`);

  const pending = await prisma.menfes.create({
    data: { message: `perf invalidasi ${Date.now()}`, status: 'PENDING' },
  });

  // Panaskan cache publik dulu, lalu pastikan item pending memang belum ada.
  cache.invalidate();
  let pub = await get('/api/menfes?limit=10');
  check('menfes PENDING tidak muncul di publik', !pub.body.data.some((m) => m.id === pending.id));

  const appr = await fetch(`${BASE}/api/admin/menfes/${pending.id}/approve`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  check('approve admin berhasil', appr.status === 200, `HTTP ${appr.status}`);

  // Tanpa invalidate, cache masih menyimpan daftar lama dan item ini tak muncul.
  pub = await get('/api/menfes?limit=10');
  check('menfes yang baru di-approve langsung terlihat publik',
    pub.body.data.some((m) => m.id === pending.id), 'tidak muncul -> invalidate tidak jalan');

  const rej = await fetch(`${BASE}/api/admin/menfes/${pending.id}/reject`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  check('reject admin berhasil', rej.status === 200, `HTTP ${rej.status}`);
  pub = await get('/api/menfes?limit=10');
  check('menfes yang di-reject hilang dari publik',
    !pub.body.data.some((m) => m.id === pending.id), 'masih muncul');

  // Bukti langsung: invalidate memaksa controller query ulang.
  cache.invalidate();
  calls = 0;
  await get('/api/menfes?limit=10');
  check('invalidate memaksa query ulang', calls === 1, `calls=${calls}`);

  console.log('\n== 5. CACHE MATI KALAU TTL=0 ==');
  const TTL_ASLI = process.env.MENFES_CACHE_TTL_MS;
  process.env.MENFES_CACHE_TTL_MS = '0';
  delete require.cache[require.resolve(path.join(ROOT, 'src/lib/menfesCache'))];
  const cacheMati = require(path.join(ROOT, 'src/lib/menfesCache'));
  check('TTL 0 berarti tidak ada yang tersimpan',
    cacheMati.get(10) === undefined && cacheMati.TTL_MS === 0, `TTL=${cacheMati.TTL_MS}`);
  process.env.MENFES_CACHE_TTL_MS = TTL_ASLI;

  prisma.menfes.findMany = asli;
  await prisma.menfes.delete({ where: { id: pending.id } });
  await prisma.menfes.delete({ where: { id: probe.id } });
  await prisma.admin.deleteMany({ where: { username: USER } });
  cache.invalidate();
  server.close();
  await prisma.$disconnect();

  console.log(`\nHASIL: ${ok} ok, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });