import assert from 'node:assert/strict';
import test from 'node:test';
import { suggestFromHistogram, type Histogram } from '../src/lib/autoEnhance';

/** 256 хэмжигдэхүүнтэй, бүгд 0-оор дүүргэсэн гистограм эхлэл. */
const empty = (): Histogram => new Array(256).fill(0);

/** `value` дээр `count` ширхэг пиксэл шигтгэсэн гистограм. */
const spike = (value: number, count = 1000): Histogram => {
  const h = empty();
  h[value] = count;
  return h;
};

test('хоосон гистограмд өөрчлөлт санал болгохгүй', () => {
  assert.deepEqual(suggestFromHistogram(empty()), { brightness: 0, contrast: 0 });
});

test('дунд саарал (128) дээр төвлөрсөн бол өөрчлөлт бараг байхгүй', () => {
  const result = suggestFromHistogram(spike(128));
  assert.equal(result.brightness, 0);
});

test('бараан зурагт эерэг гэрэлтүүлэг санал болгоно', () => {
  const result = suggestFromHistogram(spike(30));
  assert.ok(result.brightness > 0, `гэрэлтүүлэг эерэг байх ёстой, гарсан нь ${result.brightness}`);
  assert.ok(result.brightness <= 50, 'дээд хязгаараас хэтрэхгүй');
});

test('цайвар зурагт сөрөг гэрэлтүүлэг санал болгоно', () => {
  const result = suggestFromHistogram(spike(220));
  assert.ok(result.brightness < 0, `гэрэлтүүлэг сөрөг байх ёстой, гарсан нь ${result.brightness}`);
  assert.ok(result.brightness >= -50, 'доод хязгаараас хэтрэхгүй');
});

test('нарийн хүрээтэй (бүдэг) зурагт эерэг контраст санал болгоно', () => {
  const h = empty();
  for (let v = 100; v <= 150; v += 1) h[v] = 10;
  const result = suggestFromHistogram(h);
  assert.ok(result.contrast > 0, `контраст эерэг байх ёстой, гарсан нь ${result.contrast}`);
  assert.ok(result.contrast <= 50, 'дээд хязгаараас хэтрэхгүй');
});

test('бүтэн хүрээтэй (0-255) зурагт контраст бараг санал болгохгүй', () => {
  /*
   * 2/98 персентиль тул хамгийн туйлын 2%-ийг тайрч авдаг — тиймээс бүтэн
   * хүрээтэй ч гэсэн яг 0 биш, ЖИЖИГ утга гарна. Энэ бол цөөн тооны цайвар/
   * бараан «шуугиантай» пиксэлээс хамгаалах зорилготой, алдаа биш.
   */
  const h = empty();
  for (let v = 0; v <= 255; v += 1) h[v] = 10;
  const result = suggestFromHistogram(h);
  assert.ok(result.contrast <= 5, `контраст бага байх ёстой, гарсан нь ${result.contrast}`);
});

test('бүрэн хар, бүрэн цагаан зурагт хязгаараас хэтрэхгүй', () => {
  const black = suggestFromHistogram(spike(0));
  const white = suggestFromHistogram(spike(255));
  assert.ok(black.brightness <= 50 && black.brightness >= -50);
  assert.ok(white.brightness <= 50 && white.brightness >= -50);
  assert.ok(black.contrast >= 0 && black.contrast <= 50);
  assert.ok(white.contrast >= 0 && white.contrast <= 50);
});

test('контраст хэзээ ч сөрөг байхгүй — аль хэдийн тод зургийг буруу тэгшлэхгүй', () => {
  for (const value of [0, 30, 60, 90, 128, 160, 200, 255]) {
    const result = suggestFromHistogram(spike(value));
    assert.ok(result.contrast >= 0, `contrast сөрөг гарлаа: value=${value}`);
  }
});
