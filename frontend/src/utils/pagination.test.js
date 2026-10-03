// Uji logika murni paginasi. Jalankan: npm test (di folder frontend).
//
// Yang diuji hanya perhitungan angka, bukan tampilan. Tampilan diverifikasi
// terpisah di peramban sungguhan.
import test from 'node:test';
import assert from 'node:assert/strict';

import { pageCount, clampPage, paginationItems } from './pagination.js';

test('pageCount membulatkan ke atas', () => {
  assert.equal(pageCount(0, 20), 0);
  assert.equal(pageCount(3, 20), 1);
  assert.equal(pageCount(20, 20), 1);
  assert.equal(pageCount(21, 20), 2);
  assert.equal(pageCount(198, 20), 10);
  assert.equal(pageCount(230, 20), 12);
});

test('pageCount menolak masukan yang tidak masuk akal', () => {
  assert.equal(pageCount(-5, 20), 0);
  assert.equal(pageCount(10, 0), 0);
  assert.equal(pageCount(10, -1), 0);
  assert.equal(pageCount(NaN, 20), 0);
  assert.equal(pageCount(10, NaN), 0);
});

test('clampPage menjaga halaman di dalam rentang', () => {
  assert.equal(clampPage(1, 10), 1);
  assert.equal(clampPage(5, 10), 5);
  assert.equal(clampPage(10, 10), 10);
  assert.equal(clampPage(11, 10), 10);
  assert.equal(clampPage(999, 10), 10);
  assert.equal(clampPage(0, 10), 1);
  assert.equal(clampPage(-3, 10), 1);
  assert.equal(clampPage('abc', 10), 1);
  // Belum ada halaman sama sekali: tetap minta halaman 1.
  assert.equal(clampPage(7, 0), 1);
});

test('paginationItems menampilkan semua kalau sedikit', () => {
  assert.deepEqual(paginationItems(1, 1), [1]);
  assert.deepEqual(paginationItems(3, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(paginationItems(1, 7), [1, 2, 3, 4, 5, 6, 7]);
});

test('paginationItems memakai elipsis kalau banyak', () => {
  assert.deepEqual(paginationItems(1, 10), [1, 2, '…', 10]);
  assert.deepEqual(paginationItems(5, 10), [1, '…', 4, 5, 6, '…', 10]);
  assert.deepEqual(paginationItems(10, 10), [1, '…', 9, 10]);
});

test('paginationItems tidak pernah menaruh elipsis di ujung', () => {
  for (let total = 8; total <= 30; total++) {
    for (let cur = 1; cur <= total; cur++) {
      const items = paginationItems(cur, total);
      assert.notEqual(items[0], '…', `total=${total} cur=${cur}`);
      assert.notEqual(items[items.length - 1], '…', `total=${total} cur=${cur}`);
      const angka = items.filter((x) => x !== '…');
      assert.equal(angka[0], 1, `total=${total} cur=${cur}`);
      assert.equal(angka[angka.length - 1], total, `total=${total} cur=${cur}`);
      // Dua elipsis berdampingan itu bug tampilan.
      for (let i = 1; i < items.length; i++) {
        assert.ok(!(items[i] === '…' && items[i - 1] === '…'), `elipsis dobel total=${total} cur=${cur}`);
      }
    }
  }
});

test('paginationItems kosong kalau tidak ada halaman', () => {
  assert.deepEqual(paginationItems(1, 0), []);
});
