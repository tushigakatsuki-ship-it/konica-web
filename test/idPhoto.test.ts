import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cropForFace,
  BACKGROUNDS,
  ID_SIZES,
  SHEET,
  applyBackground,
  backgroundMask,
  borderColor,
  cmToPx,
  featherMask,
  sheetLayout,
} from '../src/lib/idPhoto';

/**
 * Цээж зургийн автоматжуулалт — тооцооны цөм.
 *
 * Хуудасны байрлуулалт нь бодит мөнгө: 3×4 зураг босоогоор 9, хэвтээгээр 8
 * багтдаг. Нэг ширхэгийн зөрүү өдөрт олон захиалга дээр хуримтлагдана.
 */

// ── Хэмжээ ────────────────────────────────────────────────────────

test('300dpi хөрвүүлэлт', () => {
  assert.equal(cmToPx(10), 1181);
  assert.equal(cmToPx(15), 1772);
  assert.equal(cmToPx(3), 354);
});

test('стандарт хэмжээнүүд каталогтой холбогдсон', () => {
  for (const size of ID_SIZES) {
    assert.ok(size.serviceId > 0, size.label);
    assert.ok(size.w > 0 && size.h > size.w, `${size.label} нь босоо байх ёстой`);
    // Бичиг баримтын стандарт: толгой нь хүрээний 70–80%.
    assert.ok(size.headRatio >= 0.6 && size.headRatio <= 0.85, size.label);
  }
});

// ── Хуудасны байрлуулалт ──────────────────────────────────────────

test('3×4 зураг 10×15 цаасанд 9 ширхэг багтана', () => {
  const layout = sheetLayout(ID_SIZES[0]);
  assert.equal(layout.count, 9);
  assert.equal(layout.cols, 3);
  assert.equal(layout.rows, 3);
});

test('илүү олон багтаах чиглэлийг сонгоно', () => {
  for (const size of ID_SIZES) {
    const layout = sheetLayout(size);
    const w = layout.rotated ? size.h : size.w;
    const h = layout.rotated ? size.w : size.h;

    // Сонгосон чиглэл нь эсрэг чиглэлээсээ дутуугүй байх ёстой.
    const otherCols = Math.floor((SHEET.w - 0.2) / (h + 0.2));
    const otherRows = Math.floor((SHEET.h - 0.2) / (w + 0.2));
    assert.ok(
      layout.count >= otherCols * otherRows,
      `${size.label}: ${layout.count} < ${otherCols * otherRows}`,
    );
    assert.ok(w > 0 && h > 0);
  }
});

test('нүд бүр цаасны дотор, давхцалгүй', () => {
  for (const size of ID_SIZES) {
    const { slots } = sheetLayout(size);

    for (const slot of slots) {
      assert.ok(slot.x >= -1e-9, `зүүн талаас гарсан: ${size.label}`);
      assert.ok(slot.y >= -1e-9, `дээрээс гарсан: ${size.label}`);
      assert.ok(slot.x + slot.w <= SHEET.w + 1e-9, `баруун талаас гарсан: ${size.label}`);
      assert.ok(slot.y + slot.h <= SHEET.h + 1e-9, `доороос гарсан: ${size.label}`);
    }

    for (let i = 0; i < slots.length; i += 1) {
      for (let j = i + 1; j < slots.length; j += 1) {
        const a = slots[i];
        const b = slots[j];
        const overlap =
          a.x < b.x + b.w - 1e-9 &&
          b.x < a.x + a.w - 1e-9 &&
          a.y < b.y + b.h - 1e-9 &&
          b.y < a.y + a.h - 1e-9;
        assert.ok(!overlap, `${size.label}: ${i} ба ${j} давхцаж байна`);
      }
    }
  }
});

test('байрлуулалт төвлөрсөн — нэг тал дээр цагаан зурвас үлдэхгүй', () => {
  const { slots } = sheetLayout(ID_SIZES[0]);
  const left = Math.min(...slots.map((s) => s.x));
  const right = SHEET.w - Math.max(...slots.map((s) => s.x + s.w));
  assert.ok(Math.abs(left - right) < 1e-9, `зүүн ${left} ≠ баруун ${right}`);
});

test('зай ихсэхэд багтах тоо буурна', () => {
  assert.ok(sheetLayout(ID_SIZES[0], 1.5).count < sheetLayout(ID_SIZES[0], 0.2).count);
});

// ── Дэвсгэр солих ─────────────────────────────────────────────────

/** Голдоо хар дөрвөлжинтэй, ирмэгээрээ жигд өнгөтэй туршилтын зураг. */
const makeImage = (w: number, h: number, bg: [number, number, number]) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const inside = x > w / 3 && x < (w * 2) / 3 && y > h / 3 && y < (h * 2) / 3;
      const [r, g, b] = inside ? [10, 10, 10] : bg;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
};

test('ирмэгээс дэвсгэрийн өнгийг таамаглана', () => {
  const data = makeImage(40, 60, [200, 210, 240]);
  const color = borderColor(data, 40, 60);

  assert.ok(Math.abs(color.r - 200) <= 2, `r=${color.r}`);
  assert.ok(Math.abs(color.g - 210) <= 2, `g=${color.g}`);
  assert.ok(Math.abs(color.b - 240) <= 2, `b=${color.b}`);
});

test('дэвсгэрийг таньж, хүнийг хөндөхгүй', () => {
  const w = 40;
  const h = 60;
  const data = makeImage(w, h, [240, 240, 240]);
  const mask = backgroundMask(data, w, h, 40);

  // Булан бол дэвсгэр.
  assert.equal(mask[0], 255);
  assert.equal(mask[w - 1], 255);
  // Төв бол хүн.
  assert.equal(mask[Math.floor(h / 2) * w + Math.floor(w / 2)], 0);
});

test('биеийн доторх цагаан хэсгийг АЛГАСНА', () => {
  /*
   * Хамгийн чухал шалгалт: цагаан цамц, нүдний цагаан нь дэвсгэртэй ижил
   * өнгөтэй. Зүгээр «өнгө ойролцоо бүх пиксел» гэж авбал цамц нь тунгалаг
   * болж, хэвлэсэн зураг дээр нүх гарна. Ирмэгээс залгаа хэсгийг л авдаг
   * учраас ийм зүйл болохгүй.
   */
  const w = 40;
  const h = 60;
  const data = makeImage(w, h, [255, 255, 255]);

  // Хар дөрвөлжингийн ДОТОР цагаан толбо (цамцны загвар).
  const spot = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  data[spot] = 255;
  data[spot + 1] = 255;
  data[spot + 2] = 255;

  const mask = backgroundMask(data, w, h, 40);
  assert.equal(mask[spot / 4], 0, 'биеийн доторх цагаан толбыг дэвсгэр гэж үзсэн');
});

test('зөвшөөрөл нь дэвсгэрийн хэмжээг тодорхойлно', () => {
  const w = 40;
  const h = 60;
  const data = makeImage(w, h, [240, 240, 240]);

  const count = (t: number) =>
    backgroundMask(data, w, h, t).reduce((sum, v) => sum + (v > 0 ? 1 : 0), 0);

  // Зөвшөөрөл 0 бол зөвхөн яг таарсан пиксел; өсгөхөд илүү өргөн барина.
  assert.ok(count(300) >= count(40), 'зөвшөөрөл өсөхөд дэвсгэр өсөх ёстой');
  assert.ok(count(40) > 0);
});

test('зөөлрүүлэлт нь завсрын утга үүсгэнэ', () => {
  const w = 20;
  const h = 20;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w / 2; x += 1) mask[y * w + x] = 255;
  }

  const soft = featherMask(mask, w, h, 2);
  const edge = soft[10 * w + Math.floor(w / 2)];

  // Ирмэг дээр 0 ч биш 255 ч биш — үүнгүйгээр үс шүдлэг гарна.
  assert.ok(edge > 0 && edge < 255, `ирмэг зөөлрөөгүй: ${edge}`);
});

test('дэвсгэрийг сонгосон өнгөөр солино', () => {
  const w = 10;
  const h = 10;
  const data = makeImage(w, h, [0, 0, 255]);
  const mask = backgroundMask(data, w, h, 40);

  applyBackground(data, mask, BACKGROUNDS[0].rgb!);

  // Булан цагаан болсон, төв нь хэвээр хар.
  assert.equal(data[0], 255);
  assert.equal(data[1], 255);
  assert.equal(data[2], 255);

  const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  assert.ok(data[center] < 50, 'хүнийг будсан');
});

// ── Автомат тайралт ───────────────────────────────────────────────

test('2×3 хэмжээ нэмэгдсэн', () => {
  const small = ID_SIZES.find((s) => s.label === '2×3 см');
  assert.ok(small, '2×3 байхгүй');
  assert.equal(small.w, 2);
  assert.equal(small.h, 3);
});

test('«Хэвээр» сонголт байна — дэвсгэрийг хөндөхгүй', () => {
  const keep = BACKGROUNDS.find((b) => b.key === 'keep');
  assert.ok(keep, 'Хэвээр сонголт алга');
  assert.equal(keep.rgb, null, 'өнгөгүй байх ёстой');
});

test('тайралт нь стандартын хоёр хэмжилтийг хангана', () => {
  const size = ID_SIZES[0]; // 3×4
  const face = { x: 400, y: 200, w: 300, h: 405 };
  const { rect, clamped } = cropForFace(face, size, 2000, 3000);

  assert.equal(clamped, false);

  // 1. Толгойн өндөр = хүрээний өндрийн headRatio
  assert.ok(Math.abs(face.h / rect.h - size.headRatio) < 1e-9);

  // 2. Толгойн орой нь дээд ирмэгээс topMargin зайд
  assert.ok(Math.abs((face.y - rect.y) / rect.h - size.topMargin) < 1e-9);

  // 3. Харьцаа нь сонгосон хэмжээтэй таарна
  assert.ok(Math.abs(rect.w / rect.h - size.w / size.h) < 1e-9);

  // 4. Толгой хэвтээ голд
  assert.ok(Math.abs(rect.x + rect.w / 2 - (face.x + face.w / 2)) < 1e-9);
});

test('хүрээ зургийн гадна гарвал ТЭМДЭГЛЭНЭ', () => {
  const size = ID_SIZES[0];

  // Хүн зүүн ирмэгт наалдаж зогссон — хүрээ зүүн тийш гарна.
  const edge = cropForFace({ x: 0, y: 200, w: 300, h: 405 }, size, 2000, 3000);
  assert.equal(edge.clamped, true, 'ирмэг рүү гарсныг мэдээгүй');
  assert.ok(edge.rect.x >= 0, 'зургийн гадна үлдсэн');

  // Толгой хэт том — хүрээ зурагнаас өндөр болно.
  const huge = cropForFace({ x: 100, y: 0, w: 900, h: 1200 }, size, 1000, 1000);
  assert.equal(huge.clamped, true);
});

test('хэмжээ бүрт харьцаа зөв', () => {
  const face = { x: 500, y: 300, w: 400, h: 540 };
  for (const size of ID_SIZES) {
    const { rect } = cropForFace(face, size, 4000, 6000);
    assert.ok(
      Math.abs(rect.w / rect.h - size.w / size.h) < 1e-9,
      `${size.label}: ${rect.w}×${rect.h}`,
    );
  }
});

test('доод ирмэгийг биe эзэлсэн ч дэвсгэрийн өнгийг оносон', () => {
  /*
   * Бодит цээж зурагт мөр, бие нь доод ирмэгийг бараг бүтнээр эзэлдэг.
   * Дөрвөн талыг жигд дунджилбал дэвсгэрийн өнгө хүн рүү татагдаж, үерийн
   * дүүргэлт эсрэгээрээ ажиллаж, БҮХ зургийг «дэвсгэр» гэж үзнэ.
   */
  const w = 100;
  const h = 140;
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      // Доод 40% нь бараг бүтэн бие (зөвхөн 5px дэвсгэр хоёр талд).
      const body = y > h * 0.6 && x > 5 && x < w - 5;
      const v = body ? 30 : 250;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const color = borderColor(data, w, h);
  assert.ok(color.r > 200, `дэвсгэр хүн рүү татагдсан: ${color.r}`);

  // Маск зөв гарсан эсэх: бие нь дэвсгэр гэж тооцогдох ёсгүй.
  const mask = backgroundMask(data, w, h, 40);
  const bodyPixel = Math.round(h * 0.8) * w + Math.round(w / 2);
  assert.equal(mask[bodyPixel], 0, 'биеийг дэвсгэр гэж үзсэн');
});
