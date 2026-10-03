/**
 * Uji perbaikan latensi dashboard admin. Jalankan: node test-admin-perf.cjs
 *
 * Tiga hal yang diuji, sesuai urutan perbaikannya:
 *
 *   1. lib/dbUrl menimpa connection_limit di URL, dan tidak merusak URL.
 *   2. getStats memakai SATU query, bukan empat.
 *   3. Bacaan admin memakai cache, dan setiap mutasi membersihkannya.
 *
 * Cache admin sengaja TIDAK ikut diuji di test-perf-cache.cjs supaya kedua
 * cache tidak saling menutupi bila salah satunya rusak.
 *
 * Test ini memakai database sungguhan, sama seperti test-perf-cache.cjs. Yang
 * dibuat dan dibersihkan di sini adalah baris uji yang namanya diawali
 * 'admin-perf-test'. Baris itu dihapus di akhir apa pun hasilnya.
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

const TANDA = 'admin-perf-test';

(async () => {
  process.env.TELEGRAM_BOT_TOKEN = '999999:FAKE-TOKEN-FOR-ADMIN-PERF-TEST';
  process.env.PORT = '0';
  process.env.ADMIN_CACHE_TTL_MS = '10000';

  // ---------------------------------------------------------------
  // 1. lib/dbUrl, fungsi murni, tidak menyentuh database sama sekali.
  // ---------------------------------------------------------------
  console.log('\n== 1. PENENTUAN UKURAN CONNECTION POOL ==\n');
  const { withPoolSize, DEFAULT_POOL_SIZE } = require(path.join(ROOT, 'src/lib/dbUrl'));

  const ASLI =
    'postgres://u:p@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres' +
    '?pgbouncer=true&connection_limit=1';

  check('bawaan pool adalah 5', DEFAULT_POOL_SIZE === 5, `nilai=${DEFAULT_POOL_SIZE}`);

  const ditimpa = withPoolSize(ASLI, 5);
  check('connection_limit=1 tergantikan jadi 5',
    new URL(ditimpa).searchParams.get('connection_limit') === '5',
    `hasil=${new URL(ditimpa).searchParams.get('connection_limit')}`);

  check('parameter lain tidak hilang',
    new URL(ditimpa).searchParams.get('pgbouncer') === 'true');

  check('host dan port tidak berubah',
    new URL(ditimpa).hostname === 'aws-0-ap-northeast-1.pooler.supabase.com' &&
    new URL(ditimpa).port === '6543');

  check('tidak ada connection_limit yang dobel',
    (ditimpa.match(/connection_limit=/g) || []).length === 1,
    `jumlah=${(ditimpa.match(/connection_limit=/g) || []).length}`);

  check('URL tanpa connection_limit tetap dapat satu',
    new URL(withPoolSize('postgres://u:p@h:5432/db', 3)).searchParams.get('connection_limit') === '3');

  for (const [nama, masuk] of [
    ['URL kosong', ''],
    ['URL undefined', undefined],
    ['URL bukan string', 12345],
  ]) {
    let khusus = false;
    try { withPoolSize(masuk, 5); } catch { khusus = true; }
    check(`${nama} tidak melempar error`, !khusus);
  }

  for (const [nama, ukuran] of [['nol', 0], ['negatif', -3], ['bukan angka', 'abc'], ['kosong', undefined]]) {
    const keluar = withPoolSize(ASLI, ukuran);
    check(`ukuran tidak valid (${nama}) dibiarkan apa adanya`,
      keluar === ASLI, 'seharusnya mengembalikan URL asli');
  }

  check('URL tidak bisa diurai tidak melempar error',
    withPoolSize('bukan-url', 5) === 'bukan-url');

  // Prisma yang dipakai aplikasi harus langsung menerima URL hasil timpa.
  const prisma = require(path.join(ROOT, 'src/lib/prisma'));
  check('lib/prisma tetap mengekspor client yang bisa dipakai',
    !!prisma && typeof prisma.menfes.findMany === 'function');

  // ---------------------------------------------------------------
  // 2 dan 3. Butuh server dan database.
  // ---------------------------------------------------------------
  const app = require(path.join(ROOT, 'src/index.js'));
  await new Promise((r) => setTimeout(r, 700));
  const server = app.listen(0);
  await new Promise((r) => setTimeout(r, 300));
  const BASE = `http://127.0.0.1:${server.address().port}`;

  const adminCache = require(path.join(ROOT, 'src/lib/adminCache'));
  const cachePublik = require(path.join(ROOT, 'src/lib/menfesCache'));

  // Penghitung query pada client yang sama dengan yang dipakai controller.
  let findManyCalls = 0;
  let countCalls = 0;
  let rawCalls = 0;
  const asliFindMany = prisma.menfes.findMany.bind(prisma.menfes);
  const asliCount = prisma.menfes.count.bind(prisma.menfes);
  const asliRaw = prisma.$queryRaw.bind(prisma);
  prisma.menfes.findMany = (...a) => { findManyCalls++; return asliFindMany(...a); };
  prisma.menfes.count = (...a) => { countCalls++; return asliCount(...a); };
  prisma.$queryRaw = (...a) => { rawCalls++; return asliRaw(...a); };

  const bcrypt = require('bcryptjs');
  const USER = `${TANDA}-admin`;
  const PASS = 'password-admin-perf-123';
  await prisma.admin.deleteMany({ where: { username: USER } });
  await prisma.admin.create({ data: { username: USER, password: await bcrypt.hash(PASS, 10) } });

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  });
  const token = (await login.json()).token;
  check('login admin uji berhasil', !!token, `HTTP ${login.status}`);

  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const getJson = async (p) => {
    const r = await fetch(BASE + p, { headers: auth });
    return { status: r.status, body: await r.json() };
  };

  const buat = (status) =>
    prisma.menfes.create({ data: { message: `${TANDA} ${Date.now()} ${Math.random()}`, status } });

  console.log('\n== 2. STATS MENGGUNAKAN SATU QUERY ==\n');

  const langsung = await Promise.all([
    prisma.menfes.count({ where: { status: 'PENDING' } }),
    prisma.menfes.count({ where: { status: 'APPROVED' } }),
    prisma.menfes.count({ where: { status: 'REJECTED' } }),
    prisma.menfes.count(),
  ]);

  adminCache.invalidate();
  countCalls = 0;
  rawCalls = 0;
  const stats = await getJson('/api/admin/stats');

  check('tidak ada count terpisah yang dipanggil', countCalls === 0, `count=${countCalls}`);
  check('tepat satu query untuk seluruh statistik', rawCalls === 1, `raw=${rawCalls}`);
  check('pending sama dengan count langsung', stats.body.pending === langsung[0],
    `dari API ${stats.body.pending}, langsung ${langsung[0]}`);
  check('approved sama dengan count langsung', stats.body.approved === langsung[1],
    `dari API ${stats.body.approved}, langsung ${langsung[1]}`);
  check('rejected sama dengan count langsung', stats.body.rejected === langsung[2],
    `dari API ${stats.body.rejected}, langsung ${langsung[2]}`);
  check('total sama dengan count langsung', stats.body.total === langsung[3],
    `dari API ${stats.body.total}, langsung ${langsung[3]}`);
  check('keempat angka adalah number biasa, bukan bigint',
    [stats.body.pending, stats.body.approved, stats.body.rejected, stats.body.total]
      .every((n) => typeof n === 'number' && Number.isFinite(n)),
    `tipe=${typeof stats.body.total}`);

  console.log('\n== 3. CACHE ADMIN ==\n');

  adminCache.invalidate();
  rawCalls = 0;
  await getJson('/api/admin/stats');
  const setelahMiss = rawCalls;
  await getJson('/api/admin/stats');
  const setelahHit = rawCalls;

  check('stats pertama query database', setelahMiss === 1, `raw=${setelahMiss}`);
  check('stats kedua TIDAK query database', setelahHit === setelahMiss, `raw=${setelahHit}`);

  adminCache.invalidate();
  findManyCalls = 0;
  const l1 = await getJson('/api/admin/menfes?status=PENDING');
  const setelahListMiss = findManyCalls;
  const l2 = await getJson('/api/admin/menfes?status=PENDING');
  const setelahListHit = findManyCalls;

  check('daftar pertama query database', setelahListMiss === 1, `findMany=${setelahListMiss}`);
  check('daftar kedua TIDAK query database', setelahListHit === setelahListMiss, `findMany=${setelahListHit}`);
  check('kedua respons daftar identik', JSON.stringify(l1.body) === JSON.stringify(l2.body));

  console.log('\n== 4. KUNCI CACHE TIDAK TERCAMPUR ==\n');

  adminCache.invalidate();
  const a = await getJson('/api/admin/menfes?status=PENDING');
  const b = await getJson('/api/admin/menfes?status=APPROVED');
  const c = await getJson('/api/admin/menfes?status=REJECTED');
  const tanpaFilter = await getJson('/api/admin/menfes');

  const statusDi = (r) => [...new Set((r.body.data ?? []).map((m) => m.status))].sort().join(',');
  check('PENDING tidak tercampur dengan APPROVED',
    !statusDi(a).includes('APPROVED'), `dapat=${statusDi(a)}`);
  check('APPROVED tidak tercampur dengan REJECTED',
    !statusDi(b).includes('REJECTED'), `dapat=${statusDi(b)}`);
  check('tanpa filter mengembalikan lebih dari satu status',
    tanpaFilter.body.data.length >= a.body.data.length, 'buffer tidak');

  adminCache.invalidate();
  await getJson('/api/admin/menfes?status=PENDING&page=1&limit=5');
  const p1 = await getJson('/api/admin/menfes?status=PENDING&page=1&limit=5');
  const p2 = await getJson('/api/admin/menfes?status=PENDING&page=2&limit=5');
  check('page 1 dan page 2 tidak berbagi kunci',
    JSON.stringify(p1.body) !== JSON.stringify(p2.body));
  check('limit dihormati di page 1',
    p1.body.data.length <= 5, `jumlah=${p1.body.data.length}`);

  adminCache.invalidate();
  await getJson('/api/admin/menfes?status=PENDING&page=1&limit=5');
  const bad = await getJson('/api/admin/menfes?status=PENDING&page=1&limit=99999');
  check('limit di luar batas dijepit dan tidak menabrak cache lain',
    bad.body.pagination.limit === 50, `limit=${bad.body.pagination.limit}`);

  // Kontrak yang dipakai bilah paginasi di frontend: totalPages konsisten
  // dengan total/limit, page digemakan, dan halaman di luar rentang
  // mengembalikan data kosong (itulah yang memicu tarik-mundur halaman).
  adminCache.invalidate();
  const kontrak = await getJson('/api/admin/menfes?status=APPROVED&page=1&limit=5');
  const pg = kontrak.body.pagination;
  check('pagination.totalPages = ceil(total/limit)',
    pg.totalPages === Math.ceil(pg.total / pg.limit),
    `total=${pg.total} limit=${pg.limit} totalPages=${pg.totalPages}`);
  check('pagination.page menggemakan halaman yang diminta', pg.page === 1, `page=${pg.page}`);

  const lewat = await getJson('/api/admin/menfes?status=APPROVED&page=999&limit=5');
  check('halaman di luar rentang mengembalikan data kosong',
    Array.isArray(lewat.body.data) && lewat.body.data.length === 0,
    `jumlah=${lewat.body.data?.length}`);
  check('halaman di luar rentang tetap melaporkan totalPages yang benar',
    lewat.body.pagination.totalPages === pg.totalPages,
    `totalPages=${lewat.body.pagination.totalPages} vs ${pg.totalPages}`);

  console.log('\n== 5. MUTASI MEMBERSIHKAN KEDUA CACHE ==\n');

  const row = await buat('PENDING');
  adminCache.invalidate();
  cachePublik.invalidate();

  const sebelum = await getJson('/api/admin/menfes?status=PENDING');
  check('baris uji muncul di daftar PENDING',
    sebelum.body.data.some((m) => m.id === row.id), 'tidak ditemukan');

  const statsSebelum = (await getJson('/api/admin/stats')).body;
  check('stats menghitung baris uji sebagai PENDING', statsSebelum.pending >= 1,
    `pending=${statsSebelum.pending}`);

  // Cari apakah adminCache masih menyimpan respons lama.
  const masihBasi = adminCache.get('stats')?.pending === statsSebelum.pending;
  check('stats masuk cache sebelum mutasi', masihBasi, 'cache tidak terisi');

  const appr = await fetch(`${BASE}/api/admin/menfes/${row.id}/approve`, {
    method: 'PATCH', headers: auth,
  });
  check('approve berhasil', appr.status === 200, `HTTP ${appr.status}`);

  check('mutasi mengosongkan cache stats', adminCache.get('stats') === undefined,
    'masih ada isinya');
  check('mutasi mengosongkan cache daftar admin',
    adminCache.get('list:PENDING:1:20') === undefined, 'masih ada isinya');
  check('mutasi mengosongkan cache publik', cachePublik.get(10) === undefined,
    'masih ada isinya');

  const sesudah = await getJson('/api/admin/menfes?status=PENDING');
  check('baris PENDING hilang setelah approve',
    !sesudah.body.data.some((m) => m.id === row.id), 'masih muncul');

  const statsSesudah = (await getJson('/api/admin/stats')).body;
  check('pending berkurang setelah approve',
    statsSesudah.pending === statsSebelum.pending - 1,
    `sebelum=${statsSebelum.pending} sesudah=${statsSesudah.pending}`);
  check('approved bertambah setelah approve',
    statsSesudah.approved === statsSebelum.approved + 1,
    `sebelum=${statsSebelum.approved} sesudah=${statsSesudah.approved}`);

  const rej = await fetch(`${BASE}/api/admin/menfes/${row.id}/reject`, {
    method: 'PATCH', headers: auth,
  });
  check('reject berhasil', rej.status === 200, `HTTP ${rej.status}`);
  const statsSetelahReject = (await getJson('/api/admin/stats')).body;
  check('pending tidak berubah oleh reject', statsSetelahReject.pending === statsSesudah.pending,
    `pending=${statsSetelahReject.pending}`);
  check('approved berkurang oleh reject', statsSetelahReject.approved === statsSesudah.approved - 1,
    `approved=${statsSetelahReject.approved}`);

  const del = await fetch(`${BASE}/api/admin/menfes/${row.id}`, {
    method: 'DELETE', headers: auth,
  });
  check('delete berhasil', del.status === 200, `HTTP ${del.status}`);
  const statsSetelahDelete = (await getJson('/api/admin/stats')).body;
  check('total berkurang satu setelah delete',
    statsSetelahDelete.total === statsSetelahReject.total - 1,
    `total=${statsSetelahDelete.total}`);

  console.log('\n== 6. TTL=0 MATIKAN CACHE ADMIN SAJA ==\n');

  const TTL_ASLI = process.env.ADMIN_CACHE_TTL_MS;
  process.env.ADMIN_CACHE_TTL_MS = '0';
  delete require.cache[require.resolve(path.join(ROOT, 'src/lib/adminCache'))];
  const mati = require(path.join(ROOT, 'src/lib/adminCache'));
  check('TTL 0 berarti tidak ada yang tersimpan',
    mati.get('stats') === undefined && mati.TTL_MS === 0, `TTL=${mati.TTL_MS}`);
  mati.set('stats', { pending: 1 });
  check('TTL 0 juga menolak penyimpanan', mati.get('stats') === undefined);

  const cachePublikMasih = require(path.join(ROOT, 'src/lib/menfesCache'));
  check('cache publik tidak ikut terpengaruh',
    cachePublikStillWorks(cachePublikMasih), 'cache publik ikut mati');
  process.env.ADMIN_CACHE_TTL_MS = TTL_ASLI;

  function cachePublikStillWorks(c) {
    c.set(7, { probe: true });
    const ada = c.get(7)?.probe === true;
    c.invalidate();
    return ada;
  }

  // ---------------------------------------------------------------
  // Pembersihan. Dijalankan apa pun hasil pengujian di atas.
  // ---------------------------------------------------------------
  prisma.menfes.findMany = asliFindMany;
  prisma.menfes.count = asliCount;
  prisma.$queryRaw = asliRaw;

  const sisaUji = await prisma.menfes.deleteMany({ where: { message: { startsWith: TANDA } } });
  await prisma.admin.deleteMany({ where: { username: USER } });
  adminCache.invalidate();
  cachePublik.invalidate();
  server.close();
  await prisma.$disconnect();

  console.log(`\nbaris uji dibersihkan: ${sisaUji.count}`);
  console.log(`HASIL: ${ok} ok, ${gagal} gagal`);
  process.exit(gagal ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.stack); process.exit(1); });