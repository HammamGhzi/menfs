/**
 * Uji integrasi postInstagram: pipeline LENGKAP dengan database lokal sungguhan.
 * Dipakai untuk memverifikasi controller tanpa harus lewat UI.
 *
 * Jalankan:  node scripts/test-post-ig.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(__dirname, '..');

// Env untuk uji — dipaksa di sini, TIDAK menyentuh .env
process.env.IG_DRY_RUN = 'true';
process.env.IG_USER_ID = '1234567890';
process.env.IG_ACCESS_TOKEN = 'fake_dryrun_token';
process.env.PUBLIC_BASE_URL = 'http://localhost:3001';

// Di Windows, ESM hanya menerima URL ber-scheme file://
const { PrismaClient } = await import('@prisma/client');
const prisma = new PrismaClient();
const ac = await import(pathToFileURL(path.join(BACKEND, 'src/controllers/adminController.js')).href);
const { postInstagram } = ac.default ?? ac;

const UPLOADS = path.join(BACKEND, 'uploads');
const JPEG_B64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

function mockRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

let pass = 0;
let fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name} ${detail}`); }
}

async function main() {
  console.log('\n=== Integrasi postInstagram (DRY_RUN, DB lokal) ===\n');

  // Seed menfes PENDING
  const menfes = await prisma.menfes.create({
    data: { message: 'Uji integrasi posting IG', senderName: 'Tester', status: 'PENDING' },
  });
  console.log(`  seed menfes ${menfes.id} status=${menfes.status}\n`);

  // Snapshot isi uploads/ supaya bisa memastikan tidak ada file tertinggal
  const before = fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).length : 0;

  // --- Test 1: happy path -------------------------------------------------
  const res1 = mockRes();
  await postInstagram(
    { params: { id: menfes.id }, body: { imageBase64: `data:image/jpeg;base64,${JPEG_B64}`, caption: 'Halo #test' } },
    res1
  );

  console.log(`\n  -> HTTP ${res1.statusCode}`);
  console.log(`  -> body: ${JSON.stringify(res1.body).slice(0, 400)}\n`);

  check('status 200', res1.statusCode === 200, `dapat ${res1.statusCode}`);
  check('success true', res1.body?.success === true);
  check('ada mediaId', Boolean(res1.body?.instagram?.mediaId));
  check('mediaId prefix dryrun', String(res1.body?.instagram?.mediaId).startsWith('dryrun_media_'));

  const after = await prisma.menfes.findUnique({ where: { id: menfes.id } });
  check('menfes jadi APPROVED', after.status === 'APPROVED', `dapat ${after.status}`);
  check('approvedAt terisi', Boolean(after.approvedAt));

  const afterFiles = fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).length : 0;
  check('tidak ada file tertinggal', afterFiles === before, `dari ${before} jadi ${afterFiles}`);

  // --- Test 2: caption default dipakai kalau tidak dikirim ----------------
  const m2 = await prisma.menfes.create({ data: { message: 'Tanpa caption', status: 'PENDING' } });
  const res2 = mockRes();
  await postInstagram({ params: { id: m2.id }, body: { imageBase64: JPEG_B64 } }, res2);
  check('caption default -> tetap sukses', res2.statusCode === 200, `dapat ${res2.statusCode} ${JSON.stringify(res2.body)}`);

  // --- Test 3: autoApprove=false tidak boleh approve ----------------------
  const m3 = await prisma.menfes.create({ data: { message: 'Jangan auto approve', status: 'PENDING' } });
  const res3 = mockRes();
  await postInstagram({ params: { id: m3.id }, body: { imageBase64: JPEG_B64, autoApprove: false } }, res3);
  const m3after = await prisma.menfes.findUnique({ where: { id: m3.id } });
  check('autoApprove=false -> tetap PENDING', m3after.status === 'PENDING', `dapat ${m3after.status}`);

  // --- Test 4: menfes tidak ada -> 404, tidak ada file ditulis ------------
  const res4 = mockRes();
  await postInstagram({ params: { id: '00000000-0000-0000-0000-000000000000' }, body: { imageBase64: JPEG_B64 } }, res4);
  check('menfes hilang -> 404', res4.statusCode === 404, `dapat ${res4.statusCode}`);
  const finalFiles = fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).length : 0;
  check('tetap tidak ada file tertinggal', finalFiles === before, `dari ${before} jadi ${finalFiles}`);

  // Cleanup
  for (const id of [menfes.id, m2.id, m3.id]) {
    await prisma.menfes.delete({ where: { id } }).catch(() => {});
  }

  console.log(`\n=== ${pass} pass, ${fail} fail ===\n`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('\nFatal:', e);
  await prisma.$disconnect();
  process.exit(1);
});
