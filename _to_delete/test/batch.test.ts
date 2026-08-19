import assert from 'node:assert/strict';
import test from 'node:test';
import { friendlyReason, runBatch, summarize } from '../src/lib/batch';

/**
 * Багцын дараалал.
 *
 * Энд шалгаж буй бүх зүйл нь ЧИМЭЭГҮЙ алддаг: эмх замбараагүй эрэмбэ,
 * давхардсан тоолол, хэтэрсэн зэрэгцээлт, цуцлахад үргэлжлэх ажил.
 * Аль нь ч алдаа шиддэггүй тул тестгүйгээр анзаарагдахгүй.
 */

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('үр дүн ОРОЛТЫН эрэмбээр буцна', async () => {
  /*
   * Ажлууд өөр өөр хугацаанд дуусна. Дуусах дарааллаар нь цуглуулбал
   * IMG_010 нь IMG_001-ээс өмнө гарч, ажилтан төөрнө.
   */
  const items = [50, 10, 30, 0, 20];

  const entries = await runBatch(
    items,
    (_item, i) => `IMG_${String(i + 1).padStart(3, '0')}`,
    async (ms) => {
      await wait(ms);
      return ms;
    },
    { concurrency: 3 },
  );

  assert.deepEqual(
    entries.map((e) => e.name),
    ['IMG_001', 'IMG_002', 'IMG_003', 'IMG_004', 'IMG_005'],
  );
  assert.deepEqual(entries.map((e) => e.result), items);
});

test('зэрэгцээлт хязгаараас ХЭТРЭХГҮЙ', async () => {
  let running = 0;
  let peak = 0;

  await runBatch(
    Array.from({ length: 12 }, (_, i) => i),
    (_i, i) => `${i}`,
    async () => {
      running += 1;
      peak = Math.max(peak, running);
      await wait(5);
      running -= 1;
      return true;
    },
    { concurrency: 3 },
  );

  assert.equal(peak, 3, `зэрэг ${peak} ажил явсан`);
});

test('нэг зураг унахад багц ҮРГЭЛЖИЛНЭ', async () => {
  const entries = await runBatch(
    [1, 2, 3, 4],
    (_i, i) => `IMG_${i}`,
    async (n) => {
      if (n === 2) throw new Error('Нүүр олдсонгүй');
      return n * 10;
    },
    { concurrency: 2 },
  );

  assert.deepEqual(
    entries.map((e) => e.status),
    ['done', 'error', 'done', 'done'],
  );
  assert.equal(entries[1].reason, 'Нүүр олдсонгүй', 'шалтгааныг дамжуулаагүй');
  assert.equal(entries[3].result, 40, 'алдааны дараах ажил зогссон');
});

test('явцын тоо яг НЭГ удаа нэмэгдэнэ', async () => {
  const seen: number[] = [];

  await runBatch(
    Array.from({ length: 8 }, (_, i) => i),
    (_i, i) => `${i}`,
    async (n) => {
      await wait(n % 3);
      if (n === 5) throw new Error('унав');
      return n;
    },
    { concurrency: 4, onProgress: (done) => seen.push(done) },
  );

  // Алдаатай ажил ч тоологдоно — эс бөгөөс явц 8/8 хүрэхгүй.
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7, 8], `явц: ${seen.join(',')}`);
});

test('зураг бүр ЯГ нэг удаа боловсруулагдана', async () => {
  /*
   * Дугаар хуваарилах ба өсгөх хоёрын хооронд `await` орвол хоёр ажилтан
   * ижил дугаар авна. Энэ бол сонгодог уралдааны алдаа.
   */
  const counts = new Map<number, number>();

  await runBatch(
    Array.from({ length: 20 }, (_, i) => i),
    (_i, i) => `${i}`,
    async (n) => {
      counts.set(n, (counts.get(n) ?? 0) + 1);
      await wait(1);
      return n;
    },
    { concurrency: 5 },
  );

  assert.equal(counts.size, 20);
  for (const [n, c] of counts) assert.equal(c, 1, `${n} дугаар ${c} удаа боловсруулагдав`);
});

test('цуцлахад шинэ ажил ЭХЛЭХГҮЙ', async () => {
  const controller = new AbortController();
  let started = 0;

  const promise = runBatch(
    Array.from({ length: 20 }, (_, i) => i),
    (_i, i) => `${i}`,
    async (n) => {
      started += 1;
      await wait(5);
      return n;
    },
    { concurrency: 2, signal: controller.signal },
  );

  await wait(12);
  controller.abort();
  const entries = await promise;

  assert.ok(started < 20, `цуцлалт үл ойшоогдов: ${started} ажил эхэлсэн`);
  assert.ok(
    entries.some((e) => e.status === 'cancelled'),
    'цуцлагдсан гэж тэмдэглээгүй',
  );
  assert.equal(entries.length, 20, 'бүх мөр үлдэх ёстой');
});

test('элемент байхгүй үед унахгүй', async () => {
  const entries = await runBatch([], () => '', async () => 1, { concurrency: 4 });
  assert.deepEqual(entries, []);
});

test('зэрэгцээлт элементийн тооноос их байсан ч зүгээр', async () => {
  const entries = await runBatch([1, 2], (_i, i) => `${i}`, async (n) => n, {
    concurrency: 10,
  });
  assert.equal(entries.length, 2);
  assert.ok(entries.every((e) => e.status === 'done'));
});

/* ── Алдааны мессеж ──────────────────────────────────────────────── */

test('монгол мессежийг дамжуулж, техникийнхийг НУУНА', async () => {
  // Зориуд шидсэн, хэрэглэгчид зориулсан мессеж хэвээр гарна.
  assert.equal(friendlyReason(new Error('Нүүр олдсонгүй')), 'Нүүр олдсонгүй');

  // Техникийн мессежийг хэрэглэгчид харуулахгүй.
  const technical = friendlyReason(new Error('NotReadableError: source image'));
  assert.doesNotMatch(technical, /NotReadableError/);
  assert.match(technical, /[Ѐ-ӿ]/, 'кирилл биш');

  // Error биш зүйл шидэгдсэн ч унахгүй.
  assert.match(friendlyReason('шалтгаангүй'), /[Ѐ-ӿ]/);
  assert.match(friendlyReason(undefined), /[Ѐ-ӿ]/);
});

test('товч дүн зөв тоолно', async () => {
  const entries = await runBatch(
    [1, 2, 3, 4, 5],
    (_i, i) => `${i}`,
    async (n) => {
      if (n % 2 === 0) throw new Error('унав');
      return n;
    },
    { concurrency: 2 },
  );

  assert.deepEqual(summarize(entries), { total: 5, done: 3, failed: 2, cancelled: 0 });
});
