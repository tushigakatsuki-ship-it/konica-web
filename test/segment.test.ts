import assert from 'node:assert/strict';
import test from 'node:test';
import { INPUT_SIZE, preprocess, postprocess } from '../src/lib/segment';

/**
 * U²-Net портын ЦЭВЭР цөм.
 *
 * ONNX сесс өөрөө node дээр ажиллахгүй (WASM, fetch хэрэгтэй) тул түүнийг
 * нимгэн давхаргад тусгаарласан. Энд бодит алдаа гардаг хоёр хэсгийг л
 * шалгана: оролт бэлтгэх, гаралт хөрвүүлэх.
 *
 * Эдгээр нь чимээгүй алддаг төрлийн код: буруу хэвийн болголт, буруу
 * тэнхлэгийн дараалал, хагас пикселийн хазайлт — аль нь ч алдаа шиддэггүй,
 * зүгээр л маск бага зэрэг буруу гарна.
 */

const solid = (w: number, h: number, rgb: [number, number, number]) => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    d[i * 4] = rgb[0];
    d[i * 4 + 1] = rgb[1];
    d[i * 4 + 2] = rgb[2];
    d[i * 4 + 3] = 255;
  }
  return d;
};

test('оролт нь NCHW бүтэцтэй, ImageNet-ээр хэвийн болсон', () => {
  const out = preprocess(solid(64, 64, [255, 0, 0]), 64, 64);

  assert.equal(out.length, 3 * INPUT_SIZE * INPUT_SIZE, 'тензорын хэмжээ');

  const plane = INPUT_SIZE * INPUT_SIZE;
  // U²-Net нь ImageNet-ийн mean/std-ээр сурсан. Буруу утга өгвөл маск бүдгэрнэ.
  const expectR = (1 - 0.485) / 0.229;
  const expectG = (0 - 0.456) / 0.224;
  const expectB = (0 - 0.406) / 0.225;

  assert.ok(Math.abs(out[0] - expectR) < 1e-4, `R суваг: ${out[0]}`);
  assert.ok(Math.abs(out[plane] - expectG) < 1e-4, `G суваг: ${out[plane]}`);
  assert.ok(Math.abs(out[2 * plane] - expectB) < 1e-4, `B суваг: ${out[2 * plane]}`);
});

test('сувгууд ХОЛИЛДООГҮЙ — тэнхлэгийн дараалал зөв', () => {
  /*
   * NCHW-г NHWC-тэй андуурах нь энэ төрлийн кодын хамгийн түгээмэл алдаа.
   * Алдаа шиддэггүй, зүгээр л загвар утгагүй хариу өгнө.
   */
  const out = preprocess(solid(8, 8, [255, 128, 0]), 8, 8);
  const plane = INPUT_SIZE * INPUT_SIZE;

  const chan = (c: number) => out.slice(c * plane, (c + 1) * plane);
  for (const c of [0, 1, 2]) {
    const values = chan(c);
    const first = values[0];
    assert.ok(
      values.every((v) => Math.abs(v - first) < 1e-5),
      `суваг ${c} доторх утга жигд биш — тэнхлэг холилдсон`,
    );
  }

  assert.ok(chan(0)[0] > chan(1)[0], 'R > G байх ёстой');
  assert.ok(chan(1)[0] > chan(2)[0], 'G > B байх ёстой');
});

test('гаралтыг УРВУУЛНА — загвар хүнийг тэмдэглэдэг, бидэнд дэвсгэр хэрэгтэй', () => {
  /*
   * U²-Net нь тодорхойлсон обьект (=хүн) дээр өндөр утга өгдөг. Бидний
   * маскны гэрээ бол эсрэгээрээ: 255 = ДЭВСГЭР. Урвуулахаа мартвал
   * хүнийг арилгаад дэвсгэрийг үлдээнэ.
   */
  const size = 4;
  const raw = new Float32Array(size * size);
  // Зүүн хагас = хүн (1), баруун хагас = дэвсгэр (0).
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) raw[y * size + x] = x < size / 2 ? 1 : 0;
  }

  const mask = postprocess(raw, size, size, size);

  assert.equal(mask[0], 0, 'хүнийг дэвсгэр гэж үзсэн');
  assert.equal(mask[size - 1], 255, 'дэвсгэрийг хүн гэж үзсэн');
});

test('normPRED — бүдэг гаралтыг бүтэн далайцад татна', () => {
  /*
   * U²-Net-ийн албан ёсны код гаралтыг min–max-аар хэвийн болгодог.
   * Үүнгүйгээр зураг бүрт босго өөр болж, зарим зурагт маск бүхэлдээ
   * саарал гарна.
   */
  const size = 4;
  const raw = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) raw[y * size + x] = x < size / 2 ? 0.52 : 0.48;
  }

  const mask = postprocess(raw, size, size, size);
  assert.equal(mask[0], 0, 'хүний тал бүрэн 0 болоогүй');
  assert.equal(mask[size - 1], 255, 'дэвсгэрийн тал бүрэн 255 болоогүй');
});

test('жигд гаралт дээр тэгд хуваахгүй', () => {
  const size = 4;
  const raw = new Float32Array(size * size).fill(0.5);
  const mask = postprocess(raw, size, size, size);
  assert.ok(
    Array.from(mask).every((v) => Number.isFinite(v)),
    'NaN гарсан',
  );
});

test('маск эх зургийн хэмжээгээр буцна', () => {
  const raw = new Float32Array(320 * 320).fill(0.5);
  const mask = postprocess(raw, 320, 137, 211);
  assert.equal(mask.length, 137 * 211);
});
