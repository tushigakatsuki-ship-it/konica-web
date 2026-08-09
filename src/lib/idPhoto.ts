/**
 * Цээж зургийн автоматжуулалт — цэвэр тооцоолол.
 *
 * Хоёр ажлыг автоматжуулна:
 *   1. **Дэвсгэр солих** — студийн жигд дэвсгэрийг цагаан/цэнхэрээр солих
 *   2. **Хуудсанд байрлуулах** — 10×15 цаасан дээр торлон байрлуулж, зүсэх
 *      зааврын тэмдэгтэй болгох
 *
 * Хоёр дахь нь ажилтны хамгийн их цаг иддэг ажил: одоо Photoshop дээр гараар
 * хуулж, зэрэгцүүлж, зай тохируулдаг. Энэ файл түүнийг тооцоо болгож хувиргав.
 *
 * DOM-гүй, canvas-гүй цэвэр функцууд тул `test/idPhoto.test.ts` шууд шалгана.
 */

// ── Стандарт хэмжээнүүд ────────────────────────────────────────────

export interface IdSize {
  /** Каталогийн `ServiceItem.id` — үнэ, нэрийг тэндээс авна. */
  serviceId: number;
  label: string;
  /** Сантиметрээр. */
  w: number;
  h: number;
  /**
   * Толгойн өндөр нь хүрээний өндрийн хэдэн хувь байх вэ.
   *
   * Бичиг баримтын стандартууд эрүүнээс толгойн орой хүртэлх өндрийг зурагны
   * 70–80% байхыг шаарддаг. Энэ утга нь тайрах хүрээний заавар зурах болон
   * АВТОМАТ тайралт тооцоход хэрэглэгдэнэ.
   */
  headRatio: number;
  /**
   * Толгойн оройноос дээших зай — хүрээний өндрийн хувиар.
   *
   * Стандартууд толгойн орой дээр бага зэрэг зай шаарддаг: орой нь хүрээний
   * ирмэгт хүрвэл «тайрагдсан» гэж үзэж буцаадаг.
   */
  topMargin: number;
}

export const ID_SIZES: readonly IdSize[] = [
  { serviceId: 401, label: '3×4 см', w: 3, h: 4, headRatio: 0.75, topMargin: 0.08 },
  { serviceId: 402, label: '3.5×4.5 см', w: 3.5, h: 4.5, headRatio: 0.75, topMargin: 0.08 },
  { serviceId: 403, label: '4×6 см', w: 4, h: 6, headRatio: 0.7, topMargin: 0.1 },
  /*
   * 2×3 нь бичиг баримтын стандарт биш — сурагчийн үнэмлэх, хувийн хэрэг
   * зэрэгт хэрэглэгддэг жижиг хэмжээ. Каталогт үнэ байхгүй тул `serviceId`
   * нь 3×4-тэй ижил.
   */
  { serviceId: 401, label: '2×3 см', w: 2, h: 3, headRatio: 0.72, topMargin: 0.08 },
];

/** Хэвлэлийн цаас — одоогоор 10×15 л хэрэглэгддэг. */
export const SHEET = { w: 10, h: 15, label: '10×15 см' } as const;

export const DPI = 300;

/** Сантиметрийг 300dpi пиксел болгоно. */
export const cmToPx = (cm: number, dpi = DPI): number => Math.round((cm / 2.54) * dpi);

// ── Хуудасны байрлуулалт ───────────────────────────────────────────

export interface SheetSlot {
  /** Зүүн дээд булангийн байрлал, сантиметрээр. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SheetLayout {
  cols: number;
  rows: number;
  count: number;
  /** Зураг 90° эргүүлж байрласан эсэх. */
  rotated: boolean;
  slots: readonly SheetSlot[];
}

const gridFor = (
  photoW: number,
  photoH: number,
  gap: number,
): { cols: number; rows: number } => ({
  // Захад мөн зай үлдээнэ: `(n × хэмжээ) + ((n+1) × зай) ≤ цаас`
  cols: Math.max(0, Math.floor((SHEET.w - gap) / (photoW + gap))),
  rows: Math.max(0, Math.floor((SHEET.h - gap) / (photoH + gap))),
});

/**
 * Хуудсанд хамгийн олон зураг багтаах байрлал.
 *
 * Хоёр чиглэлийг ХОЁУЛАНГ нь тооцож, олон багтаахыг нь сонгоно: 3×4 зураг
 * босоогоороо 9, хэвтээгээрээ 8 багтдаг тул зөрүү нь бодит мөнгө.
 *
 * `gap` нь зай төдийгүй зүсэх зөвшөөрөл — зүсэгч машин 1–2мм алдаатай тул
 * зэрэгцээ зургууд шууд наалдвал хөрш зургийн ирмэг орж ирнэ.
 */
export function sheetLayout(size: IdSize, gapCm = 0.2): SheetLayout {
  const upright = gridFor(size.w, size.h, gapCm);
  const rotated = gridFor(size.h, size.w, gapCm);

  const useRotated = rotated.cols * rotated.rows > upright.cols * upright.rows;
  const { cols, rows } = useRotated ? rotated : upright;
  const w = useRotated ? size.h : size.w;
  const h = useRotated ? size.w : size.h;

  // Үлдсэн зайг тэнцүү хуваан ТӨВЛҮҮЛНЭ — нэг тал дээр цагаан зурвас үлдэхгүй.
  const marginX = (SHEET.w - cols * w - (cols - 1) * gapCm) / 2;
  const marginY = (SHEET.h - rows * h - (rows - 1) * gapCm) / 2;

  const slots: SheetSlot[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      slots.push({
        x: marginX + col * (w + gapCm),
        y: marginY + row * (h + gapCm),
        w,
        h,
      });
    }
  }

  return { cols, rows, count: slots.length, rotated: useRotated, slots };
}

// ── Дэвсгэр солих ──────────────────────────────────────────────────

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export const BACKGROUNDS: readonly { key: string; label: string; rgb: Rgb | null }[] = [
  { key: 'white', label: 'Цагаан', rgb: { r: 255, g: 255, b: 255 } },
  { key: 'blue', label: 'Цайвар цэнхэр', rgb: { r: 219, g: 234, b: 254 } },
  { key: 'gray', label: 'Цайвар саарал', rgb: { r: 241, g: 245, b: 249 } },
  /*
   * «Хэвээр» — дэвсгэрийг огт хөндөхгүй.
   *
   * Буржгар үс, нимгэн шилний хүрээ зэрэг нарийн ирмэг заримдаа бүдгэрдэг.
   * Хүнд тохиолдолд автоматыг унтраагаад Photoshop дээр гараар засах нь
   * үр дүнг «засах гэж оролдохоос» хурдан.
   */
  { key: 'keep', label: 'Хэвээр', rgb: null },
];

/**
 * Ирмэгийн пикселээс дэвсгэрийн өнгийг таамаглана.
 *
 * ⚠️ **Доод ирмэгийг ЗОРИУД алгасна.** Цээж зурагт хүний мөр, бие нь доод
 * ирмэгийг бараг бүтнээр эзэлдэг — дөрвөн талыг жигд дунджилбал дэвсгэрийн
 * өнгө хүн рүү татагдаж, үерийн дүүргэлт эсрэгээрээ ажиллаж, БҮХ зургийг
 * «дэвсгэр» гэж үзнэ.
 *
 * Тиймээс дээд зурвасыг бүтнээр, хажуу зурвасуудыг зөвхөн ДЭЭД хэсгээс
 * (толгойн эргэн тойрон) түүвэрлэнэ. Тэнд бараг үргэлж цэвэр дэвсгэр байдаг.
 */
export function borderColor(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  band = 4,
): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  };

  // Дээд зурвас — бүтнээр.
  for (let x = 0; x < width; x += 1) {
    for (let d = 0; d < band && d < height; d += 1) sample(x, d);
  }

  // Хажуу зурвасууд — зөвхөн дээд 60%.
  const sideTo = Math.max(1, Math.round(height * 0.6));
  for (let y = 0; y < sideTo; y += 1) {
    for (let d = 0; d < band && d < width; d += 1) {
      sample(d, y);
      sample(width - 1 - d, y);
    }
  }

  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}

/** 0–441 хооронд (RGB орон зайн диагональ). */
export const colorDistance = (data: Uint8ClampedArray, i: number, c: Rgb): number => {
  const dr = data[i] - c.r;
  const dg = data[i + 1] - c.g;
  const db = data[i + 2] - c.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

/**
 * Дэвсгэрийн маск — ИРМЭГЭЭС эхэлсэн үерийн дүүргэлт (flood fill).
 *
 * Яагаад зүгээр «өнгө нь ойролцоо бүх пиксел» биш вэ: хүний цагаан цамц,
 * нүдний цагаан хэсэг нь дэвсгэртэй ижил өнгөтэй байдаг. Ирмэгээс эхлэн
 * ЗАЛГАА хэсгийг л түүвэрлэснээр биеийн доторх цагаан хэсгүүд хөндөгдөхгүй.
 *
 * Буцаах утга: `255` = дэвсгэр, `0` = хүн.
 *
 * ⚠️ Энэ арга нь **жигд дэвсгэр** дээр л ажиллана — студийн цагаан, цайвар
 * цэнхэр дэвсгэр яг тийм. Гэрийн орчны эмх замбараагүй дэвсгэрийг таних
 * боломжгүй тул тэр тохиолдолд ажилтан унтраана.
 */
export function backgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
  bg: Rgb = borderColor(data, width, height),
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  // Тодорхой хэмжээний стек — рекурс нь том зураг дээр стек халина.
  const stack: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    visited[p] = 1;
    if (colorDistance(data, p * 4, bg) <= tolerance) {
      mask[p] = 255;
      stack.push(x, y);
    }
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  return mask;
}

/**
 * Маскийн ирмэгийг зөөлрүүлнэ (хайрцган бүдгэрүүлэлт).
 *
 * Зөөлрүүлэхгүй бол үс, мөрний зааг шүдлэг гарч, хэвлэсэн зураг дээр
 * «хайчилсан» мэт харагдана. Хоёр дамжлагатай (хэвтээ + босоо) тул
 * радиусаас үл хамааран хурдан.
 */
export function featherMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number,
): Uint8Array {
  if (radius < 1) return mask;

  const pass = (src: Uint8Array, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(src.length);
    const outer = horizontal ? height : width;
    const inner = horizontal ? width : height;

    for (let o = 0; o < outer; o += 1) {
      let sum = 0;
      const at = (i: number) => (horizontal ? o * width + i : i * width + o);

      for (let i = -radius; i <= radius; i += 1) {
        sum += src[at(Math.min(inner - 1, Math.max(0, i)))];
      }

      for (let i = 0; i < inner; i += 1) {
        out[at(i)] = Math.round(sum / (radius * 2 + 1));
        sum -= src[at(Math.min(inner - 1, Math.max(0, i - radius)))];
        sum += src[at(Math.min(inner - 1, Math.max(0, i + radius + 1)))];
      }
    }
    return out;
  };

  return pass(pass(mask, true), false);
}

/**
 * Дэвсгэрийг сонгосон өнгөөр солино (газар дээр нь).
 *
 * `mask` нь 0–255: 255 бол бүрэн дэвсгэр, завсрын утга нь ирмэгийн зөөлрөлт.
 */
export function applyBackground(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  color: Rgb,
): void {
  for (let p = 0; p < mask.length; p += 1) {
    const a = mask[p];
    if (a === 0) continue;

    const i = p * 4;
    const t = a / 255;
    data[i] = Math.round(data[i] * (1 - t) + color.r * t);
    data[i + 1] = Math.round(data[i + 1] * (1 - t) + color.g * t);
    data[i + 2] = Math.round(data[i + 2] * (1 - t) + color.b * t);
  }
}

// ── Стандартын дагуу автомат тайралт ───────────────────────────────

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AutoCrop {
  rect: CropRect;
  /**
   * Хүссэн хүрээ зургийн гадна гарсан эсэх.
   *
   * Гарсан бол ажилтанд хэлнэ: хүн хэт ирмэгт зогссон, эсвэл зураг хэтэрхий
   * ойроос авагдсан гэсэн үг. Чимээгүй шахаж багтаавал стандарт зөрчигдөнө.
   */
  clamped: boolean;
}

/**
 * Толгойн хайрцгаас баримтын стандартын дагуу тайрах хүрээг тооцно.
 *
 * Стандартын хоёр хэмжилт:
 *   • толгойн өндөр = хүрээний өндрийн `headRatio`
 *   • толгойн орой нь дээд ирмэгээс `topMargin` зайд
 *
 * Эдгээрээс хүрээний өндөр, дараа нь харьцаагаар өргөн гарна. Хэвтээ голыг
 * толгойн төвөөр тавина.
 */
export function cropForFace(
  face: CropRect,
  size: IdSize,
  imageWidth: number,
  imageHeight: number,
): AutoCrop {
  const cropH = face.h / size.headRatio;
  const cropW = cropH * (size.w / size.h);

  let x = face.x + face.w / 2 - cropW / 2;
  let y = face.y - cropH * size.topMargin;

  const before = { x, y };
  x = Math.max(0, Math.min(imageWidth - cropW, x));
  y = Math.max(0, Math.min(imageHeight - cropH, y));

  // Хүрээ өөрөө зурагнаас том бол шахах ч утгагүй — тэмдэглээд буцаана.
  const tooBig = cropW > imageWidth || cropH > imageHeight;
  const moved = Math.abs(x - before.x) > 0.5 || Math.abs(y - before.y) > 0.5;

  return {
    rect: { x, y, w: cropW, h: cropH },
    clamped: tooBig || moved,
  };
}
