/**
 * Klien Instagram Graph API (Content Publishing API) — jalur RESMI.
 *
 * Dokumentasi yang dipakai:
 *   - Creating:  POST /{ig-user-id}/media
 *   - Publishing: POST /{ig-user-id}/media_publish
 *   - Status:     GET  /{ig-user-id}/{container-id}?fields=status_code
 *   - Quota:      GET  /{ig-user-id}/content_publishing_limit
 *
 * CATATAN PENTING
 * 1. Graph API menolak body JSON. Semua parameter WAJIB dikirim
 *    sebagai application/x-www-form-urlencoded (atau multipart).
 * 2. `media_publish` TIDAK idempotent dan TIDAK punya idempotency key.
 *    Kalau publish sukses tapi response hilang, retry = postingan duplikat.
 *    Karena itu `publish()` selalu cek `status_code` container lebih dulu.
 * 3. Quota harian TIDAK dikodekan di sini (docs official saling
 *    kontradiksi antara 50 dan 100). Selalu query `getQuota()` saat runtime.
 */

// Versi API. Kalau Meta announce versi yang lebih baru, cukup ganti di sini.
const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v26.0';

// Domain dipisah per jalur auth: Instagram Login (resmi untuk IG Platform,
// tidak butuh Facebook Page) memakai graph.instagram.com.
const GRAPH_HOST = process.env.IG_GRAPH_HOST || 'graph.instagram.com';

// Batas polling container. Docs: container butuh waktu untuk di-fetch
// dari image_url sebelum bisa dipublish.
const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 60_000; // docs: poll satu kali per menit

// ─── Error mapping ────────────────────────────────────────────────────────────
// Subcode dari Meta -> pesan yang bisa ditindaklanjuti admin.
// Sumber: research-instagram-api.md bagian "Error codes".
const ERROR_MAP = {
  36001: 'Format gambar tidak didukung. Instagram hanya menerima JPEG — PNG ditolak (error 36001 / 2207005).',
  2207005: 'Format gambar tidak didukung. Instagram hanya menerima JPEG — PNG ditolak (error 36001 / 2207005).',
  9004: 'Instagram tidak bisa mengambil gambar dari URL itu. Pastikan URL-nya publik, HTTPS, dan bisa diakses tanpa login (error 9004 / 2207052).',
  2207052: 'Instagram tidak bisa mengambil gambar dari URL itu. Pastikan URL-nya publik, HTTPS, dan bisa diakses tanpa login (error 9004 / 2207052).',
  9007: 'Media belum siap dipublish. Tunggu container selesai di-fetch lalu coba lagi (error 9007 / 2207027).',
  2207027: 'Media belum siap dipublish. Tunggu container selesai di-fetch lalu coba lagi (error 9007 / 2207027).',
  2207008: 'Container sudah kedaluwarsa. Buat container baru dari awal.',
  2207051: 'Konten ditandai spam oleh Instagram. Ini risiko khusus papan pesan anonim — jangan auto-retry, periksa isi caption.',
  2207029: 'Caption atau hashtag tidak valid. Cek panjang caption (<=2200 karakter, <=30 hashtag, <=20 mention).',
  190: 'Token akses tidak valid atau sudah kedaluwarsa. Generate ulang token di Meta App Dashboard lalu perbarui IG_ACCESS_TOKEN.',
};

class InstagramGraphError extends Error {
  constructor(message, { code, subcode, status, raw } = {}) {
    super(message);
    this.name = 'InstagramGraphError';
    this.code = code;
    this.subcode = subcode;
    this.status = status;
    this.raw = raw;
  }
}

/**
 * Terjemahkan error dari Graph API jadi pesan yang berguna.
 * Dua bentuk error yang mungkin:
 *   - HTTP != 200 dengan body JSON { error: { message, code, error_subcode } }
 *   - HTTP 200 tapi body { error: {...} } (Graph API kadang tetap balas 200)
 */
function toFriendlyError(err) {
  const body = err?.response?.data ?? err?.data ?? {};
  const apiErr = body.error ?? {};

  const subcode = apiErr.error_subcode;
  const code = apiErr.code ?? err?.response?.status;
  const detail = apiErr.message || err.message || 'Gagal menghubungi Instagram API.';

  // Cari pesan yang paling spesifik dulu (subcode), lalu code biasa.
  const friendly = ERROR_MAP[subcode] || ERROR_MAP[code];

  return new InstagramGraphError(friendly ? `${friendly} (${detail})` : detail, {
    code,
    subcode,
    status: err?.response?.status,
    raw: body,
  });
}

/**
 * Semua request Graph API. Selalu form-encoded — lihat catatan 1 di atas.
 *
 * Pakai `fetch` bawaan Node 18+ (backend ini tidak punya axios, dan
 * menambahkan dependency hanya untuk satu file tidak sepadan).
 *
 * @param {string} path  contoh: '/{IG_USER_ID}/media'
 * @param {object} params parameter query (GET) atau body (POST)
 * @param {object} opts   { method, accessToken, timeout }
 */
async function graphRequest(path, params = {}, { method = 'POST', accessToken, timeout = 30_000 } = {}) {
  const url = new URL(`https://${GRAPH_HOST}/${GRAPH_VERSION}${path}`);

  // Buang parameter kosong supaya tidak terkirim sebagai string "undefined".
  const clean = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );

  const init = { method, headers: {} };

  if (method === 'GET') {
    for (const [key, value] of Object.entries(clean)) {
      url.searchParams.set(key, String(value));
    }
  } else {
    // Graph API menolak application/json. Wajib form-urlencoded.
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(Object.entries(clean).map(([k, v]) => [k, String(v)])).toString();
  }

  if (accessToken) url.searchParams.set('access_token', accessToken);

  // fetch() tidak punya timeout bawaan — pakai AbortController.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let res;
  try {
    res = await fetch(url.toString(), { ...init, signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new InstagramGraphError(
        `Instagram API tidak merespons dalam ${Math.round(timeout / 1000)} detik.`
      );
    }
    throw toFriendlyError(err);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Body bukan JSON (mis. halaman error HTML dari proxy).
    throw new InstagramGraphError(
      `Instagram API membalas HTTP ${res.status} dengan body yang bukan JSON. ` +
        'Cek koneksi dan URL service.',
      { status: res.status }
    );
  }

  // Dua-duanya bisa gagal: HTTP != 200, ATAU HTTP 200 dengan body { error }.
  if (!res.ok || data?.error) {
    throw toFriendlyError({ response: { status: res.status, data }, message: data?.error?.message });
  }

  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ambil konfigurasi dari env. Throw pesan jelas kalau belum diisi.
 */
function getConfig() {
  const igUserId = process.env.IG_USER_ID;
  const accessToken = process.env.IG_ACCESS_TOKEN;

  const missing = [];
  if (!igUserId) missing.push('IG_USER_ID');
  if (!accessToken) missing.push('IG_ACCESS_TOKEN');
  if (missing.length > 0) {
    throw new InstagramGraphError(
      `Instagram belum dikonfigurasi. Set env var ini di Render: ${missing.join(', ')}`
    );
  }

  return { igUserId, accessToken };
}

/**
 * Apakah mode dry-run aktif? Dipakai untuk menguji alur tanpa memanggil
 * Meta sama sekali (tidak ada token, tidak ada risiko limit).
 */
function isDryRun() {
  return process.env.IG_DRY_RUN === 'true';
}

/**
 * Step 1 — buat media container.
 * Instagram akan FETCH image_url (harus publik, bisa diakses tanpa login).
 *
 * @returns {Promise<string>} id container
 */
async function createContainer({ imageUrl, caption, altText }) {
  const { igUserId, accessToken } = getConfig();

  if (isDryRun()) {
    const fakeId = `dryrun_container_${Date.now()}`;
    console.log('[IG DRY-RUN] createContainer', {
      path: `/${igUserId}/media`,
      image_url: imageUrl,
      caption: caption ? `${caption.slice(0, 60)}...` : '(kosong)',
      captionLength: caption ? caption.length : 0,
      alt_text: altText,
      containerId: fakeId,
    });
    return fakeId;
  }

  const data = await graphRequest(
    `/${igUserId}/media`,
    { image_url: imageUrl, caption, alt_text: altText },
    { accessToken }
  );

  if (!data?.id) {
    throw new InstagramGraphError('Instagram tidak mengembalikan container id.', { raw: data });
  }
  return data.id;
}

/**
 * Step 2 — tunggu container selesai di-fetch dari image_url.
 * PENTING: tanpa ini, media_publish akan ditolak dengan 9007/2207027.
 */
async function waitForContainer(containerId, { onPoll } = {}) {
  const { igUserId, accessToken } = getConfig();

  if (isDryRun()) {
    console.log('[IG DRY-RUN] waitForContainer', { containerId, attempts: MAX_POLL_ATTEMPTS });
    return 'FINISHED';
  }

  for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt += 1) {
    const data = await graphRequest(`/${igUserId}/${containerId}`, { fields: 'status_code,status' }, {
      method: 'GET',
      accessToken,
    });

    const statusCode = data?.status_code;
    if (onPoll) onPoll({ attempt, max: MAX_POLL_ATTEMPTS, statusCode });

    // docs: status_code hanya punya dua nilai — FINISHED atau IN_PROGRESS
    if (statusCode === 'FINISHED') return statusCode;

    // Error status yang eksplisit — jangan tunggu, langsung lempar.
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new InstagramGraphError(
        `Container media gagal diproses Instagram (status_code=${statusCode}). ${data?.status || ''}`.trim(),
        { raw: data }
      );
    }

    if (attempt < MAX_POLL_ATTEMPTS) await sleep(POLL_INTERVAL_MS);
  }

  throw new InstagramGraphError(
    `Media belum selesai diproses setelah ${MAX_POLL_ATTEMPTS}× polling. ` +
      'Coba lagi nanti, atau cek apakah image_url bisa diakses Instagram.'
  );
}

/**
 * Step 3 — publikasikan ke feed (media_publish).
 * TIDAK idempotent — lihat catatan 2 di file ini.
 */
async function publish(containerId) {
  const { igUserId, accessToken } = getConfig();

  if (isDryRun()) {
    console.log('[IG DRY-RUN] media_publish', { path: `/${igUserId}/media_publish`, creation_id: containerId });
    return { id: `dryrun_media_${Date.now()}`, permalink: '(dry-run — tidak ada URL asli)' };
  }

  const data = await graphRequest(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    { accessToken, timeout: 60_000 }
  );

  if (!data?.id) {
    throw new InstagramGraphError('Instagram tidak mengembalikan media id.', { raw: data });
  }
  return data;
}

/**
 * Ambil sisa kuota posting hari ini. Jangan hardcode angka — docs
 * official tidak konsisten (50 vs 100). Field `config.quota_total` yang dipakai.
 */
async function getQuota() {
  const { igUserId, accessToken } = getConfig();

  if (isDryRun()) {
    console.log('[IG DRY-RUN] content_publishing_limit', { path: `/${igUserId}/content_publishing_limit` });
    return { quota_usage: 0, config: { quota_total: '(dry-run)' } };
  }

  return graphRequest(`/${igUserId}/content_publishing_limit`, { fields: 'quota_usage,config' }, {
    method: 'GET',
    accessToken,
  });
}

/**
 * publicized ig-user-id + username. Dipakai buat verifikasi token pas setup.
 */
async function getAccountInfo() {
  const { accessToken } = getConfig();

  if (isDryRun()) {
    console.log('[IG DRY-RUN] getAccountInfo (GET /me?fields=id,username)');
    return { id: '(dry-run)', username: '(dry-run)' };
  }

  return graphRequest('/me', { fields: 'id,username' }, { method: 'GET', accessToken });
}

/**
 * Pipeline lengkap: create container -> tunggu FINISHED -> publish.
 * Dipakai controller supaya urutan tidak salah di satu tempat saja.
 *
 * @returns {Promise<{mediaId:string, permalink?:string, containerId:string}>}
 */
async function publishImage({ imageUrl, caption, altText, onPoll }) {
  const containerId = await createContainer({ imageUrl, caption, altText });
  await waitForContainer(containerId, { onPoll });
  const published = await publish(containerId);

  return { mediaId: published.id, permalink: published.permalink, containerId };
}

module.exports = {
  InstagramGraphError,
  GRAPH_VERSION,
  GRAPH_HOST,
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  isDryRun,
  getConfig,
  getAccountInfo,
  getQuota,
  createContainer,
  waitForContainer,
  publish,
  publishImage,
};
