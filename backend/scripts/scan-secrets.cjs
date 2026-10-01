/**
 * Scan kredensial yang tertinggal di repo. Menolak file yang sah
 * (env.example placeholder, nama variabel) dan hanya melaporkan nilai
 * literal yang benar-benar terlihat seperti rahasia.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// .env TIDAK diskan: isinya memang kredensial asli, tapi file itu
// gitignored dan tidak pernah masuk riwayat commit. Yang penting dicek
// adalah apakah kredensial itu bocor ke file yang LAZIM di-commit.
const SKIP = /node_modules|\.git[\\/]|dist[\\/]|graphify-out|research-instagram|[\\/]\.env$/;

const EXTS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.yml', '.yaml', '.env', '.prisma']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(e.name)) || e.name.startsWith('.env')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);
console.log(`scan ${files.length} file\n`);

// key = kata kunci, value = literal yang dianggap rahasia
const PATTERNS = [
  ['password hardcoded', /password\s*[:=]\s*['"]([^'"]{4,})['"]/gi],
  ['secret/token literal', /(secret|token|apikey|api_key)\s*[:=]\s*['"]([A-Za-z0-9_\-+/=]{16,})['"]/gi],
  // JWT: tiga segment base64url, signature minimal 10 char
  ['token JWT-looking', /eyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{10,}/g],
  ['sk- keys', /\bsk-[A-Za-z0-9]{16,}\b/g],
  ['AWS key', /AKIA[0-9A-Z]{16}\b/g],
  ['Google API key', /\bAIza[0-9A-Za-z_\-]{30,}\b/g],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/g],
  // password di dalam URL (postgres, mysql, redis, mongodb)
  ['URL with password', /\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?):\/\/[^\s:@/]+:([^\s@/]{6,})@/g],
  // kredensial dasar di URL: https://user:pass@host
  ['URL basic auth', /https?:\/\/[^\s:/@]+:([^\s@/]{6,})@/g],
  ['prisma db:seed creds', /db:seed[\s\S]{0,200}?['"]([a-z0-9]{6,})['"]/gi],
];

/**
 * Placeholder yang HARUS diabaikan. Sengaja spesifik: filter longgar
 * membuat scanner gagal diam-diam, yang lebih berbahaya daripada tidak
 * memindai sama sekali.
 */
const SAFE_EXACT = new Set([
  'password', 'secret', 'token', 'contoh', 'example', 'changeme', 'xxx',
  'nil', 'null', 'undefined', 'true', 'false', 'your_password_here',
  'ganti_dengan_random_string_64_karakter_di_production',
  'token_dari_meta_app_dashboard', 'token_anda_disini',
  'dependencies', 'devdependencies', 'scripts', 'name', 'version', 'main',
]);

const SAFE_PREFIX = [/^ganti_/i, /^token_dari_/i, /^token_anda/i, /^\$\{/, /^</];

function isSafe(val) {
  const v = val.trim();
  if (SAFE_EXACT.has(v.toLowerCase())) return true;
  if (SAFE_PREFIX.some((re) => re.test(v))) return true;
  if (v.includes('process.env')) return true;
  // .env.example: izinkan hanya kalau jelas placeholder
  if (/[\[<]/.test(v)) return true;
  // nama variabel UPPER_CASE (WEBHOOK_SECRET) bukan nilai rahasia
  if (/^[A-Z][A-Z0-9_]{3,}$/.test(v)) return true;
  return false;
}

const findings = [];
for (const f of files) {
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch { continue; }
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');

  for (const [label, re] of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src)) !== null) {
      const val = (m[1] || m[0] || '').trim();
      if (!val || val.length < 6) continue;
      if (isSafe(val)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      // .env.example hanya boleh berisi placeholder; nilai sungguhan di
      // sana berarti kebocoran.
      if (rel.endsWith('.env.example')) {
        findings.push({ rel, line, label, sample: val.slice(0, 24) + '...' });
        continue;
      }
      // hanya laporkan kalau muncul di kode, bukan di markdown penjelasan
      if (rel.endsWith('.md') && !/```/.test(src.slice(Math.max(0, m.index - 400), m.index))) continue;
      findings.push({ rel, line, label, sample: val.slice(0, 24) + (val.length > 24 ? '...' : '') });
    }
  }
}

if (!findings.length) {
  console.log('BERSIH — tidak ada kredensial literal di kode.');
} else {
  console.log(`${findings.length} temuan:\n`);
  for (const f of findings) {
    console.log(`  ${f.rel}:${f.line}  [${f.label}]  ${f.sample}`);
  }
}

// cek juga: .env tracked oleh git?
console.log('\n--- .env masuk git? ---');
const { execSync } = require('child_process');
let trackedEnv = [];
try {
  const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n');
  trackedEnv = files.filter((f) => /(^|[\\/])\.env($|\.)/.test(f) && !/example/.test(f));
} catch { /* git tidak tersedia */ }
console.log(trackedEnv.length ? `  !!! TER-TRACK:\n  ${trackedEnv.join('\n  ')}` : '  tidak ada .env yang ter-track');