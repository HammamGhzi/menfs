const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const {
  MAX_PASSWORD_BYTES,
  MIN_SEED_PASSWORD_LENGTH,
  byteLength,
  exceedsBcryptLimit,
} = require('../src/lib/password');

const prisma = new PrismaClient();

/**
 * Seed akun admin.
 *
 * Password WAJIB datang dari env (ADMIN_SEED_PASSWORD). Repo ini publik,
 * jadi password default di dalam kode berarti siapa pun bisa login ke
 * admin panel. Jangan pernah menuliskan password default di sini.
 *
 * Generate password:
 *   node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
 */
async function main() {
  const password = process.env.ADMIN_SEED_PASSWORD;

  if (!password) {
    throw new Error(
      'ADMIN_SEED_PASSWORD wajib diisi sebelum menjalankan seed.\n' +
      'Repo ini publik, jadi password default di dalam kode bisa dipakai siapa pun.\n' +
      'Generate: node -e "console.log(require(\'crypto\').randomBytes(24).toString(\'base64url\'))"'
    );
  }

  if (password.length < MIN_SEED_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_SEED_PASSWORD minimal ${MIN_SEED_PASSWORD_LENGTH} karakter `
        + `(sekarang ${password.length}).`
    );
  }

  // bcrypt hanya memakai 72 byte pertama. Password yang lebih panjang akan
  // terpotong diam-diam, jadi siapa pun yang hanya tahu 72 byte pertama bisa
  // login. Tolak di sini supaya hal itu tidak bisa terjadi lewat seed.
  if (exceedsBcryptLimit(password)) {
    throw new Error(
      `ADMIN_SEED_PASSWORD maksimal ${MAX_PASSWORD_BYTES} byte `
        + `(sekarang ${byteLength(password)} byte). `
        + 'Password yang lebih panjang akan terpotong oleh bcrypt.'
    );
  }

  const username = process.env.ADMIN_SEED_USERNAME || 'admin';
  const hashed = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { username },
    update: {},
    create: {
      username,
      password: hashed,
    },
  });

  console.log(`✅ Admin seeded: ${admin.username}`);
  console.log(`   Password dari ADMIN_SEED_PASSWORD (${password.length} karakter / ${byteLength(password)} byte)`);
  console.log('⚠️  Hapus ADMIN_SEED_PASSWORD dari environment setelah seed berhasil.');
}

main()
  .catch((e) => {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
