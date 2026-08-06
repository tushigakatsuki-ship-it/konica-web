/**
 * Үйлчилгээний нэрнээс цаасны хэмжээг таних туслах.
 *
 * Каталогийн нэрс хоёр хэлбэртэй байдаг:
 *   'Зураг угаалт 10*15'          → 10 × 15 см
 *   'Хэвлэл: Фото цаас А4 200гр'  → A цуврал цаас
 *
 * Хэмжээг мэдсэнээр хэвлэлийн хуудсан дээр зөв харьцаатай урьдчилсан
 * харагдац (preview) зурж, зургийг тухайн харьцаагаар нь тайрч болно.
 */

export interface PhotoSize {
  /** Өргөн, сантиметрээр. */
  w: number;
  /** Өндөр, сантиметрээр. */
  h: number;
  /** Хүнд харуулах шошго — '10×15 см' эсвэл 'А4'. */
  label: string;
}

/** ISO A цуврал — миллиметрийг сантиметр болгосон. */
const PAPER: Readonly<Record<string, { w: number; h: number }>> = {
  '3': { w: 29.7, h: 42 },
  '4': { w: 21, h: 29.7 },
  '5': { w: 14.8, h: 21 },
};

/** '6*9', '10 x 15', '30×40' — латин/кирилл х, *, × бүгдийг барина. */
const DIMENSION = /(\d+(?:[.,]\d+)?)\s*[*x×хХ]\s*(\d+(?:[.,]\d+)?)/;

/** 'А4', 'A3' — кирилл А болон латин A хоёуланг нь. */
const A_SERIES = /[АA]\s?([345])(?!\d)/;

const num = (raw: string): number => Number(raw.replace(',', '.')) || 0;

/**
 * Нэрнээс хэмжээг гаргана. Таних боломжгүй бол `null`.
 * '60*40-50*40' мэт олон хэмжээтэй нэрнээс эхнийхийг нь авна.
 */
export const parsePhotoSize = (name: string): PhotoSize | null => {
  const dim = name.match(DIMENSION);
  if (dim) {
    const w = num(dim[1]);
    const h = num(dim[2]);
    if (w > 0 && h > 0) return { w, h, label: `${dim[1]}×${dim[2]} см` };
  }

  const paper = name.match(A_SERIES);
  if (paper) {
    const size = PAPER[paper[1]];
    if (size) return { ...size, label: `А${paper[1]}` };
  }

  return null;
};

/** Хэмжээ танигдаагүй үед ашиглах аюулгүй утга (10×15). */
export const FALLBACK_SIZE: PhotoSize = { w: 10, h: 15, label: '10×15 см' };

export const sizeOf = (name: string): PhotoSize =>
  parsePhotoSize(name) ?? FALLBACK_SIZE;

/** Хэвлэлийн стандарт нягтрал. */
export const PRINT_DPI = 300;

/** `300 dpi`-д хэрэгтэй пикселийн доод хэмжээ — '1181 × 1772 px'. */
export const recommendedPixels = (size: PhotoSize): string => {
  const px = (cm: number) => Math.round((cm / 2.54) * PRINT_DPI);
  return `${px(size.w)} × ${px(size.h)} px`;
};

/**
 * Preview хайрцгийг өгөгдсөн хүрээнд багтаах бодит px хэмжээ.
 * Картан дээрх жижиг харьцааны зураас зурахад хэрэглэнэ.
 */
export const fitBox = (
  size: PhotoSize,
  maxW: number,
  maxH: number,
): { width: number; height: number } => {
  const scale = Math.min(maxW / size.w, maxH / size.h);
  return {
    width: Math.round(size.w * scale),
    height: Math.round(size.h * scale),
  };
};
