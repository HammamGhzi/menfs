const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;

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

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_SEED_PASSWORD minimal ${MIN_PASSWORD_LENGTH} karakter (sekarang ${password.length}).`
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
  console.log(`   Password diambil dari ADMIN_SEED_PASSWORD (${password.length} karakter)`);
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
