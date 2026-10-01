/**
 * Forensik: apakah akun admin sudah pernah disalahgunakan?
 *
 * Schema tidak punya audit log, jadi kita pakai sidik timestamp:
 *   - createdAt  = kapan pengirim kirim menfes (gw communities, wajar)
 *   - approvedAt = kapan admin menyetujui (gw bar, bisa disalahgunakan)
 *
 * Pola yang mencurigakan: approvedAt yang bercluster di luar jam normal
 * manusia, atau approvedAt sangat dekat setelah createdAt untuk menfes
 * yang sama (persis gejala orang menyetujui semuanya cepat-cepat).
 *
 * Semua lewat API admin dengan token yang sah. READ-ONLY.
 */
const BASE = process.env.FORENSICS_TARGET || 'https://menfs.onrender.com';
const CREDS = JSON.parse(process.env.ADMIN_CREDS || '{}');

const log = (s) => console.log(s);

async function api(path, token) {
  const r = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const t = await r.text();
  try { return { status: r.status, body: JSON.parse(t) }; }
  catch { return { status: r.status, body: t }; }
}

(async () => {
  log('── 1. Login ──');
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(CREDS),
  });
  const lb = await login.json().catch(() => ({}));
  if (login.status !== 200) {
    log(`  Gagal: ${login.status}. Isi ADMIN_CREDS dengan kredensial lama.`);
    log('  (lewati bagian ini kalau tidak ingin mengirim kredensial lewat env)');
    return;
  }
  const token = lb.token;
  log(`  Berhasil. Admin id ${lb.admin.id}`);

  // ambil semua menfes (READ-ONLY)
  log('\n── 2. Kumpulkan semua menfes ──');
  let all = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const r = await api(`/api/admin/menfes?limit=50&page=${page}`, token);
    if (r.status !== 200) { log(`  Halaman ${page}: HTTP ${r.status}`); break; }
    all.push(...(r.body.data || []));
    total = r.body.pagination?.total || all.length;
    if (all.length >= total || !(r.body.data || []).length) break;
    page++;
  }
  log(`  ${all.length} menfes (total reported ${total})`);

  // 3. distribusi approve per hari
  log('\n── 3. Kapan admin approve? ──');
  const byDay = new Map();
  for (const m of all) {
    if (!m.approvedAt) continue;
    const d = m.approvedAt.slice(0, 10);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  const days = [...byDay.entries()].sort();
  for (const [d, n] of days) {
    const bar = '#'.repeat(n);
    log(`  ${d}  ${String(n).padStart(3)}  ${bar}`);
  }

  // 4. jam approval (mencurigakan: jam 2-5 pagi WIB)
  log('\n── 4. Jam approval (WIB = UTC+7) ──');
  const byHour = new Map();
  for (const m of all) {
    if (!m.approvedAt) continue;
    const utcH = new Date(m.approvedAt).getUTCHours();
    const wib = (utcH + 7) % 24;
    byHour.set(wib, (byHour.get(wib) || 0) + 1);
  }
  const odd = [];
  for (let h = 0; h < 24; h++) {
    const n = byHour.get(h) || 0;
    if (!n) continue;
    const suspicious = h >= 1 && h <= 5;
    if (suspicious) odd.push(h);
    log(`  ${String(h).padStart(2, '0')}:00  ${String(n).padStart(3)}  ${'#'.repeat(Math.min(n, 60))}${suspicious ? '  <-- jam tidur' : ''}`);
  }

  // 5. selisih created -> approved (respons batch = ciri penyalahgunaan)
  log('\n── 5. Selisih created -> approved ──');
  const deltas = [];
  for (const m of all) {
    if (!m.approvedAt) continue;
    const mins = (new Date(m.approvedAt) - new Date(m.createdAt)) / 60000;
    if (mins >= 0) deltas.push({ mins, id: m.id, msg: m.message.slice(0, 40) });
  }
  deltas.sort((a, b) => a.mins - b.mins);
  log(`  ${deltas.length} menfes punya approvedAt`);
  if (deltas.length) {
    log(`  tercepat: ${deltas[0].mins.toFixed(1)} menit  "${deltas[0].msg}"`);
    log(`  median   : ${deltas[Math.floor(deltas.length / 2)].mins.toFixed(1)} menit`);
    log(`  terlama  : ${deltas[deltas.length - 1].mins.toFixed(1)} menit`);
    const under1 = deltas.filter((d) => d.mins < 1).length;
    log(`  disetujui <1 menit setelah dibuat: ${under1}`);
    log('');
    log('  10 tercepat:');
    for (const d of deltas.slice(0, 10)) {
      log(`   ${d.mins.toFixed(2).padStart(8)} mnt  ${d.msg}`);
    }
  }

  // 6. konten mencurigakan
  log('\n── 6. Pola konten ──');
  const spam = all.filter((m) =>
    /(https?:\/\/|wa\.me|bit\.ly|t\.me|join|gratis|bonus|invest|crypto|judol|slot| Unlimited)/i.test(m.message)
  );
  log(`  menfes mengandung link atau kata promosi: ${spam.length}`);
  for (const m of spam.slice(0, 8)) {
    log(`   [${m.status}] ${m.message.slice(0, 70)}`);
  }

  log('\n═══ VERDICT ═══');
  const flags = [];
  if (odd.length) flags.push(`approval di jam tidur (${odd.join(',')}:00 WIB)`);
  if (deltas.length && deltas[0].mins < 2) flags.push(`approval tercepat ${deltas[0].mins.toFixed(1)} mnt`);
  if (spam.length > 3) flags.push(`${spam.length} menfes berisi link promotion`);
  log(flags.length
    ? `  ADA YANG MENCURIGAKAN:\n${flags.map((f) => `   - ${f}`).join('\n')}`
    : '  Tidak ada pola yang mencurigakan dari timestamp.');
  log('');
  log('  CATATAN: ini belum bukti. Admin menyetujui cepat itu wajar kalau');
  log('  menfes menumpuk. Yang penting: kalau nanti password diganti, pola');
  log('  seperti ini tidak akan bisa dibedakan dari aktivitas sah —');
  log('  itulah alasan perlu audit log ke depan.');
})();