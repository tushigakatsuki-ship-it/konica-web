import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  MAX_ARC,
  MEDAL_DESIGNS,
  ORNAMENT_BAND,
  DEFAULT_ADJUST,
  PHOTO_ZOOM,
  centreSquare,
  designsFor,
  fitFontSize,
  layoutArcText,
  photoCrop,
} from '../src/lib/medal';

/**
 * Медалийн геометр.
 *
 * Нумаар бичих математик нь ЧИМЭЭГҮЙ алддаг: үсэг хагасаар хазайх,
 * жижиг медальд давхцах, урвуу эргэх — аль нь ч алдаа шиддэггүй, зөвхөн
 * хэвлэсний дараа л мэдэгдэнэ.
 */

/** Ижил өргөнтэй тэмдэгтүүд — тооцооллыг шалгахад хялбар. */
const even = (text: string, width: number) => [...text].map(() => width);

/* ── Байрлал ─────────────────────────────────────────────────────── */

test('бичвэр ДЭЭД цэг дээр төвлөрнө', () => {
  /*
   * Медалийн дээд цэг нь canvas-ийн координатаар `-π/2`. Төвлүүлэхээ
   * мартвал бичвэр баруун тийш гулсаж, зүүн тал нь хоосон үлдэнэ.
   */
  const radius = 100;
  const { glyphs, span } = layoutArcText('АБВГД', even('АБВГД', 20), radius);

  assert.equal(glyphs.length, 5);

  // Дундах тэмдэгтийн өнцөг нь яг дээд цэг дээр.
  assert.ok(Math.abs(glyphs[2].angle - -Math.PI / 2) < 1e-9, `төв: ${glyphs[2].angle}`);

  // Эхний ба сүүлийн тэмдэгт дээд цэгээс ТЭНЦҮҮ зайд.
  const left = -Math.PI / 2 - glyphs[0].angle;
  const right = glyphs[4].angle - -Math.PI / 2;
  assert.ok(Math.abs(left - right) < 1e-9, `тэгш бус: ${left} vs ${right}`);

  // Нийт нум = нийт өргөн ÷ радиус.
  assert.ok(Math.abs(span - (5 * 20) / radius) < 1e-9);
});

test('тэмдэгтийн ТӨВ рүү байрлана, эхлэл рүү биш', () => {
  /*
   * Хуримтлагдсан өргөнийг шууд ашиглавал тэмдэгт бүр хагас өргөнөөрөө
   * зүүн тийш хазайна. Нүдээр бага зэрэг эвгүй, гэхдээ хэвлэхэд илт.
   */
  const radius = 50;
  const { glyphs } = layoutArcText('АБ', [10, 30], radius);

  const start = -Math.PI / 2 - 40 / radius / 2;
  assert.ok(Math.abs(glyphs[0].angle - (start + 5 / radius)) < 1e-9, 'эхний тэмдэгт');
  assert.ok(Math.abs(glyphs[1].angle - (start + (10 + 15) / radius)) < 1e-9, 'хоёр дахь');
});

test('өргөн ялгаатай тэмдэгтүүд ТЭНЦҮҮ зай эзлэхгүй', () => {
  /*
   * Ижил өнцгөөр тараах нь хамгийн түгээмэл алдаа: «ЛШ» ба «ІІ» ижил зай
   * эзэлж, үсэг хоорондын зай үсэрнэ.
   */
  const { glyphs } = layoutArcText('АБВ', [10, 40, 10], 100);

  const gapOne = glyphs[1].angle - glyphs[0].angle;
  const gapTwo = glyphs[2].angle - glyphs[1].angle;

  assert.ok(gapOne > 0 && gapTwo > 0, 'дараалал буруу');
  assert.ok(Math.abs(gapOne - gapTwo) < 1e-9, 'тэгш хэмтэй байх ёстой');

  // Өргөн тэмдэгтийн хоёр талын зай нь нарийныхаас ИХ.
  const narrow = layoutArcText('АБВ', [10, 10, 10], 100).glyphs;
  assert.ok(gapOne > narrow[1].angle - narrow[0].angle, 'өргөнийг тооцоогүй');
});

test('РАДИУС өнцгийг тодорхойлно — пиксел шууд өнцөг болохгүй', () => {
  /*
   * Нумын урт = радиус × өнцөг. Радиусыг үл тоомсорловол ижил бичвэр
   * жижиг медальд давхцаж, томд нь хэт тарна.
   */
  const small = layoutArcText('АБВГД', even('АБВГД', 20), 50);
  const large = layoutArcText('АБВГД', even('АБВГД', 20), 200);

  assert.ok(small.span > large.span, 'радиус нөлөөлөөгүй');
  assert.ok(Math.abs(small.span / large.span - 4) < 1e-9, 'урвуу хамаарал буруу');
});

test('тэмдэгт ГАДАГШАА босоо харна', () => {
  /*
   * Эргэлт нь өнцөг дээр `π/2` нэмсэн байх ёстой. Мартвал үсэг хэвтээ
   * хэвээр үлдэж, нумын хоёр үзүүрт хажуугаараа харагдана.
   */
  const { glyphs } = layoutArcText('АБВ', even('АБВ', 20), 100);
  for (const glyph of glyphs) {
    assert.ok(Math.abs(glyph.rotation - (glyph.angle + Math.PI / 2)) < 1e-12);
  }

  // Дээд цэг дээрх тэмдэгт огт эргэхгүй.
  assert.ok(Math.abs(glyphs[1].rotation) < 1e-9, `дээд тэмдэгт эргэсэн: ${glyphs[1].rotation}`);
});

/* ── Хамгаалалт ──────────────────────────────────────────────────── */

test('хоосон бичвэр, утгагүй радиус NaN гаргахгүй', () => {
  for (const layout of [
    layoutArcText('', [], 100),
    layoutArcText('АБВ', even('АБВ', 20), 0),
    layoutArcText('АБВ', even('АБВ', 20), -10),
  ]) {
    assert.deepEqual(layout.glyphs, []);
    assert.equal(layout.span, 0);
    assert.equal(layout.overflow, false);
  }
});

test('өргөн дутуу эсвэл NaN ирсэн ч унахгүй', () => {
  /*
   * `measureText` нь зарим фонт ачаалагдаагүй үед `NaN` буцааж болно.
   * Тэр нь бүх байрлалыг `NaN` болгож, юу ч зурагдахгүй болно.
   */
  const { glyphs, span } = layoutArcText('АБВ', [10, Number.NaN, 10], 100);
  assert.equal(glyphs.length, 3);
  for (const glyph of glyphs) {
    assert.ok(Number.isFinite(glyph.angle), `NaN өнцөг: ${glyph.char}`);
  }
  assert.ok(Number.isFinite(span));
});

test('хэт урт бичвэрийг ТЭМДЭГЛЭНЭ', () => {
  const maxArc = (200 * Math.PI) / 180;
  const short = layoutArcText('АБВ', even('АБВ', 20), 100, maxArc);
  const long = layoutArcText('А'.repeat(40), even('А'.repeat(40), 20), 100, maxArc);

  assert.equal(short.overflow, false);
  assert.equal(long.overflow, true, `нум: ${long.span}`);
});

test('багтахгүй бичвэрт фонт багасна — гэхдээ хязгаартай', () => {
  const maxArc = 3;

  assert.equal(fitFontSize(2, maxArc, 40, 16), 40, 'багтаж байхад багасгасан');
  assert.equal(fitFontSize(6, maxArc, 40, 16), 20, 'хагас нум → хагас фонт');

  // Уншигдахгүй болтол багасгах нь зүйтэй биш — доод хязгаар барина.
  assert.equal(fitFontSize(100, maxArc, 40, 16), 16, 'доод хязгаар алдагдсан');
});

/* ── Голын зураг ─────────────────────────────────────────────────── */

test('зургийг ТӨВӨӨС нь дөрвөлжин тайрна', () => {
  /*
   * Дугуй нүдэнд тэгш бус талтай зургийг сунгаж хийвэл царай гажна.
   */
  const wide = centreSquare(400, 300);
  assert.equal(wide.size, 300);
  assert.equal(wide.sx, 50);
  assert.equal(wide.sy, 0);

  const tall = centreSquare(300, 500);
  assert.equal(tall.size, 300);
  assert.equal(tall.sx, 0);
  assert.equal(tall.sy, 100);

  const square = centreSquare(200, 200);
  assert.deepEqual(square, { sx: 0, sy: 0, size: 200 });
});

/* ── Загварууд ───────────────────────────────────────────────────── */

test('загвар бүрийн геометр утга учиртай', () => {
  assert.ok(MEDAL_DESIGNS.length >= 4, 'загвар хэт цөөн');

  const ids = new Set(MEDAL_DESIGNS.map((d) => d.id));
  assert.equal(ids.size, MEDAL_DESIGNS.length, 'давхардсан id');

  for (const design of MEDAL_DESIGNS) {
    /*
     * Бичвэрийн тойрог нь зургийн тойргоос ГАДНА, ирмэгээс ДОТОГШ байх
     * ёстой. Эсрэгээр бол бичвэр зураг дээр давхцана.
     */
    assert.ok(
      design.photoRadius < design.textRadius,
      `${design.id}: бичвэр зураг дээр давхцана`,
    );
    assert.ok(design.textRadius < 1, `${design.id}: бичвэр ирмэгээс гарна`);
    assert.ok(design.photoRadius > 0.2, `${design.id}: зураг хэт жижиг`);

    // Үнэ каталогоос уншигдана — id нь бодит байх ёстой.
    assert.ok(Number.isInteger(design.serviceId), `${design.id}: serviceId буруу`);
  }
});

test('материалаар шүүнэ, хоёулаа хоосон биш', () => {
  const glass = designsFor('glass');
  const metal = designsFor('metal');

  assert.ok(glass.length > 0, 'шилэн загвар алга');
  assert.ok(metal.length > 0, 'төмөр загвар алга');
  assert.equal(glass.length + metal.length, MEDAL_DESIGNS.length, 'материал дутуу');
  assert.ok(glass.every((d) => d.material === 'glass'));
  assert.ok(metal.every((d) => d.material === 'metal'));
});

test('загварын serviceId каталогт байдаг', async () => {
  const { SERVICES } = await import('../src/data/catalog');
  const ids = new Set(SERVICES.map((s) => s.id));

  for (const design of MEDAL_DESIGNS) {
    assert.ok(ids.has(design.serviceId), `${design.id}: ${design.serviceId} каталогт алга`);
  }
});

/* ── Захиалгын мөр рүү дамжих зам ─────────────────────────────────── */

test('ижил үйлчилгээний ӨӨР тохируулга тусдаа мөр болно', async () => {
  /*
   * ⚠️ Чимээгүй өгөгдөл алдагдахаас хамгаална.
   *
   * `addLine` нь өмнө нь зөвхөн `id`-аар нэгтгэдэг байсан. Медаль нэмсний
   * дараа энэ нь алдаа болно: «алтлаг, ТЭРГҮҮН БАЙР» ба «алтлаг, ДЭД БАЙР»
   * хоёр нь ижил `serviceId`-тай тул нэг мөр болж нийлээд, тайлбаруудын
   * нэг нь алга болно. Хэрэглэгч сагсандаа хоёр зүйл харсан атлаа
   * ажилтанд нэг л очно.
   */
  const { addLine, lineFromService } = await import('../src/lib/order');
  const { SERVICES } = await import('../src/data/catalog');

  const service = SERVICES.find((s) => s.id === MEDAL_DESIGNS[0].serviceId);
  assert.ok(service, 'медалийн үйлчилгээ каталогт алга');

  let lines = addLine([], lineFromService(service, 5, 'Алтлаг · ТЭРГҮҮН БАЙР'));
  lines = addLine(lines, lineFromService(service, 3, 'Алтлаг · ДЭД БАЙР'));

  assert.equal(lines.length, 2, 'өөр тайлбартай мөр нийлсэн');
  assert.equal(lines[0].qty, 5);
  assert.equal(lines[1].qty, 3);

  // ЯГ ижил тайлбартай бол нийлэх ёстой — тоо нь нэмэгдэнэ.
  lines = addLine(lines, lineFromService(service, 2, 'Алтлаг · ТЭРГҮҮН БАЙР'));
  assert.equal(lines.length, 2, 'ижил тайлбартай мөр нийлээгүй');
  assert.equal(lines[0].qty, 7);
});

test('тайлбаргүй мөр нь түлхүүр огт үүсгэхгүй', async () => {
  /*
   * `spec: undefined` гэж бичвэл JSON-д `"spec": null` болж, Firebase-д
   * хоосон түлхүүр үлдэнэ. Байхгүй бол огт байхгүй байх нь зөв.
   */
  const { lineFromService } = await import('../src/lib/order');
  const { SERVICES } = await import('../src/data/catalog');

  const line = lineFromService(SERVICES[0], 1);
  assert.ok(!('spec' in line), 'хоосон түлхүүр үүссэн');

  assert.ok(!('spec' in lineFromService(SERVICES[0], 1, '')), 'хоосон мөр түлхүүр үүсгэсэн');
});

test('сервер тайлбарыг цэвэрлэж, уртыг хязгаарлана', async () => {
  /*
   * Тайлбар нь Telegram-ийн мэдэгдэлд ордог. Хязгааргүй бол мэдэгдэл
   * тасарч, ажилтан захиалгыг харахгүй өнгөрөх эрсдэлтэй.
   */
  const shared = await import('../api/_shared');
  assert.ok(shared.MAX_SPEC > 0 && shared.MAX_SPEC <= 500, 'хязгаар утгагүй');

  const source = readFileSync(
    path.join(process.cwd(), 'api/_shared.ts'),
    'utf8',
  );
  assert.match(source, /clean\(\(raw as IncomingLine\)\.spec, MAX_SPEC\)/, 'цэвэрлээгүй');
  // Мэдэгдэлд заавал орно — эс бөгөөс ажилтан юу хийхээ мэдэхгүй.
  assert.match(source, /l\.spec \?/, 'мэдэгдэлд тайлбар алга');
});

/* ── Голын зургийн тохируулга ─────────────────────────────────────── */

test('томруулахад ТӨВ тогтвортой үлдэнэ', () => {
  /*
   * Байрлалыг `x/y`-аар хадгалбал томруулах бүрд зураг гулсаж, хэрэглэгч
   * дахин дахин байрлуулах шаардлагатай болно. Энэ төсөлд өмнө нь яг тэр
   * алдаа гарсан.
   */
  const w = 400;
  const h = 400;

  for (const zoom of [1, 1.5, 2, 3]) {
    const crop = photoCrop(w, h, { zoom, offsetX: 0, offsetY: 0 });
    assert.equal(crop.sx + crop.size / 2, w / 2, `төв гулссан: zoom ${zoom}`);
    assert.equal(crop.sy + crop.size / 2, h / 2, `төв гулссан: zoom ${zoom}`);
  }
});

test('томруулалт их = эх талбай ЖИЖИГ = зураг том', () => {
  const wide = photoCrop(400, 400, { zoom: 1, offsetX: 0, offsetY: 0 });
  const tight = photoCrop(400, 400, { zoom: 2, offsetX: 0, offsetY: 0 });

  assert.equal(wide.size, 400);
  assert.equal(tight.size, 200, 'хоёр дахин томруулахад талбай хоёр дахин жижгэрнэ');
});

test('шилжилт эх зургаас ГАДНА гарахгүй', () => {
  /*
   * Гарвал дугуй нүдний ирмэгт хоосон зурвас үүсч, хэвлэхэд цагаан зах
   * болно. Хэрэглэгч зөвхөн бэлэн медалиа хараад л мэднэ.
   */
  const w = 600;
  const h = 400;

  for (const offsetX of [-2, -1, 0, 1, 2]) {
    for (const offsetY of [-2, -1, 0, 1, 2]) {
      for (const zoom of [1, 2, 3]) {
        const crop = photoCrop(w, h, { zoom, offsetX, offsetY });
        assert.ok(crop.sx >= 0, `зүүн гарсан: ${crop.sx}`);
        assert.ok(crop.sy >= 0, `дээш гарсан: ${crop.sy}`);
        assert.ok(crop.sx + crop.size <= w, `баруун гарсан: ${crop.sx + crop.size}`);
        assert.ok(crop.sy + crop.size <= h, `доош гарсан: ${crop.sy + crop.size}`);
      }
    }
  }
});

test('тэгш бус талтай зураг zoom=1 дээр ч гүйлгэгдэнэ', () => {
  /*
   * Өргөн зурагт хажуу тал нь тайрагдана. Хэрэглэгч аль хэсгийг үлдээхээ
   * сонгох ёстой — тэр нь томруулахгүйгээр ч хэрэгтэй.
   */
  const left = photoCrop(600, 400, { zoom: 1, offsetX: -1, offsetY: 0 });
  const right = photoCrop(600, 400, { zoom: 1, offsetX: 1, offsetY: 0 });

  assert.equal(left.sx, 0, 'зүүн ирмэг рүү хүрээгүй');
  assert.equal(right.sx, 200, 'баруун ирмэг рүү хүрээгүй');
  assert.equal(left.size, 400);

  // Дөрвөлжин зурагт хэвтээ гүйлгэх зай БАЙХГҮЙ — шилжилт нөлөөлөхгүй.
  const square = photoCrop(400, 400, { zoom: 1, offsetX: 1, offsetY: 0 });
  assert.equal(square.sx, 0, 'байхгүй зай руу гүйлгэсэн');
});

test('утгагүй оролт NaN эсвэл сөрөг хэмжээ гаргахгүй', () => {
  for (const crop of [
    photoCrop(0, 100),
    photoCrop(100, 0),
    photoCrop(-100, 100),
    photoCrop(400, 400, { zoom: Number.NaN, offsetX: Number.NaN, offsetY: 0 }),
    photoCrop(400, 400, { zoom: 0, offsetX: 0, offsetY: 0 }),
  ]) {
    assert.ok(Number.isFinite(crop.sx) && crop.sx >= 0, `sx: ${crop.sx}`);
    assert.ok(Number.isFinite(crop.sy) && crop.sy >= 0, `sy: ${crop.sy}`);
    assert.ok(Number.isFinite(crop.size) && crop.size >= 0, `size: ${crop.size}`);
  }
});

test('томруулалтын хязгаар утга учиртай', () => {
  assert.equal(PHOTO_ZOOM.min, 1, 'нэгээс бага бол дугуйд хоосон зай гарна');
  assert.ok(PHOTO_ZOOM.max > 1 && PHOTO_ZOOM.max <= 4, 'хэт их томруулбал пиксел гарна');

  // Хязгаараас гадуур утгыг ТАСЛАНА, алдаа шидэхгүй.
  const tooFar = photoCrop(400, 400, { zoom: 99, offsetX: 0, offsetY: 0 });
  assert.equal(tooFar.size, 400 / PHOTO_ZOOM.max);
});

test('centreSquare нь тохируулгагүй photoCrop-той ИЖИЛ', () => {
  for (const [w, h] of [
    [400, 300],
    [300, 500],
    [200, 200],
  ]) {
    assert.deepEqual(centreSquare(w, h), photoCrop(w, h, DEFAULT_ADJUST));
  }
});

/* ── Голын зургийг тохируулах ────────────────────────────────────── */

test('чирэхэд зураг ЧИРСЭН ЧИГЛЭЛД явна', async () => {
  /*
   * `photoCrop` нь `offsetX` ихсэхэд эх зургийн БАРУУН талаас түүвэрлэдэг
   * тул харагдах агуулга ЗҮҮН тийш гүйнэ. Тэмдгийг урвуулахаа мартвал
   * зураг чирсний эсрэг тийш явж, хэрэглэгч тэр даруй эвгүй мэдэрнэ.
   */
  const { panBy, photoCrop } = await import('../src/lib/medal');

  const start = { zoom: 1.5, offsetX: 0, offsetY: 0 };
  const dragged = panBy(600, 600, start, 200, 40, 0);

  assert.ok(dragged.offsetX < 0, `чиглэл урвуу: ${dragged.offsetX}`);

  // Эх зургаас БАГА `sx` = зүүн тал руу = зураг баруун тийш харагдана.
  assert.ok(
    photoCrop(600, 600, dragged).sx < photoCrop(600, 600, start).sx,
    'зураг чирсэн тийшээ яваагүй',
  );
});

test('шилжих зайгүй үед ТЭГД ХУВААХГҮЙ', async () => {
  /*
   * ⚠️ Дөрвөлжин зураг `zoom = 1` дээр огт шилжих зайгүй (`room = 0`).
   * Хуваавал `Infinity` гарч, бүх байрлал `NaN` болж, медаль огт
   * зурагдахаа болино — алдаа шидэхгүй, зүгээр л хоосон дугуй үлдэнэ.
   */
  const { panBy } = await import('../src/lib/medal');

  const flat = panBy(400, 400, { zoom: 1, offsetX: 0, offsetY: 0 }, 200, 50, 50);
  assert.ok(Number.isFinite(flat.offsetX), `offsetX: ${flat.offsetX}`);
  assert.ok(Number.isFinite(flat.offsetY), `offsetY: ${flat.offsetY}`);
  assert.equal(flat.offsetX, 0, 'зайгүй атал шилжсэн');
  assert.equal(flat.offsetY, 0);
});

test('тэгш бус зураг УРТ талаараа шилжинэ', async () => {
  /*
   * Өргөн зураг нь `zoom = 1` дээр ч хэвтээгээр гүйх зайтай — богино
   * талаараа дөрвөлжин болсон тул. Босоо чиглэлд зай байхгүй.
   */
  const { panBy } = await import('../src/lib/medal');

  const moved = panBy(800, 400, { zoom: 1, offsetX: 0, offsetY: 0 }, 200, 30, 30);
  assert.ok(moved.offsetX !== 0, 'хэвтээ шилжилт ажиллаагүй');
  assert.equal(moved.offsetY, 0, 'босоо зайгүй атал шилжсэн');
});

test('шилжилт −1…1 хооронд БАРИГДАНА', async () => {
  /*
   * Хязгаараас гарвал дугуй нүдний ирмэгт хоосон зурвас үүсч, хэвлэхэд
   * цагаан зах болно.
   */
  const { panBy, photoCrop } = await import('../src/lib/medal');

  let adjust = { zoom: 2, offsetX: 0, offsetY: 0 };
  for (let i = 0; i < 50; i += 1) adjust = panBy(600, 600, adjust, 200, -100, -100);

  assert.ok(adjust.offsetX <= 1 && adjust.offsetY <= 1, 'хязгаар давсан');

  // Тайралт нь эх зургийн ГАДНА гарах ёсгүй.
  const crop = photoCrop(600, 600, adjust);
  assert.ok(crop.sx >= -1e-9 && crop.sx + crop.size <= 600 + 1e-9, `sx: ${crop.sx}`);
  assert.ok(crop.sy >= -1e-9 && crop.sy + crop.size <= 600 + 1e-9, `sy: ${crop.sy}`);
});

test('утгагүй оролтод хөдөлгөөнгүй', async () => {
  const { panBy } = await import('../src/lib/medal');
  const start = { zoom: 1.5, offsetX: 0.2, offsetY: -0.3 };

  assert.deepEqual(panBy(600, 600, start, 0, 10, 10), start, 'нүд 0 өргөнтэй');
  assert.deepEqual(panBy(600, 600, start, 200, Number.NaN, 10), start, 'NaN dx');
  assert.deepEqual(panBy(0, 0, start, 200, 10, 10), start, 'зураг хэмжээгүй');
});

test('чирэлтийн хурд НҮДНИЙ хэмжээнээс хамаарна', async () => {
  /*
   * Ижил чирэлт нь жижиг урьдчилсан харагдац дээр ИЛҮҮ их шилжилт
   * үүсгэх ёстой — тэнд нэг дэлгэцийн пиксел илүү олон эх пикселд
   * харгалзана. Хэмжээг үл тоомсорловол жижиг дээр хэт удаан болно.
   */
  const { panBy } = await import('../src/lib/medal');
  const start = { zoom: 2, offsetX: 0, offsetY: 0 };

  const small = panBy(600, 600, start, 100, 20, 0);
  const large = panBy(600, 600, start, 400, 20, 0);

  assert.ok(Math.abs(small.offsetX) > Math.abs(large.offsetX), 'хэмжээг тооцоогүй');
});

test('интерфейс тохируулгыг ХОЛБОСОН', async () => {
  /*
   * Цөм нь бүрэн байсан ч `MedalPreview` нь `centreSquare`-ийг дууддаг
   * байсан тул хэрэглэгчийн тохируулга огт нөлөөлдөггүй байв — гулсуур
   * хөдөлж байгаа атлаа зураг хөдлөхгүй.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );
  assert.match(preview, /photoCrop\(photo\.width, photo\.height, adjust\)/, 'тохируулга хэрэгсээгүй');

  const page = readFileSync(path.join(process.cwd(), 'src/pages/Medal.tsx'), 'utf8');
  assert.ok(page.includes('panBy('), 'чирэлт холбогдоогүй');
  assert.match(page, /type="range"[\s\S]{0,200}PHOTO_ZOOM\.min/, 'томруулах гулсуур алга');
  // Шинэ зурагт хуучин тохируулга үлдэх ёсгүй.
  assert.match(page, /setFileName\(file\.name\);[\s\S]{0,400}setAdjust\(DEFAULT_ADJUST\)/, 'тохируулга тэглэгдэхгүй');
});

/* ── Хэлбэр ба доод нум ──────────────────────────────────────────── */

test('зургаан талтын ОРОЙ нь дээшээ харна', async () => {
  /*
   * Хажуу талаараа эхлүүлбэл медаль хэвтээ болж, дээд хавчаар нь оройд
   * биш талын ДУНД суух тул бодит бүтээгдэхүүнтэй таарахгүй.
   */
  const { shapePoints } = await import('../src/lib/medal');

  const points = shapePoints('hexagon', 100, 100, 50);
  assert.equal(points.length, 6, 'зургаан талт биш');

  // Эхний орой нь яг дээд цэг дээр.
  assert.ok(Math.abs(points[0].x - 100) < 1e-9, `x: ${points[0].x}`);
  assert.ok(Math.abs(points[0].y - 50) < 1e-9, `y: ${points[0].y}`);

  // Бүх орой нь радиусын зайд.
  for (const p of points) {
    const d = Math.hypot(p.x - 100, p.y - 100);
    assert.ok(Math.abs(d - 50) < 1e-9, `радиус зөрсөн: ${d}`);
  }
});

test('дугуй нь цэггүй — дуудагч arc() ашиглана', async () => {
  const { shapePoints } = await import('../src/lib/medal');
  assert.deepEqual(shapePoints('circle', 100, 100, 50), []);
  assert.deepEqual(shapePoints('hexagon', 100, 100, 0), [], 'радиус 0 дээр цэг гаргасан');
});

test('preview нь ХЭЛБЭРийг дагадаг', () => {
  /*
   * ⚠️ Хэлбэрийг үл тоомсорловол `shape: 'hexagon'` загвар нь ЧИМЭЭГҮЙ
   * дугуй болж зурагдана: алдаа гарахгүй, зөвхөн буруу бүтээгдэхүүн
   * харагдана. Каталогт зургаан талт загвар бий.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );
  assert.ok(preview.includes('shapePoints'), 'хэлбэрийг үл тоомсорлов');
  assert.match(preview, /tracePath\(ctx, design\.shape/, 'ирмэг хэлбэрийг дагаагүй');

  const designs = MEDAL_DESIGNS.filter((d) => d.shape === 'hexagon');
  assert.ok(designs.length > 0, 'зургаан талт загвар каталогт алга');
});

test('доод нумын бичвэр зурагддаг', () => {
  /*
   * Цөм нь `ArcSide: 'bottom'`-ыг дэмждэг байсан ч preview нь зөвхөн
   * дээд нумыг зурдаг байв — бодит медальд он нь доор бичигддэг.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );
  assert.match(preview, /drawArc\(subText, 'bottom'\)/, 'доод нум зурагдахгүй');
  assert.match(preview, /drawArc\(text, 'top'\)/, 'дээд нум зурагдахгүй');

  const page = readFileSync(path.join(process.cwd(), 'src/pages/Medal.tsx'), 'utf8');
  assert.ok(page.includes('setSubText'), 'доод бичвэрийн талбар алга');
  assert.match(page, /Доор: \$\{subText\.trim\(\)\}/, 'тайлбарт доод бичвэр алга');
});

test('доод нумын үсэг УНШИГДАХААР зурагдана', () => {
  /*
   * ⚠️ Эхний тест «эргэлтийн зөрүү нь π байх ёстой» гэж шалгасан нь
   * БУРУУ байв. Доод нумын дунд үсэг нь ДЭЭШЭЭ харах ёстой — бодит
   * медаль дээр он нь доор, босоогоороо бичигддэг. Хэрэгжүүлэлт нь
   * 2π буцаадаг бөгөөд тэр нь 0-тэй тэнцүү, өөрөөр хэлбэл зөв.
   *
   * Тиймээс өнцгийн ТООГ биш, ХАРАГДАХ үр дүнг шалгана.
   */
  const widths = [20, 20, 20];
  const top = layoutArcText('АБВ', widths, 100, undefined, 'top');
  const bottom = layoutArcText('АБВ', widths, 100, undefined, 'bottom');

  /** Эргэлтийг 0…2π болгож хэвийчилнэ — 2π ба 0 нь ижил үр дүн. */
  const upright = (r: number) => {
    const x = ((r % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return Math.min(x, 2 * Math.PI - x);
  };

  assert.ok(upright(top.glyphs[1].rotation) < 1e-6, 'дээд дунд үсэг хазайсан');
  assert.ok(upright(bottom.glyphs[1].rotation) < 1e-6, 'доод дунд үсэг урвуу');

  /*
   * Доод нумд өнцөг нь ЭСРЭГ чиглэлд явна — тэгснээр бичвэр дэлгэц дээр
   * зүүнээс баруун тийш уншигдана. Дээдтэй ижил чиглэлтэй бол доод
   * бичвэр урвуу дарааллаар гарна.
   */
  assert.ok(top.glyphs[2].angle > top.glyphs[0].angle, 'дээд дараалал буруу');
  assert.ok(bottom.glyphs[2].angle < bottom.glyphs[0].angle, 'доод дараалал эргээгүй');

  // Доод бичвэр нь тойргийн ДООД хэсэгт байрлана.
  for (const glyph of bottom.glyphs) {
    assert.ok(Math.sin(glyph.angle) > 0, `доод нумаас гарсан: ${glyph.char}`);
  }
});

/* ── Материал ба хэлбэр ─────────────────────────────────────────── */

test('төмөр медаль бүр ЗУРГААН ӨНЦӨГТ', () => {
  /*
   * ⚠️ Хэлбэр бол гоо сайхны сонголт биш, ҮЙЛДВЭРЛЭЛИЙН боломж:
   * дэлгүүр цутгамал хэлбэрийг зөвхөн төмрөөр гаргадаг. Дугуй төмөр
   * загвар каталогт үлдвэл захиалагч байхгүй бүтээгдэхүүн сонгоод,
   * ажилтан залгаж буцаана.
   */
  const metal = designsFor('metal');
  assert.ok(metal.length > 0, 'төмөр загвар алга');

  for (const design of metal) {
    assert.equal(design.shape, 'hexagon', `${design.id}: төмөр атлаа дугуй`);
  }
});

test('шилэн медаль бүр ДУГУЙ', () => {
  // Шилийг дугуйгаар зүсдэг — олон өнцөгт шил үйлдвэрлэхгүй.
  const glass = designsFor('glass');
  assert.ok(glass.length > 0, 'шилэн загвар алга');

  for (const design of glass) {
    assert.equal(design.shape, 'circle', `${design.id}: шил атлаа олон өнцөгт`);
  }
});

test('загварын талбар бүрийг preview УНШДАГ', () => {
  /*
   * ⚠️ Хамгийн чимээгүй алдаа: `MedalDesign`-д талбар нэмчихээд зурах
   * кодод холбохоо мартах. Тохиргоо нь байгаа мэт харагдана, тестүүд нь
   * өнгөрнө, гэвч дэлгэц дээр юу ч өөрчлөгдөхгүй. `hanger` яг ингэж
   * хэдэн хувилбарын турш үхмэл байсан.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );

  for (const field of ['shape', 'hanger', 'rim', 'face', 'ink', 'subInk']) {
    assert.ok(preview.includes(`design.${field}`), `design.${field} хэзээ ч уншигдахгүй`);
  }
});

test('MedalDesign-д ҮХМЭЛ талбар байхгүй', () => {
  /*
   * Дээрх тестийн нөгөө тал: жагсаалтад нэмэхээ мартсан талбарыг барина.
   * Хоёулангүйгээр `ornament` шиг тохиргоо дахин чимээгүй үхнэ.
   */
  const source = readFileSync(path.join(process.cwd(), 'src/lib/medal.ts'), 'utf8');
  const body = source.slice(
    source.indexOf('export interface MedalDesign'),
    source.indexOf('export const MEDAL_DESIGNS'),
  );
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );

  /*
   * Зурагдах шинж БИШ талбарууд — жагсаалт, үнэ. Эдгээр нь зурах кодод
   * гарахгүй, гэхдээ ХААНА Ч ашиглагдахгүй байж ч болохгүй.
   */
  const meta = new Set(['id', 'material', 'label', 'serviceId', 'bulk']);
  const everywhere = ['src/lib/medal.ts', 'src/pages/Medal.tsx', 'src/components/MedalPreview.tsx']
    .map((f) => readFileSync(path.join(process.cwd(), f), 'utf8'))
    .join('\n') + preview;

  for (const [, name] of body.matchAll(/^ {2}(\w+)\??:/gm)) {
    if (meta.has(name)) {
      assert.ok(
        new RegExp(`\\.${name}\\b`).test(everywhere),
        `${name} хаана ч ашиглагдахгүй үхмэл талбар`,
      );
      continue;
    }
    assert.ok(preview.includes(`design.${name}`), `${name} зурагдахгүй үхмэл талбар`);
  }
});

test('голын зурагт ХҮРЭЭ зурахгүй', () => {
  /*
   * Шилэн медальд зураг нь шууд хэвлэгддэг — цагираг шугам байхгүй.
   * Урьдчилсан харагдац дээр нэмвэл захиалагч «ийм шугамтай гарна» гэж
   * ойлгоод, бодит бүтээгдэхүүнээ хүлээж авахгүй.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );
  /*
   * ⚠️ Бүх `stroke()`-ийг хориглох нь ХЭТ ӨРГӨН: хээ нь мөн зураасаар
   * зурагддаг. Зөвхөн ГОЛЫН ЗУРГИЙН хэсгийг шалгана.
   */
  const section = preview.slice(
    preview.indexOf('── 2. Голын зураг'),
    preview.indexOf('── 3. Нумаар бичих'),
  );
  assert.ok(section.length > 0, 'голын зургийн хэсэг олдсонгүй');
  assert.ok(!section.includes('stroke'), 'зураг дээр хүрээ эргэж орж ирсэн');
});

test('голын зураг ба нумын хооронд ОНы зай үлдэнэ', () => {
  /*
   * Хоёр талын шаардлага зөрчилддөг: зураг том байх тусам сайн, гэвч
   * зураг ба доод нумын хооронд он хэвтээгээр багтах ёстой. Зөрүү нь
   * ~0.25 радиусаас багасвал он уншигдахааргүй жижгэрнэ.
   */
  for (const design of MEDAL_DESIGNS) {
    assert.ok(design.photoRadius >= 0.4, `${design.id}: голын зураг хэт жижиг`);
    assert.ok(
      design.textRadius - design.photoRadius >= 0.25,
      `${design.id}: он багтах зай алга`,
    );
  }
});

test('шилэн загварт он УЛААН — нумын бичээсээс ялгаатай', () => {
  /*
   * Бодит бүтээгдэхүүн дээр он нь улаан, нумын бичээс нь хөх. Нэг өнгөөр
   * зурвал урьдчилсан харагдац нь гартаа авах юмтай таарахгүй.
   */
  for (const design of designsFor('glass')) {
    assert.ok(design.subInk, `${design.id}: оны өнгө алга`);
    assert.notEqual(design.subInk, design.ink, `${design.id}: он бичээстэй ижил өнгөтэй`);
  }
});

test('хээ нь бичвэрийн нумаас ГАДНА, ирмэгээс ДОТОГШ', () => {
  /*
   * Хээ нь бичвэрийн нум дээр давхарвал үсэг уншигдахаа болино — хоёулаа
   * зурагдсан тул алдаа гарахгүй, зөвхөн эцсийн бүтээгдэхүүн муу болно.
   */
  assert.ok(ORNAMENT_BAND.inner < ORNAMENT_BAND.outer, 'тууз урвуу');
  assert.ok(ORNAMENT_BAND.outer < 1, 'тууз ирмэгээс гарна');

  for (const design of MEDAL_DESIGNS) {
    if (!design.ornament) continue;
    assert.ok(
      design.textRadius < ORNAMENT_BAND.inner,
      `${design.id}: бичвэр хээн дээр гарна`,
    );
  }
});

test('хээ нь зөвхөн ДУГУЙ хэлбэрт асна', () => {
  // Тойрог хээ нь олон өнцөгтийн өнцөг дээр ирмэгээс гарч таслагдана.
  for (const design of MEDAL_DESIGNS) {
    if (design.shape === 'circle') continue;
    assert.equal(design.ornament, undefined, `${design.id}: олон өнцөгтөд хээ асаалттай`);
  }
});

test('хээний өнгө нь ирмэгийн өнгөнөөс ТУСДАА', () => {
  /*
   * Өмнө нь хээг `rim`-ийн өнгөөр зурдаг байв. Шилний зүсмэл ирмэг нь
   * цайвар саарал, хээ нь тод хөх — нэг утгаар хоёуланг удирдвал аль
   * нэг нь заавал буруу гарна.
   */
  for (const design of MEDAL_DESIGNS) {
    if (!design.ornament) continue;
    assert.notEqual(design.ornament, design.rim, `${design.id}: хээ ирмэгтэй ижил өнгөтэй`);
  }
});

test('доод нум нь дээдээсээ ӨРГӨН', () => {
  /*
   * Байгууллагын бүтэн нэр доод нумаар явдаг (~276°). Хоёуланг ижил
   * хязгаараар барьвал урт нэр шаардлагагүй жижгэрч уншигдахаа болино.
   */
  assert.ok(MAX_ARC.bottom > MAX_ARC.top, 'доод нум өргөсгөөгүй');
  // Бүтэн тойрог болвол эхлэл, төгсгөл нь давхцаж, үсэг дээр үсэг бичигдэнэ.
  assert.ok(MAX_ARC.bottom < Math.PI * 2, 'доод нум бүтэн тойргоос хэтэрсэн');
  assert.ok(MAX_ARC.top > 0, 'дээд нум хоосон');
});

test('он нь НУМААР биш, ХЭВТЭЭ зурагдана', () => {
  /*
   * Бодит медальд он нь зургийн доор шулуун бичигддэг. Нумаар бичвэл
   * гурав дахь тойрог үүсч, медаль бөглүү харагдана.
   */
  const preview = readFileSync(
    path.join(process.cwd(), 'src/lib/medalDraw.ts'),
    'utf8',
  );
  assert.match(preview, /fillText\(cleanYear/, 'он зурагддаггүй');
  assert.ok(!/drawArc\(year/.test(preview), 'он нумаар бичигдэж байна');

  const page = readFileSync(path.join(process.cwd(), 'src/pages/Medal.tsx'), 'utf8');
  assert.ok(page.includes('setYear'), 'оны талбар алга');
  assert.match(page, /Он: \$\{year\.trim\(\)\}/, 'тайлбарт он алга');
});

/* ── Зураглалыг БОДИТООР ажиллуулж шалгах ────────────────────────── */

/**
 * Хамгийн бага canvas хуурамчлагч — дуудлагын дарааллыг тэмдэглэнэ.
 *
 * ⚠️ Эх бичвэр уншдаг тестүүд нь `drawMedal` дотор юу БИЧСЭНийг л
 * шалгадаг. Функц нь эрт `return` хийвэл, эсвэл нөхцөл нь худал болвол
 * тэд бүгд өнгөрсөн хэвээр байна. Энэ нь функцийг ҮНЭХЭЭР дуудна.
 */
const recorder = () => {
  const calls: string[] = [];
  const ctx = new Proxy(
    {
      measureText: (t: string) => ({ width: t.length * 8 }),
      canvas: { width: 0, height: 0 },
    } as Record<string, unknown>,
    {
      get(target, prop: string) {
        if (prop in target) return target[prop];
        // Өнгө, фонт зэрэг утгыг шингээнэ; бусад бүхнийг функц болгоно.
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map(String).join(',')})`);
        };
      },
      set(_t, prop: string, value) {
        calls.push(`${prop}=${String(value)}`);
        return true;
      },
    },
  );
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
};

test('drawMedal нь зургийг бичвэрийн ӨМНӨ зурна', async () => {
  /*
   * Дараалал буруу бол зураг нь нумын бичвэрийг халхална — canvas дээр
   * сүүлд зурсан нь дээр гарна.
   */
  const { drawMedal } = await import('../src/lib/medalDraw');
  const { ctx, calls } = recorder();
  const design = MEDAL_DESIGNS.find((d) => d.id === 'glass-clear');
  assert.ok(design);

  drawMedal(ctx, {
    design,
    photo: { width: 800, height: 600 } as never,
    size: 320,
    text: 'ТЭРГҮҮН',
    subText: 'СУРГУУЛЬ',
    year: '2026',
  });

  const image = calls.findIndex((c) => c.startsWith('drawImage('));
  const glyph = calls.findIndex((c) => c.startsWith('fillText('));
  assert.ok(image >= 0, 'голын зураг огт зураагүй');
  assert.ok(glyph >= 0, 'бичвэр огт зураагүй');
  assert.ok(image < glyph, 'зураг бичвэрийг халхална');
});

test('drawMedal нь ОНыг нэг удаа, УЛААНААР зурна', async () => {
  const { drawMedal } = await import('../src/lib/medalDraw');
  const design = MEDAL_DESIGNS.find((d) => d.id === 'glass-clear');
  assert.ok(design?.subInk);

  const { ctx, calls } = recorder();
  drawMedal(ctx, { design, photo: null, size: 320, subText: 'СУРГУУЛЬ', year: '2026' });

  const years = calls.filter((c) => c.startsWith('fillText(2026,'));
  assert.equal(years.length, 1, 'он нэг удаа зурагдах ёстой');

  // Оныг зурахын өмнөх сүүлчийн өнгө нь `subInk` байх ёстой.
  const at = calls.indexOf(years[0]);
  const colour = calls
    .slice(0, at)
    .reverse()
    .find((c) => c.startsWith('fillStyle='));
  assert.equal(colour, `fillStyle=${design.subInk}`, 'он улаанаар зурагдаагүй');
});

test('зурагГҮЙ, бичвэрГҮЙ үед ч унахгүй', async () => {
  /*
   * Хуудас нээгдмэгц загварын сонголтын карт нь ХООСОН медаль зурдаг.
   * Энд унавал бүх хуудас цагаан болно.
   */
  const { drawMedal } = await import('../src/lib/medalDraw');

  for (const design of MEDAL_DESIGNS) {
    const { ctx, calls } = recorder();
    assert.doesNotThrow(() => drawMedal(ctx, { design, photo: null, size: 64 }));
    assert.ok(calls.length > 0, `${design.id}: юу ч зураагүй`);
  }

  // Утгагүй хэмжээ — 0 талтай canvas дээр юу ч зурахгүй, алдаа ч шидэхгүй.
  const { ctx, calls } = recorder();
  drawMedal(ctx, { design: MEDAL_DESIGNS[0], photo: null, size: 0 });
  assert.equal(calls.length, 0, '0 хэмжээтэй атлаа зурсан');
});

test('MedalPreview нь зураглалыг drawMedal-д ДААТГАНА', async () => {
  /*
   * Зураглалын тестүүд `medalDraw.ts`-ийг шалгадаг. Компонент нь түүнийг
   * дуудахаа болих юм бол тэд бүгд өнгөрсөн хэвээр, дэлгэц хоосон болно.
   */
  const component = readFileSync(
    path.join(process.cwd(), 'src/components/MedalPreview.tsx'),
    'utf8',
  );
  assert.match(component, /drawMedal\(ctx, \{/, 'компонент зураглалыг дуудахгүй');
  assert.ok(!component.includes('ctx.arc('), 'зураглал компонент руу буцаж орсон');
});

/* ── Ирмэгийн зай ────────────────────────────────────────────────── */

test('innerEdge нь хэлбэрийн ХАМГИЙН ОЙРХОН ирмэгийг өгнө', async () => {
  const { innerEdge } = await import('../src/lib/medal');

  assert.equal(innerEdge('circle'), 1, 'дугуйд ирмэг хаа сайгүй ижил зайд');
  // Зургаан өнцөгтийн талын дунд нь оройноосоо 13.4% ойрхон.
  assert.ok(Math.abs(innerEdge('hexagon') - Math.cos(Math.PI / 6)) < 1e-9);
  assert.ok(innerEdge('hexagon') < 1, 'олон өнцөгт дугуйгаас өргөн гарлаа');
});

test('нум ба хээ нь НҮҮРНИЙ дотор багтана', async () => {
  const { innerEdge } = await import('../src/lib/medal');

  for (const design of MEDAL_DESIGNS) {
    const edge = design.faceRadius * innerEdge(design.shape);

    assert.ok(
      design.textRadius < edge,
      `${design.id}: нум ирмэгээс гарна (${design.textRadius} ≥ ${edge.toFixed(3)})`,
    );

    if (!design.ornament) continue;
    assert.ok(
      ORNAMENT_BAND.outer < design.faceRadius,
      `${design.id}: хээ нүүрнээс гарна`,
    );
    assert.ok(design.textRadius < ORNAMENT_BAND.inner, `${design.id}: нум хээн дээр гарна`);
  }
});

test('ҮСЭГ ирмэг, хээн дээр гарахгүй — зурсан байрлалаар', async () => {
  /*
   * ⚠️ Радиусын харьцуулалт хангалтгүй.
   *
   * `textRadius` бол үсгийн ТӨВ. Нум нь ирмэгээс дотогш байсан ч ТОМ
   * фонт сонгогдвол үсгийн дээд тал ирмэгээс гарна. Зургаан өнцөгт
   * төмөр медаль яг ингэж эвдэрсэн байв: тоонууд зөв, харагдац буруу.
   *
   * Тиймээс `drawMedal`-ыг ажиллуулж, зурсан үсэг БҮРийн байрлалыг
   * шалгана.
   */
  const { drawMedal } = await import('../src/lib/medalDraw');
  const { innerEdge, CAP_HALF } = await import('../src/lib/medal');

  const size = 420;
  const centre = size / 2;
  const radius = size / 2 - size * 0.06;

  for (const design of MEDAL_DESIGNS) {
    const { ctx, calls } = recorder();
    drawMedal(ctx, {
      design,
      photo: null,
      size,
      text: 'ТЭРГҮҮН БАЙР',
      subText: 'ЕРӨНХИЙ БОЛОВСРОЛЫН СУРГУУЛИЙН САГСАН БӨМБӨГИЙН АШТ',
      year: '2023',
    });

    const barrier =
      radius *
      Math.min(
        design.ornament ? ORNAMENT_BAND.inner : Infinity,
        design.faceRadius * innerEdge(design.shape),
      );

    let font = 0;
    let last: [number, number] | null = null;
    let checked = 0;

    for (const call of calls) {
      const size_ = /^font=\d+ (\d+(?:\.\d+)?)px/.exec(call);
      if (size_) font = Number(size_[1]);

      const move = /^translate\(([-\d.]+),([-\d.]+)\)$/.exec(call);
      if (move) last = [Number(move[1]), Number(move[2])];

      if (!call.startsWith('fillText(') || !last) continue;

      const dist = Math.hypot(last[0] - centre, last[1] - centre);
      // Он нь хэвтээ бичигддэг тул нумын шалгалтад хамаарахгүй.
      if (dist < radius * design.photoRadius) continue;

      checked += 1;
      assert.ok(
        dist + font * CAP_HALF <= barrier,
        `${design.id}: үсэг ирмэгээс гарлаа (${(dist + font * CAP_HALF).toFixed(1)} > ${barrier.toFixed(1)})`,
      );
    }

    assert.ok(checked > 0, `${design.id}: нумын үсэг огт зураагүй`);
  }
});

/* ── Захиалга хүртэлх зам ─────────────────────────────────────────── */

test('ЗУРАГГҮЙ медаль захиалагдана', async () => {
  /*
   * ⚠️ Хамгийн үнэтэй алдаа: медалийн захиалга илгээгдэхгүй байв.
   *
   * `Order.tsx` нь илгээхийн өмнө «зураггүй мөр байна уу» гэж БҮХ мөрөөр
   * шалгадаг байв. Медалийн голын зураг нь сонголтоор бөгөөд `Medal.tsx`
   * нь `file: null` илгээдэг — үр дүнд нь хэрэглэгч бүгдийг бөглөөд
   * «Зураггүй мөр байна» гэсэн мессежтэй тулгарч, засах арга ч байхгүй
   * байлаа. Бүх медалийн захиалга 100% зогсож байсан.
   */
  const { needsPhoto, PHOTO_OPTIONAL } = await import('../src/lib/order');
  const { SERVICES } = await import('../src/data/catalog');

  const medal = SERVICES.find((s) => s.category === 'Медаль & Цом');
  assert.ok(medal, 'медалийн үйлчилгээ алга');
  assert.equal(needsPhoto(medal), false, 'медальд зураг заавал шаардаж байна');

  const wash = SERVICES.find((s) => s.category === 'Угаалт');
  assert.ok(wash, 'угаалтын үйлчилгээ алга');
  assert.equal(needsPhoto(wash), true, 'зураг угаахад зураг шаардахаа больжээ');

  // Медаль нь жагсаалтад заавал байх ёстой — эс бөгөөс дээрх алдаа эргэж ирнэ.
  assert.ok(PHOTO_OPTIONAL.includes('Медаль & Цом'));

  const page = readFileSync(path.join(process.cwd(), 'src/pages/Order.tsx'), 'utf8');
  assert.match(
    page,
    /needsPhoto\(item\.service\) && !item\.value\.file/,
    'илгээх хаалт ялгалгүй хэвээр — медаль дахин гацна',
  );
});

test('олон ширхэг медаль ХЯМД үнээр бодогдоно', async () => {
  /*
   * Каталогт шилэн медаль хоёр мөртэй: «10 дотор» ба «олон». Хямдралыг
   * үл тоомсорловол 50 ширхэгт бараг хоёр дахин их үнэ харуулна —
   * хэрэглэгч буцна, эсвэл ажилтан залгаж тайлбарлах хэрэг гарна.
   */
  const { serviceIdFor } = await import('../src/lib/price');
  const { SERVICES } = await import('../src/data/catalog');
  const { parsePrice } = await import('../src/lib/price');

  const glass = MEDAL_DESIGNS.find((d) => d.material === 'glass');
  assert.ok(glass?.bulk, 'шилэн медальд олны үнэ тохируулаагүй');

  const priceAt = (qty: number) =>
    parsePrice(SERVICES.find((s) => s.id === serviceIdFor(glass, qty))?.price);

  const few = priceAt(glass.bulk.from - 1);
  const many = priceAt(glass.bulk.from);

  assert.ok(few > 0 && many > 0, 'үнэ каталогоос уншигдсангүй');
  assert.ok(many < few, `олны үнэ хямд байх ёстой: ${many} ≥ ${few}`);
  // Хил дээр эргэлзээгүй байх ёстой.
  assert.equal(priceAt(glass.bulk.from + 100), many, 'их тоонд үнэ буцаж өсөв');
  assert.equal(priceAt(1), few, 'ганц ширхэгт олны үнэ буруу хэрэглэгдэв');

  const page = readFileSync(path.join(process.cwd(), 'src/pages/Medal.tsx'), 'utf8');
  assert.match(page, /serviceIdFor|serviceFor\(design, qty\)/, 'хуудас олны үнэ бодохгүй');
  assert.ok(!/priceOf\(design\)(?!,)/.test(page), 'үнэ тоо ширхэгээс хамаарахгүй хэвээр');
});

test('медалийн bulk мөр каталогт БАЙНА', async () => {
  // Буруу id бичвэл үнэ 0 болж, захиалга үнэгүй мэт харагдана.
  const { SERVICES } = await import('../src/data/catalog');
  const ids = new Set(SERVICES.map((s) => s.id));

  for (const design of MEDAL_DESIGNS) {
    if (!design.bulk) continue;
    assert.ok(ids.has(design.bulk.serviceId), `${design.id}: bulk id каталогт алга`);
    assert.ok(design.bulk.from > 1, `${design.id}: олны хил 1 байж болохгүй`);
  }
});
