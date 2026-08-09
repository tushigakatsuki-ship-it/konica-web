import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cropForFace,
  BACKGROUNDS,
  ID_SIZES,
  SHEET,
  applyBackground,
  autoWhiteBalance,
  PURPOSES,
  backgroundMask,
  borderColor,
  cmToPx,
  featherMask,
  fitBackdrop,
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

/* ─────────────────────────────────────────────────────────────────
 * Дэвсгэр салгах загвар
 *
 * Бодит гомдол: «зарим хэсгийг дутуу арилгаж байна». Шалтгаан нь тэвчээр
 * бага байсандаа биш — дэвсгэрийг ГАНЦ тогтмол өнгө гэж үзэж байсанд.
 * Доорх тестүүд гурван бодит тохиолдлыг барина.
 * ───────────────────────────────────────────────────────────────── */

/** Нэг талаас гэрэлтсэн дэвсгэр дээр эллипс «толгой» зурна. */
const makeScene = (opts: {
  w: number;
  h: number;
  /** Зүүнээс баруун тийш дэвсгэрийн гэрлийн уналт. */
  falloff?: number;
  /** Толгойн доторх дэвсгэр өнгөтэй нүх (үсний завсар). */
  pocket?: { x: number; y: number; r: number };
}) => {
  const { w, h, falloff = 0, pocket } = opts;
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h * 0.45;
  const rx = w * 0.28;
  const ry = h * 0.34;

  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const bgv = 250 - Math.round((x / (w - 1)) * falloff);
      const inHead = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
      const inPocket =
        pocket !== undefined && (x - pocket.x) ** 2 + (y - pocket.y) ** 2 <= pocket.r ** 2;

      let v: [number, number, number];
      if (inHead && !inPocket) v = [120, 85, 70];
      else v = [bgv, bgv, bgv];

      data[i] = v[0];
      data[i + 1] = v[1];
      data[i + 2] = v[2];
      data[i + 3] = 255;
    }
  }
  return data;
};

test('нэг талаас гэрэлтсэн дэвсгэрийг бүтнээр арилгана', () => {
  /*
   * Студийн гэрэлтүүлэг нэг талаас тусдаг тул нөгөө тал 50 нэгжээр бараан.
   * Тогтмол өнгөний загвар (дундаж ≈ 225) дээр баруун ирмэг нь 200 болж,
   * зөрүү нь 25·√3 ≈ 43 — тэвчээр 40 дээр ГАРНА. Яг тэр хэсэг «дутуу
   * арилдаг». Хавтгайн загвар үүнийг шингээх ёстой.
   */
  const w = 120;
  const h = 160;
  const data = makeScene({ w, h, falloff: 50 });

  const backdrop = fitBackdrop(data, w, h);
  assert.ok(backdrop.uniform, 'ирмэг жигд гэж танигдаагүй');
  assert.ok(backdrop.spread > 30, `налууг олоогүй: ${backdrop.spread.toFixed(1)}`);

  const mask = backgroundMask(data, w, h, 40);

  // Хамгийн бараан булан — хуучин загвар яг эндээс алддаг байсан.
  for (const [x, y] of [
    [w - 2, h - 2],
    [w - 2, 2],
    [w - 6, Math.round(h / 2)],
  ]) {
    assert.equal(mask[y * w + x], 255, `дэвсгэр дутуу арилсан: (${x}, ${y})`);
  }

  // Толгой хэвээрээ.
  assert.equal(mask[Math.round(h * 0.45) * w + Math.round(w / 2)], 0, 'толгойг идсэн');
});

test('тогтмол өнгөний загвар яг тэр зурагт алддаг — жишээ нь бодит', () => {
  /*
   * Дээрх тест нь зөвхөн шинэ загвар ажиллаж байгааг харуулна. Энэ нь
   * ХУУЧИН загвар үнэхээр алддаг байсныг батална — эс тэгвээс дээрх тест
   * юу ч хамгаалахгүй, зүгээр л ногоон байна.
   */
  const w = 120;
  const h = 160;
  const data = makeScene({ w, h, falloff: 50 });

  const flat = backgroundMask(data, w, h, 40, borderColor(data, w, h), {
    fillPockets: false,
  });

  let missed = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = Math.round(w * 0.8); x < w; x += 1) {
      if (flat[y * w + x] !== 255) missed += 1;
    }
  }
  assert.ok(missed > 100, `тогтмол загвар алдаагүй бол тест утгагүй: ${missed}`);
});

test('нимгэн хаалтаар тусгаарлагдсан завсрыг нөхнө', () => {
  /*
   * Үерийн дүүргэлт зөвхөн зургийн ирмэгээс эхэлдэг тул үсний хооронд
   * ХАРАГДАЖ БУЙ гадна дэвсгэр хөндөгдөхгүй үлддэг. Хэрэглэгчид энэ нь
   * «дутуу арилсан толбо» болж харагдана.
   *
   * Гол шинж нь ХААЛТ НИМГЭН байх — үсний ширхэг. Тиймээс энд толгойн
   * оройноос 3 пикселийн хаалтаар тусгаарлагдсан завсар зурав.
   */
  const w = 240;
  const h = 320;
  const pocket = { x: 120, y: 42, r: 4 };
  const data = makeScene({ w, h, pocket });
  const p = pocket.y * w + pocket.x;

  const without = backgroundMask(data, w, h, 40, undefined, { fillPockets: false });
  assert.equal(without[p], 0, 'завсар анхнаасаа арилсан бол тест утгагүй');

  const filled = backgroundMask(data, w, h, 40);
  assert.equal(filled[p], 255, 'нимгэн хаалттай завсар нөхөгдөөгүй');

  // Толгой өөрөө хэвээрээ.
  assert.equal(filled[Math.round(h * 0.45) * w + Math.round(w / 2)], 0, 'толгойг идсэн');
});

test('нүүрний ГҮНД байгаа цайвар толбыг хөндөхгүй', () => {
  /*
   * Энэ бол өмнөх тестийн ХОС. Нүдний цагаан, цамцны толбо нь завсартай
   * яг адилхан: жижиг, хаалттай, дэвсгэртэй ижил өнгөтэй. Өнгө, хэмжээ
   * хоёроор ялгах БОЛОМЖГҮЙ.
   *
   * Ялгарах шинж нь геометр: завсар нь нимгэн хаалтын цаана, дэвсгэрээс
   * хэдхэн пикселийн зайд. Нүд бол нүүрний гүнд. Хэрэв энэ хамгаалалт
   * алдвал хэвлэсэн зураг дээр хүний нүд цоорно.
   */
  const w = 240;
  const h = 320;
  const deep = { x: 120, y: 140, r: 4 };
  const data = makeScene({ w, h, pocket: deep });
  const p = deep.y * w + deep.x;

  const filled = backgroundMask(data, w, h, 40);
  assert.equal(filled[p], 0, 'нүүрний гүн дэх толбыг дэвсгэр гэж үзсэн');
});

test('ирмэг эмх замбараагүй бол хавтгайд итгэхгүй', () => {
  /*
   * Гэрийн орчинд ирмэг дээр тавилга, хана, хээ орно. Тийм өгөгдөлд
   * хавтгай тааруулбал зураг руу буруу экстраполяци хийж, хүн рүү
   * «дэвсгэр» гэсэн таамаглал тарааж болзошгүй. Тогтмол өнгө рүү буцна.
   */
  const w = 100;
  const h = 100;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const noisy = (x * 37 + y * 91) % 255;
      data[i] = noisy;
      data[i + 1] = 255 - noisy;
      data[i + 2] = (x * 13) % 255;
      data[i + 3] = 255;
    }
  }

  const backdrop = fitBackdrop(data, w, h);
  assert.equal(backdrop.uniform, false, 'эмх замбараагүй ирмэгийг жигд гэж үзсэн');
  assert.ok(backdrop.residual > 24);
});

test('зөөлөн ирмэг хэсэгчилсэн alpha өгнө — үс бүтнээр таслагддаггүй', () => {
  /*
   * Буржгар үс, нимгэн шилний ирмэг нь үнэндээ хагас тунгалаг. Хатуу
   * хоёртын маск нь тэдгээрийг бүтнээр авах эсвэл бүтнээр орхих хоёрын
   * аль нэгийг л хийдэг — хоёулаа муу.
   */
  const w = 60;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      // Цагаанаас бараан руу 60 пикселд жигд шилжинэ.
      const v = Math.round(250 - (x / (w - 1)) * 200);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  const bg = { r: 250, g: 250, b: 250 };
  const mask = backgroundMask(data, w, h, 30, bg, { step: 40, soft: 40 });

  const row = Math.round(h / 2) * w;
  const values = Array.from({ length: w }, (_, x) => mask[row + x]);

  assert.equal(values[0], 255, 'цэвэр дэвсгэр бүрэн арилаагүй');
  assert.equal(values[w - 1], 0, 'бараан тал хөндөгдсөн');
  assert.ok(
    values.some((v) => v > 0 && v < 255),
    'шилжилтийн зурваст хэсэгчилсэн alpha алга',
  );
});

/* ── Цагаан баланс — үүсгэгч БУС засвар ──────────────────────────── */

test('дэвсгэрийг саарал карт болгож өнгөний хазайлтыг арилгана', () => {
  /*
   * Дэвсгэр нь СААРАЛ БАЙХ ЁСТОЙ гэдгийг мэдэж байгаа тул түүнийг гэрэл
   * зургийн «саарал карт» болгон ашиглаж болно. Энэ бол сурах бичгийн
   * цагаан балансын арга — үүсгэгч загвар огт хэрэггүй.
   */
  const w = 20;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8Array(w * h);

  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    // Дэвсгэр нь шар туяатай: цэнхэр суваг дутуу.
    data[i] = 240;
    data[i + 1] = 230;
    data[i + 2] = 190;
    data[i + 3] = 255;
    mask[p] = 255;
  }

  const before = data[2];
  const { gain, applied } = autoWhiteBalance(data, mask);

  assert.equal(applied, true, 'хазайлтыг олоогүй');
  assert.ok(gain[2] > gain[0], 'цэнхэр сувгийг өсгөх ёстой');
  assert.ok(data[2] > before, 'цэнхэр суваг өсөөгүй');
});

test('дэвсгэр хэт бага бол өнгийг ХӨНДӨХГҮЙ', () => {
  /*
   * Маск буруу гарсан үед лавлагаа найдваргүй. Тийм үед засвар хийвэл
   * зургийг сүйтгэнэ — юу ч хийхгүй нь дээр.
   */
  const w = 20;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4).fill(200);
  const mask = new Uint8Array(w * h);
  mask[0] = 255;

  const { applied } = autoWhiteBalance(data, mask);
  assert.equal(applied, false, 'найдваргүй лавлагаагаар засвар хийсэн');
});

test('коэффициент хатуу хязгаартай — зургийг сүйтгэхгүй', () => {
  const w = 20;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  const mask = new Uint8Array(w * h).fill(255);

  for (let p = 0; p < w * h; p += 1) {
    const i = p * 4;
    // Хэт туйлширсан хазайлт — коэффициент 200 гарах ёстой ч хязгаарлагдана.
    data[i] = 250;
    data[i + 1] = 250;
    data[i + 2] = 1;
    data[i + 3] = 255;
  }

  const { gain } = autoWhiteBalance(data, mask, 1.35);
  assert.ok(Math.max(...gain) <= 1.35 + 1e-9, `хязгаар давсан: ${Math.max(...gain)}`);
  assert.ok(Math.min(...gain) >= 1 / 1.35 - 1e-9, `хязгаар давсан: ${Math.min(...gain)}`);
});

test('баримтын горим засварыг хаана', () => {
  const doc = PURPOSES.find((p) => p.key === 'document');
  const general = PURPOSES.find((p) => p.key === 'general');

  assert.ok(doc && general);
  assert.equal(doc.allowRetouch, false, 'баримтад царай өөрчлөх засвар нээлттэй');
  assert.equal(general.allowRetouch, true);
});
