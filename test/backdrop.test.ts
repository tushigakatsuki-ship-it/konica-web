import assert from 'node:assert/strict';
import test from 'node:test';
import { backgroundMask, featherMask, fitBackdrop } from '../src/lib/backdrop';

/**
 * Цээж зургийн харилцагчийн засварын хэрэгслийн «жигд эсэх» шалгуур.
 *
 * ⚠️ Хамгийн чухал зүйл нь `fitBackdrop`-ийн `uniform` тугийн зан төлөв:
 * энэ л дэвсгэр солих сонголтыг харилцагчид харуулах эсэхийг шийддэг —
 * буруу бол эсвэл жигд дэвсгэрт `false` буцаагаад хэрэггүй хязгаарлана,
 * эсвэл эмх замбараагүй дэвсгэрт `true` буцаагаад муу үр дүн үзүүлнэ
 * (README-ийн «Цээж зураг — шийдвэр ЭРГЭСЭН» түүхэнд яг ийм алдаа байсан).
 */

const W = 40;
const H = 40;

function makeFlat(r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let p = 0; p < W * H; p += 1) {
    data[p * 4] = r;
    data[p * 4 + 1] = g;
    data[p * 4 + 2] = b;
    data[p * 4 + 3] = 255;
  }
  return data;
}

test('fitBackdrop: жигд студийн дэвсгэрт uniform true, residual бага', () => {
  const data = makeFlat(240, 240, 245);
  const backdrop = fitBackdrop(data, W, H);
  assert.equal(backdrop.uniform, true);
  assert.ok(backdrop.residual < 5, `residual хэт өндөр: ${backdrop.residual}`);
});

test('fitBackdrop: ирмэг эмх замбараагүй бол uniform false', () => {
  const data = makeFlat(240, 240, 245);

  // Дээд ирмэгийг шатрын самбар маягаар эвдэнэ — хавтгайд огт таарахгүй.
  for (let x = 0; x < W; x += 1) {
    for (let d = 0; d < 4; d += 1) {
      const p = (d * W + x) * 4;
      const noisy = (x + d) % 2 === 0 ? 10 : 250;
      data[p] = noisy;
      data[p + 1] = noisy;
      data[p + 2] = noisy;
    }
  }

  const backdrop = fitBackdrop(data, W, H);
  assert.equal(backdrop.uniform, false);
  assert.ok(backdrop.residual > 24, `residual хэт бага: ${backdrop.residual}`);
});

test('backgroundMask: ирмэгээс дүүрч, дундах силуэтэд зогсоно', () => {
  const data = makeFlat(255, 255, 255);

  // Дундах 10×10 блок — «хүн», дэвсгэрээс эрс өөр өнгөтэй.
  for (let y = 15; y < 25; y += 1) {
    for (let x = 15; x < 25; x += 1) {
      const p = (y * W + x) * 4;
      data[p] = 10;
      data[p + 1] = 10;
      data[p + 2] = 10;
    }
  }

  const mask = backgroundMask(data, W, H, 40);

  assert.equal(mask[0], 255, 'ирмэгийн пиксел дэвсгэр гэж танигдаагүй');
  assert.equal(mask[20 * W + 20], 0, 'силуэтийн төв дэвсгэр гэж буруу танигдсан');
});

test('featherMask: ирмэгийг зөөлрүүлнэ, алсад хүрэхгүй', () => {
  const w = 20;
  const h = 1;
  const mask = new Uint8Array(w * h);
  for (let x = 10; x < w; x += 1) mask[x] = 255;

  const feathered = featherMask(mask, w, h, 2);

  assert.ok(
    feathered[9] > 0 && feathered[9] < 255,
    `ирмэгийн ойролцоо зөөлрөлт алга: ${feathered[9]}`,
  );
  assert.equal(feathered[0], 0, 'алс дэх пиксел өөрчлөгдсөн');
  assert.equal(feathered[19], 255, 'алс дэх пиксел өөрчлөгдсөн');
});
