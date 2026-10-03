// Baca ?page dan ?limit supaya selalu bilangan bulat di dalam batas.
//
// Tanpa ini: ?limit=-5 sampai ke Prisma sebagai take: -5 dan respons
// mengirim limit: -5 serta totalPages: -2. ?page=99999999 jadi OFFSET dua
// miliar, yang dipaksa database untuk disorot lalu dibuang.

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(Array.isArray(value) ? value[0] : value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parsePaging(query, opts = {}) {
  const { defaultLimit = 10, maxLimit = 20, maxPage = 100 } = opts;
  const page = clampInt(query.page, 1, maxPage, 1);
  const limit = clampInt(query.limit, 1, maxLimit, defaultLimit);
  return { page, limit, skip: (page - 1) * limit };
}

module.exports = { parsePaging };