import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THRESHOLDS,
  blurScore,
  checkQuality,
  exposureOf,
  isPrintReady,
  worstLevel,
  type QualityInput,
} from '../src/lib/quality';
import { ID_SIZES } from '../src/lib/idPhoto';

/**
 * Чанарын шалгалт.
 *
 * Энэ код нь ЧИМЭЭГҮЙ алддаг төрөл: буруу босго тавибал муу зураг
 * дамжина, эсвэл сайн зураг дэмий хаагдана. Аль нь ч алдаа шиддэггүй.
 */

const size = ID_SIZES[0];

/**
 * Хурц эсвэл бүдэг шалгамал зураг үүсгэнэ.
 *
 * ⚠️ **Өргөн зурвасын** агуулга (псевдо-санамсаргүй) ашигласан нь чухал.
 * Эхний оролдлогод нэг давтамжийн судал хэрэглэсэн — тэр буруу байсан:
 * нэг давтамжийн долгионыг бүдгэрүүлэхэд ижил давтамжийн долгион үлддэг
 * тул өндөр давтамжийн эзлэх ХУВЬ өөрчлөгддөггүй. Бодит зураг нь өргөн
 * зурвастай бөгөөд бүдгэрэхэд өндөр давтамж эхэлж алдагддаг.
 */
const makeTexture = (w: number, h: number, passes: number, amp = 1, base = 0) => {
  // Тодорхойлогдсон псевдо-санамсаргүй — тест давтагдах ёстой.
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  let cur = new Float32Array(w * h);
  for (let p = 0; p < w * h; p += 1) cur[p] = base + amp * (20 + rnd() * 215);

  // 3×3 дундажлалтыг давтах = аажим бүдгэрэлт.
  for (let pass = 0; pass < passes; pass += 1) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const sy = Math.min(h - 1, Math.max(0, y + dy));
            const sx = Math.min(w - 1, Math.max(0, x + dx));
            sum += cur[sy * w + sx];
            n += 1;
          }
        }
        out[y * w + x] = sum / n;
      }
    }
    cur = out;
  }

  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p += 1) {
    data[p * 4] = cur[p];
    data[p * 4 + 1] = cur[p];
    data[p * 4 + 2] = cur[p];
    data[p * 4 + 3] = 255;
  }
  return data;
};

const solid = (w: number, h: number, v: number) => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p += 1) {
    data[p * 4] = v;
    data[p * 4 + 1] = v;
    data[p * 4 + 2] = v;
    data[p * 4 + 3] = 255;
  }
  return data;
};

/* ── Бүдэгрэлт ───────────────────────────────────────────────────── */

test('бүдэг зураг хурц зурагнаас БАГА оноо авна', () => {
  const w = 80;
  const h = 80;
  const sharp = blurScore(makeTexture(w, h, 0), w, h);
  const soft = blurScore(makeTexture(w, h, 4), w, h);

  assert.ok(sharp > soft * 3, `ялгаж чадсангүй: хурц ${sharp.toFixed(1)} vs бүдэг ${soft.toFixed(1)}`);
  assert.ok(sharp > THRESHOLDS.blurWarn, `хурц зураг сануулга авлаа: ${sharp.toFixed(1)}`);
  assert.ok(soft < THRESHOLDS.blurWarn, `бүдэг зураг өнгөрлөө: ${soft.toFixed(1)}`);
});

test('хэмжүүр МАСШТАБ-ИНВАРИАНТ — бараан зургийг шийтгэхгүй', () => {
  /*
   * Хар костюм, харанхуй өрөө нь ялгаралтыг бууруулдаг ч хурц байдлыг
   * бууруулдаггүй. «Лапласын дисперс» гэсэн түгээмэл зөвлөгөө энд алддаг:
   * дисперс нь далайцаас квадратаар хамаардаг тул бараан зураг автоматаар
   * «бүдэг» болно. √дисперс ÷ ялгаралт нь энэ хамаарлыг арилгана.
   */
  const w = 80;
  const h = 80;

  const bright = blurScore(makeTexture(w, h, 0, 1, 0), w, h);
  const dim = blurScore(makeTexture(w, h, 0, 0.25, 20), w, h);

  assert.ok(
    Math.abs(bright - dim) < 0.05,
    `гэрэлтэлтээс хамаарлаа: тод ${bright.toFixed(3)} vs бараан ${dim.toFixed(3)}`,
  );
  assert.ok(dim > THRESHOLDS.blurWarn, `бараан хурц зургийг бүдэг гэж үзлээ: ${dim.toFixed(3)}`);
});

test('бүдгэрэх тусам оноо МОНОТОН буурна', () => {
  const w = 100;
  const h = 100;
  const scores = [0, 1, 2, 3, 5, 8, 12].map((p) => blurScore(makeTexture(w, h, p), w, h));

  for (let i = 1; i < scores.length; i += 1) {
    assert.ok(
      scores[i] < scores[i - 1],
      `монотон биш: ${scores.map((s) => s.toFixed(3)).join(' → ')}`,
    );
  }
});

/* ── Гэрэлтэлт ───────────────────────────────────────────────────── */

test('гэрэлтэлт болон алдагдсан пикселийг тоолно', () => {
  assert.ok(Math.abs(exposureOf(solid(20, 20, 128), 20, 20).mean - 128) < 1);

  const dark = exposureOf(solid(20, 20, 5), 20, 20);
  assert.equal(dark.clippedDark, 1, 'бүрэн харласныг олоогүй');

  const blown = exposureOf(solid(20, 20, 252), 20, 20);
  assert.equal(blown.clippedBright, 1, 'бүрэн цайсныг олоогүй');
});

test('хэсэгчилсэн муж л хэмжигдэнэ', () => {
  const w = 40;
  const h = 40;
  const data = solid(w, h, 250);
  // Зүүн дээд булан харанхуй.
  for (let y = 0; y < 10; y += 1) {
    for (let x = 0; x < 10; x += 1) {
      const i = (y * w + x) * 4;
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }

  const corner = exposureOf(data, w, h, { x: 0, y: 0, w: 10, h: 10 });
  assert.ok(corner.mean < 10, 'муж хэрэгсээгүй');
});

/* ── Шалгалтын шийдвэрүүд ────────────────────────────────────────── */

const baseInput = (over: Partial<QualityInput> = {}): QualityInput => {
  const w = 120;
  const h = 160;
  return {
    data: makeTexture(w, h, 0),
    width: w,
    height: h,
    // Стандартад тохирсон толгой: өндөр нь хүрээний headRatio хувь, төвд.
    face: { x: w / 2 - 30, y: 12, w: 60, h: h * size.headRatio },
    size,
    ...over,
  };
};

test('нүүр олдоогүй бол хэвлэхийг ЗОГСООНО', () => {
  const checks = checkQuality(baseInput({ face: null }));
  assert.equal(worstLevel(checks), 'fail');
  assert.equal(isPrintReady(checks), false);
  assert.match(checks[0].message, /Нүүр олдсонгүй/);
});

test('нэгээс олон хүн бол зогсооно', () => {
  const checks = checkQuality(baseInput({ faceCount: 2 }));
  const multi = checks.find((c) => c.key === 'faceCount');
  assert.ok(multi, 'олон нүүрийг илрүүлээгүй');
  assert.equal(multi.level, 'fail');
  assert.match(multi.message, /2 хүн/);
});

test('нүүрний тоо МЭДЭГДЭХГҮЙ үед худал баталгаа өгөхгүй', () => {
  /*
   * Дүрсийн хүрээний арга нүүр тоолж чаддаггүй. «Ганц хүн байна» гэж
   * батлах нь худал — тэр шалгалтыг чимээгүй алгасах ёстой.
   */
  const checks = checkQuality(baseInput({ faceCount: undefined }));
  assert.equal(checks.find((c) => c.key === 'faceCount'), undefined);
});

test('стандартад тохирсон зураг хэвлэхэд бэлэн', () => {
  const checks = checkQuality(baseInput({ faceCount: 1, backgroundShare: 0.5 }));
  assert.equal(isPrintReady(checks), true, JSON.stringify(checks, null, 2));
  assert.equal(worstLevel(checks), 'ok', JSON.stringify(checks, null, 2));
});

test('толгой хэт том, хэт жижиг үед ЧИГЛҮҮЛСЭН зөвлөгөө өгнө', () => {
  const h = 160;

  const big = checkQuality(baseInput({ face: { x: 30, y: 12, w: 60, h: h * 0.95 } }));
  assert.match(big.find((c) => c.key === 'headSize')!.message, /том/);

  const small = checkQuality(baseInput({ face: { x: 30, y: 12, w: 60, h: h * 0.4 } }));
  assert.match(small.find((c) => c.key === 'headSize')!.message, /жижиг/);
});

test('хазайлтын ЧИГЛЭЛийг зөв хэлнэ', () => {
  const w = 120;
  const right = checkQuality(baseInput({ face: { x: w - 50, y: 12, w: 60, h: 120 } }));
  assert.match(right.find((c) => c.key === 'center')!.message, /баруун/);

  const left = checkQuality(baseInput({ face: { x: -10, y: 12, w: 60, h: 120 } }));
  assert.match(left.find((c) => c.key === 'center')!.message, /зүүн/);
});

test('толгойн орой тасарсныг зогсооно', () => {
  const checks = checkQuality(baseInput({ face: { x: 30, y: -5, w: 60, h: 120 } }));
  const vertical = checks.find((c) => c.key === 'vertical');
  assert.equal(vertical?.level, 'fail');
  assert.match(vertical.message, /тасарсан/);
});

test('бүдэг зурагт хэвлэхийг зогсооно', () => {
  const w = 120;
  const h = 160;
  const checks = checkQuality(baseInput({ data: makeTexture(w, h, 12) }));
  const blur = checks.find((c) => c.key === 'blur');
  assert.equal(blur?.level, 'fail', JSON.stringify(blur));
  assert.equal(isPrintReady(checks), false);
});

test('ХЭТ бүдэг зураг «хурц» мэт уншигдахгүй — квантчлалын урхи', () => {
  /*
   * 8 бит квантчлалын шуугиан нь цагаан (өндөр давтамжтай) тул хэт бүдэг
   * зурагт харьцаа эргэж ӨСДӨГ. Хэмжилтээр 12 дамжлагаас хойш яг ийм
   * эргэлт гарсан: 0.298 → 0.303 → 0.355 → 0.403.
   *
   * Ялгаралтын хамгаалалтгүй бол хамгийн муу зураг л хамгийн сайн оноо
   * авна. Энэ тест тэр хамгаалалтыг түгжинэ.
   */
  const w = 120;
  const h = 160;

  for (const passes of [16, 24, 32, 48]) {
    const score = blurScore(makeTexture(w, h, passes), w, h);
    assert.ok(
      score < THRESHOLDS.blurWarn,
      `${passes} дамжлага бүдгэрүүлсэн зураг хурц гэж уншигдлаа: ${score.toFixed(3)}`,
    );
  }
});

test('дэвсгэр жигд бус бол СЭРЭМЖЛҮҮЛНЭ, зогсоохгүй', () => {
  /*
   * Жигд бус дэвсгэр нь буруу үр дүнгийн ШАЛТГААН болж болох ч өөрөө
   * алдаа биш. Ажилтан шийднэ.
   */
  const checks = checkQuality(
    baseInput({
      faceCount: 1,
      backdrop: { at: () => ({ r: 0, g: 0, b: 0 }), uniform: false, residual: 40, spread: 0 },
    }),
  );
  const bg = checks.find((c) => c.key === 'background');
  assert.equal(bg?.level, 'warn');
  assert.equal(isPrintReady(checks), true, 'сануулга хэвлэхийг зогсоолоо');
});

test('бүх мессеж монгол хэл дээр, техникийн үггүй', () => {
  const banned = /face|detect|segment|tolerance|mask|blur|crop|error|failed/i;

  const samples = [
    checkQuality(baseInput({ face: null })),
    checkQuality(baseInput({ faceCount: 3 })),
    checkQuality(baseInput({ face: { x: 30, y: -5, w: 60, h: 120 } })),
    checkQuality(baseInput({ data: makeTexture(120, 160, 12) })),
    checkQuality(baseInput({ faceCount: 1, backgroundShare: 0.01 })),
  ];

  for (const checks of samples) {
    for (const check of checks) {
      assert.doesNotMatch(check.message, banned, `техникийн үг: «${check.message}»`);
      assert.match(check.message, /[Ѐ-ӿ]/, `кирилл биш: «${check.message}»`);
    }
  }
});
