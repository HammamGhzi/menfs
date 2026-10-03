// Satu client untuk seluruh proses. Sebelumnya tiap modul membuat sendiri
// (lima connection pool terpisah), jadi tiap endpoint hanya boleh memakai
// slot koneksi miliknya dan jumlah koneksi terbuka lima kali lipat.
//
// Ukuran pool ditetapkan di sini lewat URL database yang sudah ditulis ulang
// oleh lib/dbUrl. Nilai bawaan di URL adalah connection_limit=1, dan dengan
// satu slot `Promise.all` di controller tidak menjalankan query secara paralel.
// Rincian pengukurannya ada di lib/dbUrl.js.
const g = globalThis;
const cached = g.__menfesPrisma;

if (cached) {
  module.exports = cached;
} else {
  const { PrismaClient } = require('@prisma/client');
  const { withPoolSize, DEFAULT_POOL_SIZE } = require('./dbUrl');

  // DB_POOL_SIZE hanya untuk kasus khusus. Nilai aneh sudah ditolak oleh
  // withPoolSize, jadi variabel ini tidak bisa membuat aplikasi gagal start.
  const poolSize = process.env.DB_POOL_SIZE || DEFAULT_POOL_SIZE;
  const url = withPoolSize(process.env.DATABASE_URL, poolSize);

  const prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

  if (process.env.NODE_ENV !== 'production') g.__menfesPrisma = prisma;
  module.exports = prisma;
}