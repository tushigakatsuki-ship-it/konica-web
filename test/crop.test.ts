import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CROP,
  MAX_ZOOM,
  isDefaultCrop,
  normalizeCrop,
  panCrop,
  placeCover,
} from '../src/lib/crop';

/**
 * Тайралтын тооцоо. Энэ файл дахь алдаа нь ШУУД мөнгө болж хувирдаг: буруу
 * тайрсан зураг хэвлэгдээд гарч ирнэ, дахин хэвлэх нь цаас, бэх, цаг.
 *
 * Хамгийн чухал шалгалт нь эхнийх — шинэ боломж нь ХУУЧИН зан төлвийг
 * өөрчлөөгүй байх ёстой.
 */

const frame = { width: 1000, height: 1500 }; // 10×15 харьцаа
const landscape = { width: 4032, height: 3024 }; // ердийн утасны 4:3

test('тайраагүй үед хуучин зан төлөвтэй ЯГ ижил (төвөөр нь cover)', () => {
  const at = placeCover(landscape, frame, DEFAULT_CROP);

  // Хуучин код: cover = max(outW/srcW, outH/srcH), дараа нь төвд байрлуулна.
  const cover = Math.max(frame.width / landscape.width, frame.height / landscape.height);
  assert.equal(at.width, landscape.width * cover);
  assert.equal(at.height, landscape.height * cover);
  assert.equal(at.x, (frame.width - at.width) / 2);
  assert.equal(at.y, (frame.height - at.height) / 2);
});

test('crop өгөөгүй ч ижил үр дүн — хуучин сагсны мөр эвдрэхгүй', () => {
  assert.deepEqual(placeCover(landscape, frame), placeCover(landscape, frame, DEFAULT_CROP));
});

test('хүрээ ҮРГЭЛЖ дүүрнэ — цагаан зай гарахгүй', () => {
  /*
   * Цагаан зай гарвал хэвлэсэн зураг цаасны ирмэг дээр цагаан судалтай гарна.
   * Тиймээс хилийн бүх утгыг шалгана.
   */
  for (const zoom of [1, 1.0001, 2, MAX_ZOOM]) {
    for (const cx of [0, 0.25, 0.5, 0.75, 1]) {
      for (const cy of [0, 0.5, 1]) {
        for (const source of [landscape, { width: 3024, height: 4032 }, { width: 1000, height: 1000 }]) {
          const at = placeCover(source, frame, { zoom, cx, cy });
          const label = `zoom=${zoom} cx=${cx} cy=${cy} ${source.width}x${source.height}`;

          assert.ok(at.width >= frame.width - 1e-6, `өргөн дутуу: ${label}`);
          assert.ok(at.height >= frame.height - 1e-6, `өндөр дутуу: ${label}`);
          assert.ok(at.x <= 1e-6, `зүүнд зай гарлаа: ${label}`);
          assert.ok(at.y <= 1e-6, `дээр зай гарлаа: ${label}`);
          assert.ok(at.x + at.width >= frame.width - 1e-6, `баруунд зай: ${label}`);
          assert.ok(at.y + at.height >= frame.height - 1e-6, `доор зай: ${label}`);
        }
      }
    }
  }
});

test('cx нь зүүнээс баруун тийш шилжүүлнэ', () => {
  const left = placeCover(landscape, frame, { zoom: 1, cx: 0, cy: 0.5 });
  const middle = placeCover(landscape, frame, { zoom: 1, cx: 0.5, cy: 0.5 });
  const right = placeCover(landscape, frame, { zoom: 1, cx: 1, cy: 0.5 });

  assert.equal(left.x, 0, 'cx=0 бол зүүн ирмэг таарна');
  assert.ok(left.x > middle.x && middle.x > right.x, 'cx өсөхөд зураг зүүн тийш гулсана');
  assert.ok(Math.abs(right.x + right.width - frame.width) < 1e-6, 'cx=1 бол баруун ирмэг таарна');
});

test('zoom нь зөвхөн томруулна, хэзээ ч жижигрүүлэхгүй', () => {
  const base = placeCover(landscape, frame, DEFAULT_CROP);
  const closer = placeCover(landscape, frame, { zoom: 2, cx: 0.5, cy: 0.5 });

  assert.ok(closer.width > base.width);
  assert.equal(closer.width / base.width, 2);

  // 1-ээс бага утга ирвэл 1 болж хязгаарлагдана — эс тэгвээс цагаан зай гарна.
  const tooSmall = placeCover(landscape, frame, { zoom: 0.2, cx: 0.5, cy: 0.5 });
  assert.equal(tooSmall.width, base.width);
});

// ── Хамгаалалт ─────────────────────────────────────────────────────

test('гажсан утгыг аюулгүй болгоно', () => {
  assert.deepEqual(normalizeCrop(null), DEFAULT_CROP);
  assert.deepEqual(normalizeCrop(undefined), DEFAULT_CROP);
  assert.deepEqual(normalizeCrop({}), DEFAULT_CROP);

  assert.equal(normalizeCrop({ zoom: NaN, cx: 0.5, cy: 0.5 }).zoom, 1);
  assert.equal(normalizeCrop({ zoom: Infinity, cx: 0.5, cy: 0.5 }).zoom, 1);
  assert.equal(normalizeCrop({ zoom: 999, cx: 0.5, cy: 0.5 }).zoom, MAX_ZOOM);
  assert.equal(normalizeCrop({ zoom: 1, cx: -5, cy: 9 }).cx, 0);
  assert.equal(normalizeCrop({ zoom: 1, cx: -5, cy: 9 }).cy, 1);
});

test('isDefaultCrop нь хөндөөгүйг л үнэн гэнэ', () => {
  assert.equal(isDefaultCrop(DEFAULT_CROP), true);
  assert.equal(isDefaultCrop({ zoom: 1, cx: 0.5, cy: 0.5 }), true);
  assert.equal(isDefaultCrop({ zoom: 1.2, cx: 0.5, cy: 0.5 }), false);
  assert.equal(isDefaultCrop({ zoom: 1, cx: 0.4, cy: 0.5 }), false);
});

// ── Чирэх ──────────────────────────────────────────────────────────

test('чирэхэд хуруу дагаж хөдөлнө', () => {
  const crop = { zoom: 1, cx: 0.5, cy: 0.5 };
  const at = placeCover(landscape, frame, crop);

  // Хуруу БАРУУН тийш → зураг баруун тийш → ЗҮҮН хэсэг илүү харагдана → cx буурна.
  const dragged = panCrop(crop, at, frame, 100, 0);
  assert.ok(dragged.cx < 0.5, `cx буурах ёстой, гарсан нь ${dragged.cx}`);
});

test('чирэлт хилээс хэтрэхгүй', () => {
  const crop = { zoom: 1, cx: 0.5, cy: 0.5 };
  const at = placeCover(landscape, frame, crop);

  assert.equal(panCrop(crop, at, frame, -99_999, 0).cx, 1);
  assert.equal(panCrop(crop, at, frame, 99_999, 0).cx, 0);
});

test('илүүдэлгүй тэнхлэгээр чирэхэд өөрчлөгдөхгүй', () => {
  /*
   * 4032×3024 зургийг 10×15 (2:3) хүрээнд `cover`-оор тавихад ӨНДӨР нь яг
   * таарна — босоо чиглэлд хөдлөх зай алга. Тэнд 0-д хуваах алдаа гарч
   * `cx`/`cy` нь NaN болвол зураг бүхэлдээ алга болно.
   */
  const crop = { zoom: 1, cx: 0.5, cy: 0.5 };
  const at = placeCover(landscape, frame, crop);
  assert.ok(Math.abs(at.height - frame.height) < 1e-6, 'өндөр нь яг таарсан байх ёстой');

  const dragged = panCrop(crop, at, frame, 0, 250);
  assert.equal(dragged.cy, 0.5, 'хөдлөх зайгүй тэнхлэг хэвээр үлдэнэ');
  assert.ok(Number.isFinite(dragged.cy), 'NaN болох ёсгүй');
});

test('квадрат зургийг квадрат хүрээнд тавихад ямар ч тэнхлэгээр хөдлөхгүй', () => {
  const square = { width: 2000, height: 2000 };
  const box = { width: 500, height: 500 };
  const crop = { zoom: 1, cx: 0.5, cy: 0.5 };
  const at = placeCover(square, box, crop);

  const dragged = panCrop(crop, at, box, 80, 80);
  assert.deepEqual(dragged, crop);
});
