/**
 * Харилцагчийн зураг засварын тохиргоо — зөвхөн Цээж зураг ангилалд.
 *
 * `crop.ts`-тэй ЗЭРЭГЦЭЭ, гэхдээ тусдаа файлд: тайралт (crop) ба
 * гэрэлтүүлэг/дэвсгэр (adjust) хоёр өөр асуудал, өөр амьдралын мөчлөгтэй.
 */

export interface Adjust {
  /** -40..40, 0 = анхдагч. Canvas/CSS `filter: brightness()`-ийн үндэс. */
  brightness: number;
  /** 0..2 (px, 640px урьдчилсан харагдацын нягтралд). */
  blur: number;
  /** Тогтмол хүчтэй kernel — slider биш, зүгээр асаалттай/унтраалттай. */
  sharpen: boolean;
  bg: 'none' | 'white' | 'lightblue';
}

export const DEFAULT_ADJUST: Adjust = {
  brightness: 0,
  blur: 0,
  sharpen: false,
  bg: 'none',
};

/** `true` бол `drawCover`-т ямар ч нэмэлт зурах ажил хийх шаардлагагүй. */
export const isDefaultAdjust = (adjust: Adjust): boolean =>
  adjust.brightness === 0 && adjust.blur === 0 && !adjust.sharpen && adjust.bg === 'none';

/**
 * `brightness` (-40..40) → CSS/canvas `filter: brightness()`-ийн коэффициент
 * (0.7..1.3). Шугаман зураглал — 0 үед яг 1 (өөрчлөлтгүй).
 */
export const brightnessFilterValue = (brightness: number): number => 1 + brightness * 0.0075;

/**
 * Blur радиусыг ГАРАЛТЫН нягтралаар хэмжээлнэ.
 *
 * ⚠️ ЗААВАЛ. `blur` утга нь 640px урьдчилсан харагдацад зориулагдсан тул
 * тэр чигээр нь 3500px+ хэвлэлийн canvas дээр хэрэглэвэл дэлгэц дээрх
 * бүдгэрэлт хэвлэсэн зурагт бараг үл ажиглагдах болно (эсвэл эсрэгээрээ,
 * жижиг preview дээр хэт хүчтэй харагдана). Preview болон хэвлэх файл ЯГ
 * ижил харагдах ёстой гэсэн `photoRender.ts`-ийн үндсэн баталгааг үүгээр
 * хадгална.
 */
export const scaledBlurPx = (blur: number, outW: number, referenceW = 640): number =>
  blur * (outW / referenceW);
