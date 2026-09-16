/**
 * Нэг товчоор автомат сайжруулалт — гэрэлтүүлэг, контрастыг санал болгоно.
 *
 * ── Яагаад гистограммаар вэ ──────────────────────────────────────
 *
 * Пиксэл бүрийг шууд харах нь том зурагт удаан бөгөөд шаардлагагүй: 64×64
 * хэмжээнд багасгаад л ерөнхий гэрэлтүүлгийн тархалтыг мэдэж болно.
 * `getImageData`-г ХЭЗЭЭ Ч бүтэн нягтралтай canvas дээр дуудахгүй — 12MP
 * зурагт энэ нэг мөр интерфейсийг хэдэн секунд царцаана.
 *
 * Санал болгосон утга нь ХЯЗГААРЛАГДМАЛ — бүтэн ±100 хүрэхгүй. Аль хэдийн
 * сайн зураг «автоматаар» дахин будагдаж, зориудаар бараан авсан зураг
 * саарал болж хувирахаас сэргийлнэ. Хэрэглэгч дараа нь өөрөө гулсуургаар
 * нарийвчилж болно.
 */

/** 256 хэмжигдэхүүнтэй яркослын гистограм — индекс бүр 0-255 люма. */
export type Histogram = number[];

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

/**
 * Хуримтлагдсан гистограмаас өгөгдсөн хувиас доош орших люмаг олно.
 * Цөөн тооны цайвар/бараан «шуугиантай» пиксэлээс хамгаална (доод/дээд
 * ердөө нэг пиксэл байсан ч контраст хэт өндөр гарахаас сэргийлнэ).
 */
const percentile = (histogram: Histogram, total: number, fraction: number): number => {
  if (total <= 0) return 128;
  const target = total * fraction;
  let cumulative = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    cumulative += histogram[i];
    if (cumulative >= target) return i;
  }
  return histogram.length - 1;
};

/**
 * ЦЭВЭР функц — гистограмаас гэрэлтүүлэг/контрастын саналыг тооцоолно.
 * Canvas/DOM шаардахгүй тул нэгжийн тестээр шууд шалгагдана.
 */
export const suggestFromHistogram = (
  histogram: Histogram,
): { brightness: number; contrast: number } => {
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < histogram.length; i += 1) {
    total += histogram[i];
    weighted += histogram[i] * i;
  }
  if (total <= 0) return { brightness: 0, contrast: 0 };

  const mean = weighted / total;
  const brightness = Math.round(clamp(((128 - mean) / 128) * 80, -50, 50));

  const p2 = percentile(histogram, total, 0.02);
  const p98 = percentile(histogram, total, 0.98);
  const range = Math.max(1, p98 - p2);
  const factor = clamp(255 / range, 1, 1.8);
  const contrast = Math.round(clamp((factor - 1) * 100, 0, 50));

  return { brightness, contrast };
};

/** `ImageBitmap` ба `HTMLImageElement` хоёулаа энэ хэлбэрт тохирно. */
type Source = CanvasImageSource & { width?: number; height?: number };

/** Түүврийн canvas-ийн хэмжээ — ямар ч эх зурагт ижил, хямд зардал. */
const SAMPLE_SIZE = 64;

/**
 * Дэлгэц дээр аль хэдийн ачаалагдсан зургаас (жишээ нь тайрах цонхны
 * `<img>`) шинээр татаж, задлахгүйгээр саналыг гаргана.
 */
export const suggestAdjust = (source: Source): { brightness: number; contrast: number } => {
  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { brightness: 0, contrast: 0 };

  ctx.drawImage(source, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const histogram: Histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    histogram[Math.round(clamp(luma, 0, 255))] += 1;
  }

  return suggestFromHistogram(histogram);
};
