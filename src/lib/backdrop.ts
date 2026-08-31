/**
 * Дэвсгэр солих математик — `_to_delete/src/lib/idPhoto.ts`-ээс шилжүүлсэн.
 *
 * ЗӨВХӨН дэвсгэртэй холбоотой, нүүр илрүүлэлт/автомат тайралтаас ангид
 * функцууд энд ирсэн (`fitBackdrop`, `backgroundMask`, `featherMask`,
 * `applyBackground`, `autoWhiteBalance`). Нүүр илрүүлэлт, автомат тайралт
 * (`cropForFace`, `zoomCrop`, `ID_SIZES`, `sheetLayout`) ЗОРИУД ОРООГҮЙ —
 * энэ ажил зөвхөн гар аргаар тайрсан зурагт дэвсгэр санал болгодог, `docs`
 * дэх «Цээж зураг — шийдвэр ЭРГЭСЭН» түүхэн алдаануудыг давтахгүйн тулд.
 *
 * ⚠️ Энэ модуль зөвхөн **жигд** (студи маягийн) дэвсгэрт ажиллана. Гэрийн
 * эмх замбараагүй дэвсгэрийг `fitBackdrop`-ийн `uniform: false` илрүүлж,
 * дуудагч тал дэвсгэр солих сонголтыг идэвхгүй болгож, ажилтанд шилжүүлдэг.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Харилцагчид санал болгох дэвсгэрүүд — зөвхөн цагаан, цайвар цэнхэр. */
export const BACKGROUNDS: readonly { key: 'white' | 'lightblue'; label: string; rgb: Rgb }[] = [
  { key: 'white', label: 'Цагаан', rgb: { r: 255, g: 255, b: 255 } },
  { key: 'lightblue', label: 'Цайвар цэнхэр', rgb: { r: 219, g: 234, b: 254 } },
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
 * Дэвсгэрийн **орон зайн** загвар: өнгө нь байрлалаас хамаарна.
 *
 * ── Яагаад ганц өнгө хангалтгүй вэ ────────────────────────────────
 *
 * Бодит студийн дэвсгэр хэзээ ч жигд байдаггүй:
 *
 *   • Гэрэлтүүлэг ихэвчлэн нэг талаас — нөгөө тал нь 20–40 нэгжээр бараан
 *   • Обьектив булангуудыг харанхуйлдаг (vignetting)
 *   • Хүн өөрөө дэвсгэр дээр сүүдэр тусгадаг
 *
 * Ганц дундаж өнгөтэй харьцуулбал эдгээр хэсэг тэвчээрийн хязгаараас
 * хэтэрч, «хүн» гэж үлдэнэ — тэгээд арын дэвсгэр **дутуу арилна**.
 * Тэвчээрийг ихэсгэвэл хүний үс, хацар идэгдэж эхэлнэ. Тогтмол загвартай
 * бол энэ хоёрын хооронд аз таарахгүй.
 *
 * ── Шийдэл ───────────────────────────────────────────────────────
 *
 * Ирмэгийн түүврээр суваг тус бүрт **хавтгай (plane)** тааруулна:
 *
 *     утга(x, y) = a·x + b·y + c
 *
 * Хавтгай нь нэг талын гэрэлтүүлэг, шугаман харанхуйлалтыг — өөрөөр хэлбэл
 * бодит тохиолдлын дийлэнхийг — барина. Дараа нь пиксел бүрийг **тухайн
 * цэгийн** таамаглалтай харьцуулна, дунджтай биш.
 *
 * Ирмэг өөрөө эмх замбараагүй бол (гэрийн орчин) үлдэгдэл том гарна —
 * тэр үед `uniform: false` болж, ДЭВСГЭР СОЛИХ САНАЛЫГ ИДЭВХГҮЙ БОЛГОХ
 * шалгуур болдог. Энэ бол харилцагчийн засварын хэрэгслийн «жигд эсэх»
 * шалгалтын цөм.
 */
export interface Backdrop {
  /** Тухайн цэг дэх дэвсгэрийн таамаглал. */
  at(x: number, y: number): Rgb;
  /** Ирмэг жигд байсан уу — үгүй бол хавтгайг хэрэглэхгүй. */
  uniform: boolean;
  /** Түүврийн дундаж үлдэгдэл. Оношилгоонд хэрэгтэй. */
  residual: number;
  /** Зургийн хоёр захын хоорондох таамаглалын зөрүү. */
  spread: number;
}

/** 3×3 шугаман систем — Крамерын дүрэм. Ганцаарчилсан бол `null`. */
const solve3 = (m: number[][], v: number[]): [number, number, number] | null => {
  const det = (a: number[][]) =>
    a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1]) -
    a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0]) +
    a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0]);

  const d = det(m);
  if (Math.abs(d) < 1e-9) return null;

  const col = (k: number) => det(m.map((row, i) => row.map((c, j) => (j === k ? v[i] : c))));
  return [col(0) / d, col(1) / d, col(2) / d];
};

export function fitBackdrop(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  band = 4,
): Backdrop {
  const xs: number[] = [];
  const ys: number[] = [];
  const cs: [number, number, number][] = [];

  const sample = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    xs.push(x);
    ys.push(y);
    cs.push([data[i], data[i + 1], data[i + 2]]);
  };

  /*
   * `borderColor`-тай ижил түүврийн бодлого: доод ирмэгийг алгасна, учир нь
   * цээж зурагт хүний бие түүнийг бараг бүтнээр эзэлдэг.
   */
  for (let x = 0; x < width; x += 1) {
    for (let d = 0; d < band && d < height; d += 1) sample(x, d);
  }
  const sideTo = Math.max(1, Math.round(height * 0.6));
  for (let y = 0; y < sideTo; y += 1) {
    for (let d = 0; d < band && d < width; d += 1) {
      sample(d, y);
      sample(width - 1 - d, y);
    }
  }

  const mean = borderColor(data, width, height, band);
  const constant: Backdrop = {
    at: () => mean,
    uniform: true,
    residual: 0,
    spread: 0,
  };
  if (xs.length < 12) return constant;

  // Хэвийн тэгшитгэлийн нийлбэрүүд.
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  let sx = 0;
  let sy = 0;
  const n = xs.length;
  for (let i = 0; i < n; i += 1) {
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
    syy += ys[i] * ys[i];
    sx += xs[i];
    sy += ys[i];
  }
  const m = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];

  const planes: [number, number, number][] = [];
  for (let ch = 0; ch < 3; ch += 1) {
    let sxv = 0;
    let syv = 0;
    let sv = 0;
    for (let i = 0; i < n; i += 1) {
      const v = cs[i][ch];
      sxv += xs[i] * v;
      syv += ys[i] * v;
      sv += v;
    }
    const p = solve3(m, [sxv, syv, sv]);
    if (!p) return constant;
    planes.push(p);
  }

  const predict = (x: number, y: number): Rgb => ({
    r: planes[0][0] * x + planes[0][1] * y + planes[0][2],
    g: planes[1][0] * x + planes[1][1] * y + planes[1][2],
    b: planes[2][0] * x + planes[2][1] * y + planes[2][2],
  });

  let residual = 0;
  for (let i = 0; i < n; i += 1) {
    const p = predict(xs[i], ys[i]);
    const dr = cs[i][0] - p.r;
    const dg = cs[i][1] - p.g;
    const db = cs[i][2] - p.b;
    residual += Math.sqrt(dr * dr + dg * dg + db * db);
  }
  residual /= n;

  /*
   * Үлдэгдэл том = ирмэг дээр дэвсгэрээс өөр юм бий (тавилга, хана, хээ).
   * Тийм үед хавтгай нь буруу тийш экстраполяци хийж, хүн рүү «дэвсгэр»
   * гэсэн таамаглал тарааж болзошгүй. Тогтмол өнгө рүү аюулгүйгээр буцна.
   */
  if (residual > 24) return { ...constant, uniform: false, residual };

  const corners: Rgb[] = [
    predict(0, 0),
    predict(width - 1, 0),
    predict(0, height - 1),
    predict(width - 1, height - 1),
  ];
  let spread = 0;
  for (const a of corners) {
    for (const b of corners) {
      spread = Math.max(
        spread,
        Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2),
      );
    }
  }

  return { at: predict, uniform: true, residual, spread };
}

export interface MaskOptions {
  /**
   * Хөрш пикселүүдийн хоорондох зөвшөөрөгдөх хамгийн их үсрэлт.
   *
   * Градиентийг залгих гол параметр: сүүдэр аажим бараантах тул алхам бүр
   * жижиг, харин хүний ирмэг дээр огцом үсэрдэг тул тэнд зогсоно.
   */
  step?: number;
  /** Хэсэгчилсэн ил тод байдлын зурвасын өргөн (үс, шилний ирмэг). */
  soft?: number;
  /** Ирмэгээс тусгаарлагдсан хаалттай нүхийг нөхөх эсэх. */
  fillPockets?: boolean;
  /** Бэлэн дэвсгэрийн загвар. Өгөөгүй бол дотроо тааруулна. */
  backdrop?: Backdrop;
}

/**
 * Дэвсгэрийн маск — ИРМЭГЭЭС эхэлсэн үерийн дүүргэлт (flood fill).
 *
 * Яагаад зүгээр «өнгө нь ойролцоо бүх пиксел» биш вэ: хүний цагаан цамц,
 * нүдний цагаан хэсэг нь дэвсгэртэй ижил өнгөтэй байдаг. Ирмэгээс эхлэн
 * ЗАЛГАА хэсгийг л түүвэрлэснээр биеийн доторх цагаан хэсгүүд хөндөгдөхгүй.
 *
 * Буцаах утга: `255` = дэвсгэр, `0` = хүн, дунд нь = хэсэгчилсэн ил тод.
 *
 * ⚠️ Энэ арга нь **жигд дэвсгэр** дээр л ажиллана — студийн цагаан, цайвар
 * цэнхэр дэвсгэр яг тийм. Гэрийн орчны эмх замбараагүй дэвсгэрийг таних
 * боломжгүй тул тэр тохиолдолд `fitBackdrop`-ийн `uniform: false` дуудагч
 * талд дэвсгэр солихоо больж, зурагт хүрэлгүй орхихыг хэлдэг.
 */
export function backgroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance: number,
  bg?: Rgb,
  options: MaskOptions = {},
): Uint8Array {
  const n = width * height;
  const mask = new Uint8Array(n);
  const visited = new Uint8Array(n);

  /*
   * Тогтмол өнгийг ЗОРИУД өгсөн бол түүнийг хүндэтгэнэ — дуудагч тал
   * дэвсгэрийг өөрөө мэдэж байна гэсэн үг (тест, гараар сонгосон өнгө).
   */
  const backdrop: Backdrop =
    options.backdrop ??
    (bg
      ? { at: () => bg, uniform: true, residual: 0, spread: 0 }
      : fitBackdrop(data, width, height));

  const step = options.step ?? Math.max(8, tolerance * 0.35);
  const soft = options.soft ?? Math.max(6, tolerance * 0.5);

  const alphaAt = (p: number): number => {
    const x = p % width;
    const y = (p - x) / width;
    const d = colorDistance(data, p * 4, backdrop.at(x, y));
    if (d <= tolerance) return 255;
    if (d >= tolerance + soft) return 0;
    return Math.round(255 * (1 - (d - tolerance) / soft));
  };

  // Тодорхой хэмжээний стек — рекурс нь том зураг дээр стек халина.
  const stack: number[] = [];

  const push = (x: number, y: number, from: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;

    /*
     * Орон нутгийн тасралтгүй байдал. `from < 0` = ирмэгийн үр — хөрш
     * байхгүй тул зөвхөн ерөнхий шалгуураар шийднэ.
     */
    if (from >= 0) {
      const i = p * 4;
      const j = from * 4;
      const dr = data[i] - data[j];
      const dg = data[i + 1] - data[j + 1];
      const db = data[i + 2] - data[j + 2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) > step) return;
    }

    visited[p] = 1;
    const a = alphaAt(p);
    if (a === 0) return;

    mask[p] = a;
    /*
     * Зөвхөн БҮРЭН дэвсгэр пикселээс цааш тархана. Хагас тунгалаг зурвас
     * нь хил — түүгээр дамжуулбал үс рүү мөлхөж эхэлнэ.
     */
    if (a === 255) stack.push(x, y);
  };

  for (let x = 0; x < width; x += 1) {
    push(x, 0, -1);
    push(x, height - 1, -1);
  }
  for (let y = 0; y < height; y += 1) {
    push(0, y, -1);
    push(width - 1, y, -1);
  }

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const from = y * width + x;
    push(x + 1, y, from);
    push(x - 1, y, from);
    push(x, y + 1, from);
    push(x, y - 1, from);
  }

  if (options.fillPockets !== false) fillPockets(data, mask, width, height, tolerance, backdrop);

  return mask;
}

/**
 * Ирмэгээс ТУСГААРЛАГДСАН дэвсгэрийн нүхийг нөхнө.
 *
 * Үерийн дүүргэлт зөвхөн зургийн ирмэгээс эхэлдэг тул түүнтэй холбогдоогүй
 * дэвсгэрийн халаас хөндөгдөхгүй үлддэг:
 *
 *   • Үсний хооронд харагдах цоорхой
 *   • Гарны доогуур, эрүүний доорх зай
 *   • Нүдний шилний хүрээ доторх завсар
 *
 * Нөхөх нөхцөл нь хатуу: халаас нь ЖИЖИГ байх ба өнгө нь дэвсгэрийн
 * таамаглалд ойр байх. Хоёуланг нь шаардсанаар хүний биеийг санамсаргүй
 * идэхээс сэргийлнэ — бие бол том, өнгө нь холдоо.
 */
function fillPockets(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  tolerance: number,
  backdrop: Backdrop,
): void {
  const n = width * height;

  const candidate = new Uint8Array(n);
  for (let p = 0; p < n; p += 1) {
    if (mask[p] === 255) continue;
    const x = p % width;
    const y = (p - x) / width;
    if (colorDistance(data, p * 4, backdrop.at(x, y)) <= tolerance) candidate[p] = 1;
  }

  const reach = Math.max(3, Math.round(Math.min(width, height) * 0.05));
  const near = new Uint8Array(n);
  let frontier: number[] = [];
  for (let p = 0; p < n; p += 1) {
    if (mask[p] === 255) {
      near[p] = 1;
      frontier.push(p);
    }
  }
  for (let d = 0; d < reach && frontier.length > 0; d += 1) {
    const next: number[] = [];
    for (const p of frontier) {
      const x = p % width;
      const spread = (q: number) => {
        if (q < 0 || q >= n || near[q]) return;
        near[q] = 1;
        next.push(q);
      };
      if (x + 1 < width) spread(p + 1);
      if (x > 0) spread(p - 1);
      spread(p + width);
      spread(p - width);
    }
    frontier = next;
  }

  const seen = new Uint8Array(n);
  const maxArea = Math.max(64, Math.round(n * 0.01));
  const region: number[] = [];
  const stack: number[] = [];

  for (let start = 0; start < n; start += 1) {
    if (seen[start] || !candidate[start]) continue;

    region.length = 0;
    stack.length = 0;
    stack.push(start);
    seen[start] = 1;
    let touchesEdge = false;
    let tooBig = false;
    let tooDeep = false;

    while (stack.length > 0) {
      const p = stack.pop()!;
      region.push(p);
      const x = p % width;
      const y = (p - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      if (!near[p]) tooDeep = true;

      const visit = (q: number) => {
        if (q < 0 || q >= n || seen[q] || !candidate[q]) return;
        seen[q] = 1;
        stack.push(q);
      };
      if (x + 1 < width) visit(p + 1);
      if (x > 0) visit(p - 1);
      visit(p + width);
      visit(p - width);

      if (region.length > maxArea) {
        tooBig = true;
        break;
      }
    }

    /*
     * Ирмэгт хүрсэн бол энэ нь халаас биш. Жинхэнэ дэвсгэр байсан бол
     * үерийн дүүргэлт аль хэдийн авсан байх ёстой — аваагүй гэдэг нь
     * орон нутгийн шалгуур зориуд зогсоосон гэсэн үг. Дахин нээхгүй.
     */
    if (touchesEdge || tooBig || tooDeep) continue;

    for (const p of region) mask[p] = 255;
  }
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

/**
 * Дэвсгэрийг САРААЛ КАРТ болгон өнгөний хазайлтыг арилгана.
 *
 * ── Яагаад энэ нь баримтад ч аюулгүй вэ ──────────────────────────
 *
 * Энэ бол **үүсгэгч бус** засвар. Суваг бүрт ганц тогтмол коэффициент
 * үржүүлнэ. Хүний царайны БҮТЭЦ хөндөгдөхгүй, зөвхөн гэрлийн өнгө засагдана.
 *
 * Коэффициентийг хатуу хязгаарласан: маск буруу гарсан үед зургийг
 * сүйтгэхээс сэргийлнэ.
 */
export function autoWhiteBalance(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  maxGain = 1.35,
): { gain: [number, number, number]; applied: boolean } {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;

  for (let p = 0; p < mask.length; p += 1) {
    if (mask[p] < 250) continue;
    const i = p * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n += 1;
  }

  // Дэвсгэр хэт бага бол лавлагаа найдваргүй — хөндөхгүй.
  if (n < mask.length * 0.05) return { gain: [1, 1, 1], applied: false };

  r /= n;
  g /= n;
  b /= n;
  const target = (r + g + b) / 3;

  const clamp = (v: number) => Math.min(maxGain, Math.max(1 / maxGain, v));
  const gain: [number, number, number] = [
    clamp(target / Math.max(1, r)),
    clamp(target / Math.max(1, g)),
    clamp(target / Math.max(1, b)),
  ];

  // Хазайлт мэдэгдэхүйц биш бол хөндөхгүй — шаардлагагүй засвар хийхгүй.
  const drift = Math.max(...gain.map((v) => Math.abs(v - 1)));
  if (drift < 0.01) return { gain: [1, 1, 1], applied: false };

  for (let p = 0; p < mask.length; p += 1) {
    const i = p * 4;
    data[i] = Math.round(data[i] * gain[0]);
    data[i + 1] = Math.round(data[i + 1] * gain[1]);
    data[i + 2] = Math.round(data[i + 2] * gain[2]);
  }

  return { gain, applied: true };
}

/**
 * Тохиромжтой tolerance/soft — `backgroundMask` руу шууд дамжуулна.
 *
 * Утга нь `_to_delete`-ийн IdPhotoStudio дотор туршиж тогтоосон тогтмол
 * (харилцагчийн урсгалд тааруулах slider байхгүй — энгийн байлгах зорилготой).
 */
export const BACKGROUND_TOLERANCE = 42;
export const BACKGROUND_FEATHER_RADIUS = 2;
