/**
 * Зургийн чанарын автомат шалгалт.
 *
 * ── Зорилго ──────────────────────────────────────────────────────
 *
 * Ажилтан хэвлэхээс ӨМНӨ асуудлыг олох. Буруу зураг хэвлэгдээд дахин
 * хийхээс, дэлгэц дээр сануулга уншсан нь хамаагүй хямд.
 *
 * ── Хэл ──────────────────────────────────────────────────────────
 *
 * Мессежүүд нь ЭНГИЙН монгол хэл дээр. «Face detection failed» биш
 * «Нүүр олдсонгүй». Хэрэглэгч компьютерийн мэргэжилтэн биш.
 *
 * ── Хэмжүүрийн зарчим ────────────────────────────────────────────
 *
 * Шалгалт бүр `ok | warn | fail` гэсэн гурван түвшинтэй:
 *
 *   • `fail` — хэвлэвэл бараг гарцаагүй буцаагдана. Хэвлэхийг зогсооно.
 *   • `warn` — эргэлзээтэй. Ажилтан шийднэ, зогсоохгүй.
 *   • `ok`   — асуудалгүй.
 *
 * `warn`-ыг `fail` болгож хатууруулах уруу таталт байдаг ч буруу: өндөр
 * үс, малгай, эмнэлгийн шалтгаанаар стандартаас хазайх ёстой тохиолдол
 * бодит амьдралд гардаг. Хэрэгсэл нь ажилтныг орлохгүй, зөвлөнө.
 *
 * DOM-гүй цэвэр функцууд — `test/quality.test.ts` шууд шалгана.
 */

import type { Backdrop, CropRect, IdSize } from './idPhoto';

export type CheckLevel = 'ok' | 'warn' | 'fail';

export interface Check {
  key: string;
  level: CheckLevel;
  /** Хэрэглэгчид харуулах энгийн монгол өгүүлбэр. */
  message: string;
}

/* ── Хэмжүүрүүд ──────────────────────────────────────────────────── */

/**
 * Бүтэц гэж үзэхэд шаардагдах хамгийн бага ялгаралт (0–255).
 *
 * Үүнээс доош бол зураг нь бараг жигд талбай — хэмжүүр утгагүй болно.
 */
const MIN_CONTRAST = 4;

/** Саарал утга (ITU-R BT.601) — нүдний мэдрэмжтэй нийцсэн жин. */
const luma = (data: Uint8ClampedArray, i: number): number =>
  0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

/**
 * Бүдэгрэлтийн хэмжүүр — Лапласын **стандарт хазайлт** ялгаралтад харьцуулсан.
 *
 * Хурц зурагт хөрш пикселүүдийн зөрүү их; бүдэг зурагт бага. Лапласын
 * шүүлтүүр яг энэ зөрүүг хэмжинэ.
 *
 * ⚠️ **Яагаад дисперс биш, стандарт хазайлт вэ.** Түгээмэл зөвлөгөө нь
 * «Лапласын дисперс» гэдэг. Гэвч дисперсийг ялгаралтад хуваавал үр дүн нь
 * далайцаас ШУГАМААР хамаарна: ижил хурц зургийг бараан болгоход оноо нь
 * 4 дахин унана. Хар костюмтай, харанхуй өрөөнд авсан хурц зураг «бүдэг»
 * гэж тэмдэглэгдэнэ.
 *
 * Стандарт хазайлт (√дисперс) нь ялгаралттай ижил нэгжтэй тул харьцаа нь
 * масштаб-инвариант болно — гэрэлтэлтээс хамаарахгүй, зөвхөн хурц байдлыг
 * хэмжинэ.
 */
export function blurScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region?: CropRect,
): number {
  const x0 = Math.max(1, Math.floor(region?.x ?? 1));
  const y0 = Math.max(1, Math.floor(region?.y ?? 1));
  const x1 = Math.min(width - 1, Math.ceil((region?.x ?? 0) + (region?.w ?? width)));
  const y1 = Math.min(height - 1, Math.ceil((region?.y ?? 0) + (region?.h ?? height)));
  if (x1 <= x0 || y1 <= y0) return 0;

  let sum = 0;
  let sumSq = 0;
  let mean = 0;
  let meanSq = 0;
  let n = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * width + x) * 4;
      const lap =
        4 * luma(data, i) -
        luma(data, i - 4) -
        luma(data, i + 4) -
        luma(data, i - width * 4) -
        luma(data, i + width * 4);

      sum += lap;
      sumSq += lap * lap;

      const v = luma(data, i);
      mean += v;
      meanSq += v * v;
      n += 1;
    }
  }

  if (n === 0) return 0;

  const lapVar = Math.max(0, sumSq / n - (sum / n) ** 2);
  const contrast = Math.sqrt(Math.max(0, meanSq / n - (mean / n) ** 2));

  /*
   * ⚠️ **Квантчлалын урхи.** Зураг 8 битээр хадгалагддаг. Хэт бүдэг зурагт
   * бодит дохионы далайц 1 LSB-ээс доош унаж, үлдсэн зөрүү нь дугуйруулалтын
   * ШУУГИАН болно. Шуугиан нь цагаан — өндөр давтамжтай — тул харьцаа эргэж
   * ӨСӨЖ, маш бүдэг зураг «хурц» мэт уншигдана.
   *
   * Хэмжилтээр 12-оос олон удаа бүдгэрүүлсэн зураг дээр яг ийм эргэлт
   * гарсан. Ялгаралт нь энэ хэмжээнд буусан зурагт бүтэц гэж үзэх зүйл
   * үлдээгүй тул 0 буцаана — сануулга өгөх нь зөв.
   */
  if (contrast < MIN_CONTRAST) return 0;

  // √дисперс ÷ ялгаралт — хоёулаа ижил нэгжтэй тул масштаб-инвариант.
  return Math.sqrt(lapVar) / contrast;
}

export interface Exposure {
  /** Дундаж гэрэлтэлт 0–255. */
  mean: number;
  /** Бүрэн харлаж/цайж алдагдсан пикселийн хувь. */
  clippedDark: number;
  clippedBright: number;
}

export function exposureOf(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region?: CropRect,
): Exposure {
  const x0 = Math.max(0, Math.floor(region?.x ?? 0));
  const y0 = Math.max(0, Math.floor(region?.y ?? 0));
  const x1 = Math.min(width, Math.ceil((region?.x ?? 0) + (region?.w ?? width)));
  const y1 = Math.min(height, Math.ceil((region?.y ?? 0) + (region?.h ?? height)));

  let sum = 0;
  let dark = 0;
  let bright = 0;
  let n = 0;

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const v = luma(data, (y * width + x) * 4);
      sum += v;
      if (v < 12) dark += 1;
      if (v > 245) bright += 1;
      n += 1;
    }
  }

  if (n === 0) return { mean: 0, clippedDark: 0, clippedBright: 0 };
  return { mean: sum / n, clippedDark: dark / n, clippedBright: bright / n };
}

/* ── Босго утгууд ───────────────────────────────────────────────── */

/**
 * Босгуудыг НЭГ ГАЗАР төвлөрүүлсэн.
 *
 * Кодын дунд тарсан «шидэт тоо» нь тохируулах боломжгүй болгодог.
 * Ажилтан бодит зураг дээр туршаад эндээс л засна.
 */
export const THRESHOLDS = {
  /*
   * Хурц байдлын харьцаа — үүнээс доош бол бүдэг.
   *
   * ⚠️ ЭДГЭЭР УТГЫГ БОДИТ ЗУРГААР ТОХИРУУЛАХ ХЭРЭГТЭЙ. Одоогийн утгууд
   * нь зохиомол өгөгдлөөс гаргасан **болгоомжтой** таамаг: худал
   * сануулга өгөхөөс илүү зарим бүдэг зургийг өнгөрөөх талд хазайсан.
   *
   * Тохируулах арга: дэлгүүрийн 20–30 бодит зураг дээр `blurScore`-ыг
   * хэвлээд, ажилтны «энэ бүдэг» гэсэн үнэлгээтэй харьцуул. Хурц зургийн
   * хамгийн бага утгаас доогуур `blurWarn`-ыг тавь.
   */
  blurWarn: 0.55,
  blurFail: 0.30,
  /** Нүүрний хэсгийн дундаж гэрэлтэлт. */
  darkWarn: 70,
  brightWarn: 215,
  /** Алдагдсан пикселийн зөвшөөрөгдөх хувь. */
  clipWarn: 0.08,
  /** Толгойн харьцаа стандартаас хазайх зөвшөөрөл. */
  headRatioWarn: 0.06,
  /** Хэвтээ төвөөс хазайх зөвшөөрөл — хүрээний өргөний хувиар. */
  centerWarn: 0.06,
  /** Дэвсгэрийн эзлэх хамгийн бага хувь — үүнээс бага бол салгалт болоогүй. */
  backgroundShareWarn: 0.25,
} as const;

/* ── Шалгалт ─────────────────────────────────────────────────────── */

export interface QualityInput {
  /** Тайрч, боловсруулсан зураг. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Толгойн хайрцаг — ТАЙРСАН зургийн координатаар. `null` = олдоогүй. */
  face: CropRect | null;
  /**
   * Илэрсэн нүүрний тоо. `undefined` = илрүүлэгч тоолж чадаагүй.
   *
   * Дүрсийн хүрээний арга нь найдвартай тоолж чаддаггүй. Мэдэхгүй үедээ
   * «нэг нүүр байна» гэж ХУДАЛ баталгаа өгөхгүй — шалгалтыг алгасна.
   */
  faceCount?: number;
  size: IdSize;
  /** Дэвсгэрийн загвар — жигд эсэхийг эндээс мэднэ. */
  backdrop?: Backdrop;
  /** Маскийн хэдэн хувь нь дэвсгэр болсон бэ (0–1). */
  backgroundShare?: number;
}

export function checkQuality(input: QualityInput): Check[] {
  const { data, width, height, face, faceCount, size, backdrop, backgroundShare } = input;
  const checks: Check[] = [];

  /* 1. Нүүр олдсон уу — бусад бүх шалгалтын үндэс. */
  if (!face) {
    checks.push({
      key: 'face',
      level: 'fail',
      message: 'Нүүр олдсонгүй. Урдаас, гэрэлтэй авсан зураг сонгоно уу.',
    });
    return checks;
  }
  checks.push({ key: 'face', level: 'ok', message: 'Нүүр илэрлээ' });

  /* 2. Нэгээс олон хүн. Тоолж чадаагүй бол ЧИМЭЭГҮЙ өнгөрнө. */
  if (faceCount !== undefined && faceCount > 1) {
    checks.push({
      key: 'faceCount',
      level: 'fail',
      message: `Зурагт ${faceCount} хүн байна. Ганц хүнтэй зураг хэрэгтэй.`,
    });
  }

  /* 3. Толгойн хэмжээ — стандартын гол шаардлага. */
  const ratio = face.h / height;
  const off = ratio - size.headRatio;
  if (Math.abs(off) > THRESHOLDS.headRatioWarn) {
    checks.push({
      key: 'headSize',
      level: 'warn',
      message:
        off > 0
          ? 'Нүүр стандартаас том байна. Томруулалтыг багасгана уу.'
          : 'Нүүр стандартаас жижиг байна. Томруулалтыг нэмнэ үү.',
    });
  } else {
    checks.push({ key: 'headSize', level: 'ok', message: 'Нүүрний хэмжээ стандартад тохирч байна' });
  }

  /* 4. Хэвтээ төвлөрөл. */
  const faceCenter = face.x + face.w / 2;
  const drift = (faceCenter - width / 2) / width;
  if (Math.abs(drift) > THRESHOLDS.centerWarn) {
    checks.push({
      key: 'center',
      level: 'warn',
      message: drift > 0 ? 'Нүүр баруун тийш хазайсан байна.' : 'Нүүр зүүн тийш хазайсан байна.',
    });
  } else {
    checks.push({ key: 'center', level: 'ok', message: 'Нүүр төвдөө байна' });
  }

  /* 5. Босоо байрлал — толгойн орой хүрээнээс гарсан уу. */
  if (face.y < 0) {
    checks.push({
      key: 'vertical',
      level: 'fail',
      message: 'Толгойн орой тасарсан байна.',
    });
  } else if (face.y > height * 0.25) {
    checks.push({
      key: 'vertical',
      level: 'warn',
      message: 'Толгой хэт доогуур байна. Дээш нь зөөнө үү.',
    });
  }

  /* 6. Бүдэгрэлт — зөвхөн НҮҮРНИЙ хэсэгт хэмжинэ. */
  const sharp = blurScore(data, width, height, face);
  if (sharp < THRESHOLDS.blurFail) {
    checks.push({
      key: 'blur',
      level: 'fail',
      message: 'Зураг хэт бүдэг байна. Дахин авах шаардлагатай.',
    });
  } else if (sharp < THRESHOLDS.blurWarn) {
    checks.push({
      key: 'blur',
      level: 'warn',
      message: 'Зураг бага зэрэг бүдэг байна.',
    });
  } else {
    checks.push({ key: 'blur', level: 'ok', message: 'Зургийн тод байдал хангалттай' });
  }

  /* 7. Гэрэлтэлт — мөн нүүрний хэсэгт. Дэвсгэр солигдсон тул бүтэн
        зургаар хэмжвэл цагаан дэвсгэр дүнг гуйвуулна. */
  const light = exposureOf(data, width, height, face);
  if (light.mean < THRESHOLDS.darkWarn) {
    checks.push({ key: 'light', level: 'warn', message: 'Нүүр харанхуй байна.' });
  } else if (light.mean > THRESHOLDS.brightWarn) {
    checks.push({ key: 'light', level: 'warn', message: 'Нүүр хэт цайсан байна.' });
  } else if (light.clippedDark > THRESHOLDS.clipWarn) {
    checks.push({ key: 'light', level: 'warn', message: 'Нүүрэн дээр гүн сүүдэр байна.' });
  } else if (light.clippedBright > THRESHOLDS.clipWarn) {
    checks.push({ key: 'light', level: 'warn', message: 'Нүүрэн дээр гэрлийн туяа унасан байна.' });
  } else {
    checks.push({ key: 'light', level: 'ok', message: 'Гэрэлтэлт хангалттай' });
  }

  /* 8. Дэвсгэр цэвэрлэгдсэн үү. */
  if (backdrop?.uniform === false) {
    checks.push({
      key: 'background',
      level: 'warn',
      message: 'Дэвсгэр жигд бус тул бүрэн цэвэрлэгдээгүй байж болзошгүй.',
    });
  } else if (
    backgroundShare !== undefined &&
    backgroundShare < THRESHOLDS.backgroundShareWarn
  ) {
    checks.push({
      key: 'background',
      level: 'warn',
      message: 'Дэвсгэрийг таньж чадсангүй. Гараар шалгана уу.',
    });
  } else if (backgroundShare !== undefined) {
    checks.push({ key: 'background', level: 'ok', message: 'Дэвсгэр автоматаар цэвэрлэгдлээ' });
  }

  return checks;
}

/** Хэвлэхэд бэлэн эсэх — `fail` байхгүй бол бэлэн. */
export const isPrintReady = (checks: readonly Check[]): boolean =>
  checks.every((c) => c.level !== 'fail');

/** Хамгийн ноцтой түвшин — товч төлөв харуулахад. */
export const worstLevel = (checks: readonly Check[]): CheckLevel =>
  checks.some((c) => c.level === 'fail')
    ? 'fail'
    : checks.some((c) => c.level === 'warn')
      ? 'warn'
      : 'ok';
