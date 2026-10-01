#!/usr/bin/env node
/**
 * Spike Instagram Content Publishing API.
 *
 * TUJUAN: validasi token + cek batas minimal SEBELUM-commit fitur apa pun.
 * Script ini tidak mengubah data di repo dan tidak butuh backend jalan.
 *
 * CARA PAKAI
 * ----------
 * 1. Buka https://developers.facebook.com/apps > app kamu
 *    > Instagram > "API setup with Instagram business login"
 *    > Generate token. Salin hasilnya.
 * 2. Isi env di bawah (jangan di-commit!), lalu:
 *
 *    $ cd backend
 *    $ node scripts/ig-spike.mjs
 *
 * Butuh image_url yang PUBLIK, JPEG, <=8MB, rasio 4:5 s/d 1.91:1.
 * Contoh yang selalu hidup dan gratis:
 *    https://upload.wikimedia.org/wikipedia/commons/thumb/...jpg
 * Kalau tidak punya, pakai salah satu template publik di frontend:
 *    https://harkatnekat.vercel.app/template/template-1.png  <-- PNG, akan ditolak
 *
 * PERINGATAN: langkah 3 benar-benar MENERBITKANインメント ke akun IG kamu.
 * Jangan jalankan kalau tidak siap. Cek dulu langkah 1 & 2 (read-only).
 */

import 'dotenv/config';

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v26.0';
const HOST = 'graph.instagram.com';
const BASE = `https://${HOST}/${GRAPH_VERSION}`;

const token = process.env.IG_ACCESS_TOKEN;
const igUserId = process.env.IG_USER_ID;
const imageUrl = process.env.SPIKE_IMAGE_URL;
const caption = process.env.SPIKE_CAPTION || 'Test posting dari spike script. #test';

// Mode safety: default hanya baca. Set SPIKE_PUBLISH=true untuk benar-benar
// menerbitkannya. Ini yang mencegah posting tidak sengaja.
const PUBLISH = process.env.SPIKE_PUBLISH === 'true';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function line(char = '─') {
  return char.repeat(64);
}

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function bad(msg) {
  console.log(`  ❌ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
}

function info(msg) {
  console.log(`  ·  ${msg}`);
}

async function call(label, path, params = {}, method = 'GET') {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  url.searchParams.set('access_token', token);

  const init = { method, headers: {} };
  if (method !== 'GET') {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    ).toString();
    // Token ikut di query juga supaya aman untuk dua jalur.
    url.searchParams.delete('access_token');
    url.searchParams.set('access_token', token);
  }

  const res = await fetch(url, init);
  let body;
  try {
    body = await res.json();
  } catch {
    body = { raw: await res.text().catch(() => '') };
  }

  console.log(`\n${line()}\n${label}\n${line()}`);
  console.log(`  HTTP ${res.status}`);
  if (body.error) {
    console.log(`  error.code    : ${body.error.code}`);
    console.log(`  error.subcode : ${body.error.error_subcode ?? '-'}`);
    console.log(`  error.message : ${body.error.message}`);
    if (body.error.error_user_title) console.log(`  title         : ${body.error.error_user_title}`);
    if (body.error.error_user_msg) console.log(`  user msg      : ${body.error.error_user_msg}`);
  }
  return { status: res.status, body, ok: res.ok && !body.error };
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Instagram Content Publishing API — Spike                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n  Graph version : ${GRAPH_VERSION}`);
  console.log(`  Mode          : ${PUBLISH ? 'PUBLISH (benar-benar akan muncul di IG)' : 'READ-ONLY (aman)'}`);

  // ─── Step 0: cek env ───────────────────────────────────────────────────────
  console.log(`\n${line()}\nStep 0 — Konfigurasi\n${line()}`);
  if (!token) {
    bad('IG_ACCESS_TOKEN belum di-set. Generate dari Meta App Dashboard.');
    process.exit(1);
  }
  if (!igUserId) {
    bad('IG_USER_ID belum di-set. Ambil dari Step 1 di bawah.');
    process.exit(1);
  }
  if (!imageUrl) {
    warn('SPIKE_IMAGE_URL belum di-set — langkah 3 akan dilewati.');
    warn('Set ke URL publik JPEG untuk menguji create+publish.');
  }
  ok('Env lengkap');

  // ─── Step 1: verifikasi token + identitas akun ─────────────────────────────
  const me = await call('Step 1 — Whoami (GET /me)', '/me', { fields: 'id,username' });

  if (!me.ok) {
    bad('Token tidak valid. Periksa di Meta App Dashboard, lalu generate ulang.');
    if (me.body.error?.code === 190) {
      console.log('\n  Error 190 = token tidak dikenal / expired / salah_app.');
      console.log('  Penyebab umum: token diambil dari app yang berbeda, atau');
      console.log('  permission instagram_business_content_publish belum di-grant.');
    }
    process.exit(1);
  }

  const accountId = me.body.id;
  ok(`Token valid. Akun: @${me.body.username} (id ${accountId})`);

  if (accountId !== String(igUserId)) {
    warn(`IG_USER_ID (${igUserId}) beda dengan id token (${accountId}).`);
    warn('Kalau ini salah, publish akan 403. Perbaiki env lalu ulangi.');
  }

  // ─── Step 2: cek kuota ─────────────────────────────────────────────────────
  const quota = await call(
    'Step 2 — Kuota posting hari ini (GET /content_publishing_limit)',
    `/${accountId}/content_publishing_limit`,
    { fields: 'quota_usage,config' }
  );

  if (quota.ok) {
    ok(`Sisa kuota: ${quota.body.quota_usage} terpakai dari ${quota.body.config?.quota_total}`);
    info(
      `Catatan: docs official tidak konsisten (50 vs 100). ` +
        `Nilai di atas (${quota.body.config?.quota_total}) yang benar untuk akunmu.`
    );
  } else {
    warn('Gagal baca kuota — bukan blocker untuk publish, tapi perlu dicek.');
  }

  if (!imageUrl) {
    console.log(`\n${line()}\nStep 3 — Dilewati (tidak ada SPIKE_IMAGE_URL)\n${line()}`);
    console.log('\n  Token dan kuota sudah tervalidasi. Selesai — belum ada yang diposting.\n');
    process.exit(0);
  }

  // Validasi gambar dulu supaya tidak membakar kuota dengan request yang pasti gagal.
  console.log(`\n${line()}\nStep 3a — Cek image_url\n${line()}`);
  info(`URL : ${imageUrl}`);
  if (/\.png($|\?)/i.test(imageUrl)) {
    bad('URL berakhir .png — Instagram HANYA menerima JPEG. Expectedly gagal.');
    warn('Ganti ke URL .jpg sebelum melanjutkan.');
    process.exit(1);
  }
  try {
    const head = await fetch(imageUrl, { method: 'HEAD' });
    info(`HEAD → HTTP ${head.status}, content-type: ${head.headers.get('content-type')}`);
    if (head.status >= 400) {
      bad('URL tidak bisa diakses publik. Instagram juga tidak akan bisa.');
      process.exit(1);
    }
    if (!/jpeg|jpg/i.test(head.headers.get('content-type') || '')) {
      warn(`Content-type bukan JPEG (${head.headers.get('content-type')}). Instagram akan menolak.`);
    }
  } catch (e) {
    bad(`Tidak bisa menghubungi image_url dari sini: ${e.message}`);
    process.exit(1);
  }

  if (!PUBLISH) {
    console.log(`\n${line()}\nStep 3 —PUBLISH belum diaktifkan\n${line()}`);
    console.log('\n  Semua validasi read-only lulus. Tidak ada yang diposting.\n');
    console.log('  Kalau mau lanjut:\n    $ SPIKE_PUBLISH=true node scripts/ig-spike.mjs\n');
    process.exit(0);
  }

  // ─── Step 3b: create container ─────────────────────────────────────────────
  const container = await call(
    'Step 3b — Create container (POST /media)',
    `/${accountId}/media`,
    { image_url: imageUrl, caption },
    'POST'
  );

  if (!container.ok) {
    bad('Create container gagal — tidak ada container, tidak ada container yang perlu dibersihkan.');
    if ([36001, 2207005].includes(container.body.error?.code) || [36001, 2207005].includes(container.body.error?.error_subcode)) {
      info('→ PNG ditolak. Kirim JPEG.');
    }
    if ([9004, 2207052].includes(container.body.error?.code) || [9004, 2207052].includes(container.body.error?.error_subcode)) {
      info('→ URL tidak bisa di-fetch Meta. Cek: HTTPS, publik, tanpa auth, tanpa hotlink protection.');
    }
    process.exit(1);
  }

  const containerId = container.body.id;
  ok(`Container dibuat: ${containerId}`);

  // ─── Step 3c: poll sampai FINISHED ─────────────────────────────────────────
  console.log(`\n${line()}\nStep 3c — Menunggu container selesai di-fetch\n${line()}`);
  let ready = false;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const st = await call(
      `Step 3c.${attempt} — Status (GET /${containerId})`,
      `/${accountId}/${containerId}`,
      { fields: 'status_code,status' }
    );

    if (st.ok && st.body.status_code === 'FINISHED') {
      ok('status_code = FINISHED');
      ready = true;
      break;
    }
    if (st.ok && st.body.status_code === 'ERROR') {
      bad(`status_code = ERROR: ${st.body.status || '(tanpa detail)'}`);
      break;
    }
    if (attempt < 5) {
      info(`status_code masih ${st.body.status_code}, tunggu 60 detik...`);
      await sleep(60_000);
    }
  }

  if (!ready) {
    bad('Container tidak pernah FINISHED dalam 5 percobaan. Tidak dipublish.');
    process.exit(1);
  }

  // ─── Step 3d: publish ──────────────────────────────────────────────────────
  const published = await call(
    'Step 3d — Publish (POST /media_publish)',
    `/${accountId}/media_publish`,
    { creation_id: containerId },
    'POST'
  );

  console.log(`\n${line()}`);
  if (published.ok) {
    ok('PUBLISH BERHASIL');
    console.log(`\n  media id : ${published.body.id}`);
    console.log(`  Cek akun : https://www.instagram.com/p/\n`);
  } else {
    bad('PUBLISH GAGAL');
    if (published.body.error?.error_subcode === 2207051) {
      warn('→ 2207051 = ditandai spam. Risiko nyata untuk konten papan pesan anonim.');
      warn('  Jangan retry otomatis. Periksa isi caption-nya.');
    }
    info(
      'Ingat: media_publish TIDAK idempotent. Kalau gagal, cek dulu apakah ' +
        'postingan sebenarnya sudah muncul sebelum mencoba lagi.'
    );
  }
  console.log(`${line()}\n`);
}

main().catch((err) => {
  console.error('\nFatal:', err);
  process.exit(1);
});
