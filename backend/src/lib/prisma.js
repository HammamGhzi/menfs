const { PrismaClient } = require('@prisma/client');

// Satu client untuk seluruh proses. Sebelumnya tiap modul membuat sendiri
// (lima connection pool terpisah), jadi tiap endpoint hanya boleh memakai
// slot koneksi miliknya dan jumlah koneksi terbuka lima kali lipat.
const g = globalThis;
const prisma = g.__menfesPrisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') g.__menfesPrisma = prisma;

module.exports = prisma;