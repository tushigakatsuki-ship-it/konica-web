/**
 * Нүүр илрүүлэх **порт**.
 *
 * Дуудагч тал зөвхөн `FaceDetector` гэрээг мэднэ. Хэрэгжүүлэлтийг солиход
 * (MediaPipe Face Mesh, TFJS BlazeFace г.м.) бусад код өөрчлөгдөхгүй —
 * `src/pages/IdPhotoStudio.tsx` дэх `detect` хувьсагчийг л сольно.
 *
 * ── Яагаад Haar cascade биш вэ ────────────────────────────────────
 *
 * Анхны төлөвлөгөө нь OpenCV-ийн Haar cascade байсан. Гэвч энэ хэрэгсэл нь
 * **студийн зураг** дээр ажилладаг бөгөөд дэлгүүрийн өөрийн шаардлага нь
 * «цагаан эсвэл цайвар цэнхэр дэвсгэр» гэж заасан. Жигд дэвсгэртэй зурагт
 * **дүрсийн хүрээ (silhouette)** нь Haar-аас илүү найдвартай:
 *
 *   • Haar нь урдаас, сайн гэрэлтэй зурагт л сайн — хажуу эргэсэн, сүүдэртэй
 *     зурагт алддаг. Дүрсийн хүрээ нь эргэлт, сүүдэрт огт мэдрэг биш.
 *   • Haar нь opencv.js (~8MB) татна. Дүрсийн хүрээ нь бидний АЛЬ ХЭДИЙН
 *     тооцдог дэвсгэрийн маскаас гардаг — нэмэлт байт тэг.
 *   • Haar нь нүүрийг олдог; бидэнд толгойн ОРОЙ хэрэгтэй (стандарт нь
 *     эрүүнээс орой хүртэлх өндрөөр хэмждэг). Haar-ын хайрцгаас орой руу
 *     таамаглах нь дахиад л ойролцоо утга болно.
 *
 * Эмх замбараагүй дэвсгэртэй зурагт дүрсийн хүрээ ажиллахгүй — тэр
 * тохиолдолд хөтөчийн `FaceDetector` API (байвал) руу шилжинэ, эсвэл
 * `null` буцааж ГАРААР байрлуулахыг шаардана.
 */

import { backgroundMask, borderColor } from './idPhoto';
import { context2d, createCanvas } from './canvas';

export interface FaceBox {
  /** Толгойн орой (эх зургийн пикселээр). */
  x: number;
  y: number;
  /** Толгойн өргөн, өндөр — эрүүнээс орой хүртэл. */
  w: number;
  h: number;
}

export interface FaceResult {
  box: FaceBox;
  source: 'silhouette' | 'native';
  /**
   * `low` бол интерфейс сэрэмжлүүлж, ажилтныг шалгахыг хүснэ.
   * Хэзээ ч чимээгүй өнгөрөөхгүй — буруу таслагдсан зураг хэвлэгдэхээс
   * дахин авахыг хүсэх нь хямд.
   */
  confidence: 'high' | 'low';
  /**
   * Илэрсэн хүний тоо. `undefined` = илрүүлэгч тоолж ЧАДААГҮЙ.
   *
   * Энэ ялгаа чухал: «мэдэхгүй» гэдгийг «нэг байна» гэж дүрслэх нь худал
   * баталгаа болно. Хоёр хүнтэй зураг чимээгүй өнгөрөх нь дээрх худал
   * баталгаанаас үүдэлтэй байх магадлалтай.
   */
  faceCount?: number;
}

export type FaceDetector = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => Promise<FaceResult | null>;

/**
 * Толгойн өндөр / өргөний антропометрийн харьцаа.
 *
 * Хүний толгой (эрүүнээс орой) нь өргөнөөсөө ойролцоогоор 1.3–1.4 дахин
 * урт. Дүрсийн хүрээнээс өргөнийг шууд хэмжиж болох тул өндрийг үүгээр
 * гаргана — эрүүний шугамыг силуэтээс ялгах боломжгүй (хүзүү залгаа).
 */
const HEAD_ASPECT = 1.35;

/** Мөр «хүнтэй» гэж тооцогдоход хэрэгтэй хамгийн бага пикселийн эзлэх хувь. */
const MIN_ROW_FILL = 0.02;

interface RowRun {
  left: number;
  right: number;
  width: number;
}

/** Мөр доторх хүний пикселийн ЗАЛГАА бүх хэсэг. */
const runsIn = (person: Uint8Array, width: number, y: number): RowRun[] => {
  const runs: RowRun[] = [];
  let start = -1;
  for (let x = 0; x <= width; x += 1) {
    const filled = x < width && person[y * width + x] > 127;
    if (filled && start === -1) start = x;
    if (!filled && start !== -1) {
      runs.push({ left: start, right: x - 1, width: x - start });
      start = -1;
    }
  }
  return runs;
};

/** Мөр доторх хүний пикселийн ЗАЛГАА хамгийн урт хэсэг. */
const longestRun = (
  person: Uint8Array,
  width: number,
  y: number,
): RowRun | null => {
  let best: RowRun | null = null;
  let start = -1;

  for (let x = 0; x <= width; x += 1) {
    const filled = x < width && person[y * width + x] > 127;
    if (filled && start === -1) start = x;
    if (!filled && start !== -1) {
      const run = { left: start, right: x - 1, width: x - start };
      if (!best || run.width > best.width) best = run;
      start = -1;
    }
  }
  return best;
};

/**
 * Дүрсийн хүрээнээс толгойн хайрцгийг гаргана.
 *
 * Алхмууд:
 *   1. Дэвсгэрийн маскийг урвуулж «хүн» маск гаргана
 *   2. Дээрээс доош явж, анх хангалттай дүүрсэн мөрийг олно → толгойн орой
 *   3. Дээд 40% дотор хамгийн өргөн мөрийг олно → толгойн өргөн, төв
 *   4. Өндрийг антропометрийн харьцаагаар тооцно
 */
export function faceFromSilhouette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tolerance = 60,
): FaceResult | null {
  const bg = borderColor(data, width, height);
  const mask = backgroundMask(data, width, height, tolerance, bg);

  const person = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) person[i] = mask[i] > 127 ? 0 : 255;

  const minFill = Math.max(2, Math.round(width * MIN_ROW_FILL));

  let crown = -1;
  for (let y = 0; y < height; y += 1) {
    const run = longestRun(person, width, y);
    if (run && run.width >= minFill) {
      crown = y;
      break;
    }
  }

  /*
   * Орой олдоогүй = дэвсгэр бүх зургийг эзэлсэн, эсвэл хүн ирмэгээс шүргэсэн.
   * Хоёуланд нь таамаглаж таслах нь буруу — `null` буцаана.
   */
  if (crown === -1 || crown > height * 0.5) return null;

  /*
   * Толгойн өргөнийг олох: оройноос доош явж, өргөн нь ӨСӨӨД дараа нь
   * огцом БУУРАХ цэгийг хайна — тэр нь хүзүү.
   *
   * Зүгээр «дээд 40% доторх хамгийн өргөн мөр» гэж авбал МӨРийг толгой гэж
   * үзнэ: мөр нь толгойноос 2–3 дахин өргөн бөгөөд ихэвчлэн тэр мужид
   * ордог. Хүзүү дээр зогсоох нь энэ алдааг бүрмөсөн хаана.
   */
  const searchTo = Math.min(height - 1, Math.round(height * 0.6));

  let widest: RowRun | null = null;
  let widestY = crown;

  for (let y = crown; y <= searchTo; y += 1) {
    const run = longestRun(person, width, y);
    if (!run) break;

    if (!widest || run.width > widest.width) {
      widest = run;
      widestY = y;
      continue;
    }

    // Дээд өргөнөөс 60% доош унавал эрүү/хүзүүнд хүрсэн гэж үзээд зогсоно.
    if (run.width < widest.width * 0.6) break;
  }
  if (!widest) return null;

  const headW = widest.width;
  const headH = Math.round(headW * HEAD_ASPECT);
  const centerX = (widest.left + widest.right) / 2;

  /*
   * Итгэл багатай тохиолдлууд:
   *   • Толгой хэт жижиг — хүн хол зогссон эсвэл дэвсгэр буруу танигдсан
   *   • Толгой хэт том — мөр толгойтой хамт орсон байх магадлалтай
   *   • Хамгийн өргөн мөр нь оройноос хэт хол — мөрийг толгой гэж үзсэн байж болзошгүй
   */
  /*
   * Хэдэн хүн байна вэ — толгойн мөрөнд хэдэн ТУСДАА бүлэг байгааг тоолно.
   *
   * Энэ бол болгоомжтой дохио: зэрэгцэн зогссон хоёр хүнийг барина, харин
   * нэг нь нөгөөгөө халхалсан бол алдана. Тиймээс зөвхөн 2 ба түүнээс
   * дээш үед л тоо буцаана — «яг нэг хүн байна» гэж БАТЛАХГҮЙ.
   */
  const headRuns = runsIn(person, width, widestY).filter((r) => r.width >= headW * 0.5);
  const faceCount = headRuns.length >= 2 ? headRuns.length : undefined;

  const ratio = headW / width;
  const farFromCrown = widestY - crown > headH * 1.2;
  const confidence: FaceResult['confidence'] =
    ratio < 0.15 || ratio > 0.85 || farFromCrown ? 'low' : 'high';

  return {
    box: {
      x: Math.round(centerX - headW / 2),
      y: crown,
      w: headW,
      h: headH,
    },
    source: 'silhouette',
    confidence,
    faceCount,
  };
}

/**
 * Хөтөчийн `FaceDetector` API — байвал.
 *
 * Chrome дээр л байдаг, стандартчлагдаагүй. Эмх замбараагүй дэвсгэртэй
 * зурагт дүрсийн хүрээ ажиллахгүй үед туслах зам болно.
 *
 * Хайрцаг нь НҮҮРийг (хөмсөгнөөс эрүү) барьдаг тул толгойн орой руу
 * тэлж, стандартын хэмжилттэй нийцүүлнэ.
 */
export async function faceFromBrowser(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<FaceResult | null> {
  const Detector = (globalThis as { FaceDetector?: new (o?: unknown) => unknown })
    .FaceDetector;
  if (!Detector) return null;

  try {
    /*
     * Worker дотор `document` байхгүй тул `createCanvas` нь OffscreenCanvas
     * буцаана. Энд `document.createElement` шууд дуудвал багц боловсруулалт
     * Worker-т орох үед чимээгүй унана.
     */
    const canvas = createCanvas(width, height);
    const ctx = context2d(canvas);
    // `Uint8ClampedArray`-г шинэ буфер рүү хуулна — `ImageData` нь
    // `ArrayBuffer`-т суурилсан массив шаарддаг.
    const image = ctx.createImageData(width, height);
    image.data.set(data);
    ctx.putImageData(image, 0, 0);

    // Хоёр хүнтэй зургийг ИЛРҮҮЛЭХИЙН тулд нэгээс олныг асууна.
    const detector = new Detector({ maxDetectedFaces: 5, fastMode: false }) as {
      detect(source: CanvasImageSource): Promise<{ boundingBox: DOMRectReadOnly }[]>;
    };
    const faces = await detector.detect(canvas as CanvasImageSource);
    if (faces.length === 0) return null;

    const box = faces[0].boundingBox;

    /*
     * Нүүрний хайрцгаас толгойн хайрцаг руу.
     *
     * `FaceDetector` нь хөмсөгнөөс эрүү хүртэлх хэсгийг барьдаг тул үс,
     * толгойн орой багтдаггүй. Стандарт нь ОРОЙгоос хэмждэг учир дээш
     * ~45% тэлнэ (эмпирик утга).
     */
    const grow = box.height * 0.45;
    return {
      box: {
        x: Math.round(box.x - box.width * 0.1),
        y: Math.round(box.y - grow),
        w: Math.round(box.width * 1.2),
        h: Math.round(box.height + grow),
      },
      source: 'native',
      confidence: 'low',
      faceCount: faces.length,
    };
  } catch {
    return null;
  }
}

/**
 * Анхдагч илрүүлэгч: дүрсийн хүрээ → хөтөчийн API.
 *
 * MediaPipe руу шилжих: энэ функцийн оронд ижил гэрээтэй өөр функц өгнө.
 * Бусад код өөрчлөгдөхгүй.
 */
export const detectFace: FaceDetector = async (data, width, height) =>
  faceFromSilhouette(data, width, height) ??
  (await faceFromBrowser(data, width, height));
