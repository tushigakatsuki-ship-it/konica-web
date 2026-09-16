/**
 * Гар аргаар тохируулах загвар — эргүүлэх, гэрэлтүүлэг/контраст, шүүлтүүр.
 *
 * `crop.ts`-тэй ЯГ ижил зарчим: НОРМАЛЧЛАГДСАН утга хадгална, ганц функц
 * (`cssFilterFor`) урьдчилсан харагдац (CSS `filter`) БОЛОН хэвлэх файл
 * (canvas `ctx.filter`) хоёрыг тэжээнэ. Хоёр газар тусад нь бодвол
 * дэлгэц дээрх зураг хэвлэгдсэнээсээ ялгаатай өнгөтэй гарах эрсдэлтэй.
 */

/** Дэлгэцийн шүүлтүүр — цөөн, тодорхой сонголт. «Хялбар хэрэгсэл» учир
 * Photoshop шиг олон тохиргоо биш, боловсруулсан цөөн загвар л өгнө. */
export type FilterPreset = 'none' | 'bw' | 'warm' | 'cool' | 'vivid';

export interface Adjust {
  /** 90°-ын үржвэрээр эргүүлнэ. Дурын өнцгөөр «тэгшлэх» дэмжихгүй — тэр нь
   * хүрээний булан хоосон гарах эрсдэлтэй, харин 90°-ын алхам үргэлж яг таарна. */
  rotate: 0 | 90 | 180 | 270;
  /** -100..100. 0 = хөндөөгүй. */
  brightness: number;
  /** -100..100. 0 = хөндөөгүй. */
  contrast: number;
  filter: FilterPreset;
}

export const DEFAULT_ADJUST: Adjust = { rotate: 0, brightness: 0, contrast: 0, filter: 'none' };

const ROTATE_VALUES = [0, 90, 180, 270] as const;

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

const isRotateValue = (value: unknown): value is Adjust['rotate'] =>
  typeof value === 'number' && (ROTATE_VALUES as readonly number[]).includes(value);

const isFilterPreset = (value: unknown): value is FilterPreset =>
  value === 'none' || value === 'bw' || value === 'warm' || value === 'cool' || value === 'vivid';

/** Гаднаас ирсэн дурын утгыг аюулгүй болгоно (localStorage-оос уншсан ч байж болно). */
export const normalizeAdjust = (adjust: Partial<Adjust> | null | undefined): Adjust => {
  if (!adjust) return DEFAULT_ADJUST;
  return {
    rotate: isRotateValue(adjust.rotate) ? adjust.rotate : 0,
    brightness: Number.isFinite(adjust.brightness) ? clamp(adjust.brightness as number, -100, 100) : 0,
    contrast: Number.isFinite(adjust.contrast) ? clamp(adjust.contrast as number, -100, 100) : 0,
    filter: isFilterPreset(adjust.filter) ? adjust.filter : 'none',
  };
};

/** Хэрэглэгч огт хөндөөгүй юу — «Буцаах» товч, «Засварласан» тэмдгийг тавихад. */
export const isDefaultAdjust = (adjust: Adjust): boolean =>
  adjust.rotate === 0 && adjust.brightness === 0 && adjust.contrast === 0 && adjust.filter === 'none';

/**
 * Шүүлтүүр загвар тус бүрийн CSS `filter` хэлхээ.
 *
 * ⚠️ CSS filter-т жинхэнэ цагаан тэнцвэржилт (сувгаар тусад нь тохируулах)
 * байдаггүй тул `cool` бол зөвхөн ойролцоо, хэв маягийн ойлголт — жинхэнэ
 * температурын гулсуур биш.
 */
const PRESET_CHAIN: Record<FilterPreset, string> = {
  none: '',
  bw: 'grayscale(1) contrast(1.08)',
  warm: 'sepia(0.35) saturate(1.3) hue-rotate(-6deg)',
  cool: 'saturate(1.15) hue-rotate(-12deg) brightness(1.02)',
  vivid: 'saturate(1.45) contrast(1.1) brightness(1.02)',
};

/**
 * Нэг CSS filter мөр — canvas-ийн `ctx.filter`, `<img style>`-ийн `filter`
 * ХОЁУЛАНД шууд ашиглана. Дараалал: гэрэлтүүлэг → контраст → загвар.
 */
export const cssFilterFor = (adjust: Adjust): string => {
  const parts: string[] = [];
  if (adjust.brightness !== 0) parts.push(`brightness(${(1 + adjust.brightness / 100).toFixed(3)})`);
  if (adjust.contrast !== 0) parts.push(`contrast(${(1 + adjust.contrast / 100).toFixed(3)})`);
  const preset = PRESET_CHAIN[adjust.filter];
  if (preset) parts.push(preset);
  return parts.join(' ');
};
