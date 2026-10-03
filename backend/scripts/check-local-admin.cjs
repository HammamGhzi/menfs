/**
 * Cek kondisi akun admin di DB lokal setelah pengujian seed.
 * Read-only: tidak mengubah apa pun.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

(async () => {
  const prisma = new PrismaClient();
  const rows = await prisma.admin.findMany({ select: { username: true, password: true } });
  console.log('  akun di DB lokal: ' + rows.length);

  const probes = [
    ['72xA (dari test seed)', 'A'.repeat(72)],
    ['admin123', 'admin123'],
    ['password-uji-123', 'password-uji-123'],
  ];

  for (const r of rows) {
    const matches = [];
    for (const [label, val] of probes) {
      if (await bcrypt.compare(val, r.password)) matches.push(label);
    }
    console.log('    ' + r.username + '  -> cocok dengan: ' + (matches.length ? matches.join(', ') : 'tidak ada dari probe kita'));
  }

  await prisma.$disconnect();
})();