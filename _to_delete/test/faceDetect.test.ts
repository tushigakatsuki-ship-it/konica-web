import assert from 'node:assert/strict';
import test from 'node:test';
import { faceFromSilhouette } from '../src/lib/faceDetect';

/**
 * Нүүр илрүүлэлт — дүрсийн хүрээнд суурилсан.
 *
 * Хамгийн чухал зан төлөв нь **олдоогүй үедээ `null` буцаах**: таамгаар
 * таслаад хэвлэвэл толгой тасарсан зураг гарна. Дахин авах нь хямд.
 */

interface Head {
  cx: number;
  top: number;
  headW: number;
  headH: number;
  shoulderW?: number;
}

/**
 * Жигд дэвсгэр дээрх энгийн дүрс: зууван толгой + хүзүү + мөр.
 * Бодит студийн зургийн бүтэцтэй ойролцоо.
 */
const makePortrait = (w: number, h: number, head: Head): Uint8ClampedArray => {
  const data = new Uint8ClampedArray(w * h * 4);
  const shoulderW = head.shoulderW ?? head.headW * 2.2;
  const neckTop = head.top + head.headH;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;

      // Толгой — зууван.
      const ry = head.headH / 2;
      const rx = head.headW / 2;
      const dy = (y - (head.top + ry)) / ry;
      const dx = (x - head.cx) / rx;
      const inHead = dx * dx + dy * dy <= 1;

      const inNeck =
        y >= neckTop - ry * 0.2 &&
        y < neckTop + head.headH * 0.15 &&
        Math.abs(x - head.cx) < head.headW * 0.28;

      const inBody =
        y >= neckTop + head.headH * 0.15 && Math.abs(x - head.cx) < shoulderW / 2;

      const person = inHead || inNeck || inBody;
      // Дэвсгэр цайвар, хүн бараан.
      const v = person ? 40 : 245;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = person ? 45 : 248;
      data[i + 3] = 255;
    }
  }
  return data;
};

test('толгойн орой, өргөн, төвийг оносон', () => {
  const w = 300;
  const h = 400;
  const head = { cx: 150, top: 40, headW: 90, headH: 120 };
  const found = faceFromSilhouette(makePortrait(w, h, head), w, h);

  assert.ok(found, 'нүүр олдсонгүй');
  assert.equal(found.source, 'silhouette');

  // Орой ±8px дотор.
  assert.ok(Math.abs(found.box.y - head.top) <= 8, `орой ${found.box.y}`);
  // Өргөн ±15% дотор.
  assert.ok(
    Math.abs(found.box.w - head.headW) / head.headW < 0.15,
    `өргөн ${found.box.w}`,
  );
  // Хэвтээ төв ±10px.
  assert.ok(
    Math.abs(found.box.x + found.box.w / 2 - head.cx) <= 10,
    `төв ${found.box.x + found.box.w / 2}`,
  );
});

test('толгой хажуу тийш шилжсэн ч төвийг дагана', () => {
  const w = 300;
  const h = 400;
  const found = faceFromSilhouette(
    makePortrait(w, h, { cx: 100, top: 50, headW: 80, headH: 108 }),
    w,
    h,
  );
  assert.ok(found);
  assert.ok(Math.abs(found.box.x + found.box.w / 2 - 100) <= 12);
});

test('ХООСОН дэвсгэр дээр null — таамаглаж таслахгүй', () => {
  const w = 100;
  const h = 140;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 245;
    data[i + 1] = 245;
    data[i + 2] = 248;
    data[i + 3] = 255;
  }
  assert.equal(faceFromSilhouette(data, w, h), null);
});

test('хүн зургийн доод хэсэгт л байвал null', () => {
  const w = 200;
  const h = 400;
  // Орой нь өндрийн 50%-иас доош — толгой биш, өөр зүйл байх магадлалтай.
  const found = faceFromSilhouette(
    makePortrait(w, h, { cx: 100, top: 260, headW: 60, headH: 80 }),
    w,
    h,
  );
  assert.equal(found, null);
});

test('толгой хэт том/жижиг бол итгэл БАГА гэж тэмдэглэнэ', () => {
  const w = 300;
  const h = 400;

  // Хэт жижиг — хүн хол зогссон.
  const tiny = faceFromSilhouette(
    makePortrait(w, h, { cx: 150, top: 30, headW: 30, headH: 40, shoulderW: 60 }),
    w,
    h,
  );
  assert.ok(tiny);
  assert.equal(tiny.confidence, 'low');

  // Хэвийн — итгэл өндөр.
  const normal = faceFromSilhouette(
    makePortrait(w, h, { cx: 150, top: 40, headW: 90, headH: 120 }),
    w,
    h,
  );
  assert.ok(normal);
  assert.equal(normal.confidence, 'high');
});

test('мөр толгойноос өргөн ч толгойг л барина', () => {
  const w = 300;
  const h = 400;
  const found = faceFromSilhouette(
    makePortrait(w, h, { cx: 150, top: 40, headW: 90, headH: 120, shoulderW: 280 }),
    w,
    h,
  );

  assert.ok(found);
  // Мөрний өргөнийг толгой гэж авсан бол 280 орчим гарна.
  assert.ok(found.box.w < 140, `мөрийг толгой гэж үзсэн: ${found.box.w}`);
});
