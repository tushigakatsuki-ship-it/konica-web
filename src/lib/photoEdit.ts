/**
 * Зураг засварын төлөв ба түүнийг canvas дээр буулгах логик.
 *
 * Урьдчилсан харагдац CSS `transform`/`filter`-ээр зурагддаг тул энд бичсэн
 * canvas хувиргалт нь яг тэр дарааллыг давтана:
 *
 *   translate(offset) → scale(zoom) → rotate → flip
 *
 * (CSS-д жагсаалт нь зүүнээс баруун тийш хэрэглэгддэг бөгөөд canvas-ийн
 * ctx.translate/rotate/scale дуудлагууд ч мөн адил дарааллаар нийлдэг.)
 */

import { PRINT_DPI, type PhotoSize } from './photoSize';

export type Finish = 'Гялгар' | 'Матт';

export const FINISHES: readonly Finish[] = ['Гялгар', 'Матт'];

export interface PhotoEdits {
  /** 1 = зөвхөн хүрээг дүүргэсэн байдал, 3 = 3 дахин том. */
  zoom: number;
  /** Хүрээний өргөн/өндрийн харьцаагаар илэрхийлсэн шилжилт (−0.5…0.5). */
  offsetX: number;
  offsetY: number;
  /** 0 | 90 | 180 | 270 */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  /** Хувиар — 100 нь өөрчлөлтгүй. */
  brightness: number;
  contrast: number;
  saturation: number;
  finish: Finish;
}

export const DEFAULT_EDITS: PhotoEdits = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  finish: 'Гялгар',
};

export const isEdited = (e: PhotoEdits): boolean =>
  e.zoom !== 1 ||
  e.offsetX !== 0 ||
  e.offsetY !== 0 ||
  e.rotation !== 0 ||
  e.flipH ||
  e.flipV ||
  e.brightness !== 100 ||
  e.contrast !== 100 ||
  e.saturation !== 100;

/** CSS `filter` мөр — preview болон canvas хоёулаа үүнийг ашиглана. */
export const filterCss = (e: PhotoEdits): string =>
  `brightness(${e.brightness}%) contrast(${e.contrast}%) saturate(${e.saturation}%)`;

/**
 * 90°/270° эргүүлэхэд `cover` масштаб хүрээг дүүргэхээ болих тул нэмэлт
 * коэффициент хэрэгтэй болдог. Хэрэглэгчийн zoom-ыг өөрчлөхгүйгээр цагаан
 * зай үлдэхээс сэргийлнэ.
 */
export const rotationBoost = (
  size: PhotoSize,
  imgW: number,
  imgH: number,
  rotation: number,
): number => {
  if (!imgW || !imgH || rotation % 180 === 0) return 1;
  const frameW = 1;
  const frameH = size.h / size.w;
  const cover = Math.max(frameW / imgW, frameH / imgH);
  const drawW = imgW * cover;
  const drawH = imgH * cover;
  return Math.max(1, frameW / drawH, frameH / drawW);
};

/** CSS `transform` мөр — preview дээрх <img> дээр тавина. */
export const transformCss = (e: PhotoEdits, boost = 1): string =>
  [
    `translate(${e.offsetX * 100}%, ${e.offsetY * 100}%)`,
    `scale(${e.zoom * boost})`,
    `rotate(${e.rotation}deg)`,
    `scaleX(${e.flipH ? -1 : 1})`,
    `scaleY(${e.flipV ? -1 : 1})`,
  ].join(' ');

/** Шилжилтийг хэт хол гаргахгүй барих. */
export const clampOffset = (value: number): number =>
  Math.max(-0.5, Math.min(0.5, value));

/** Засварыг тусгасан canvas үүсгэнэ. `outW` нь эцсийн өргөн (px). */
const drawEdited = (
  image: HTMLImageElement,
  size: PhotoSize,
  edits: PhotoEdits,
  outW: number,
): HTMLCanvasElement | null => {
  const outH = Math.max(1, Math.round(outW * (size.h / size.w)));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Цагаан дэвсгэр — эргүүлэлтээс болж ирмэг гарвал хэвлэхэд ил тод биш байх.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  // Зарим хөтөч дээр ctx.filter байхгүй — байвал л хэрэглэнэ.
  if ('filter' in ctx) ctx.filter = filterCss(edits);
  ctx.imageSmoothingQuality = 'high';

  // `object-fit: cover`-той ижил суурь масштаб.
  const cover = Math.max(outW / image.naturalWidth, outH / image.naturalHeight);
  const drawW = image.naturalWidth * cover;
  const drawH = image.naturalHeight * cover;
  const boost = rotationBoost(size, image.naturalWidth, image.naturalHeight, edits.rotation);

  ctx.translate(outW / 2 + edits.offsetX * outW, outH / 2 + edits.offsetY * outH);
  ctx.scale(edits.zoom * boost, edits.zoom * boost);
  ctx.rotate((edits.rotation * Math.PI) / 180);
  ctx.scale(edits.flipH ? -1 : 1, edits.flipV ? -1 : 1);
  ctx.drawImage(image, -drawW / 2, -drawH / 2, drawW, drawH);

  return canvas;
};

/**
 * Захиалгын жагсаалтад харуулах бяцхан зураг (data URL).
 * Файл өөрөө браузераас хальж гарахгүй.
 */
export const renderPreview = (
  image: HTMLImageElement,
  size: PhotoSize,
  edits: PhotoEdits,
  maxWidth = 640,
): string => {
  const outW = Math.min(maxWidth, Math.max(160, image.naturalWidth || maxWidth));
  return drawEdited(image, size, edits, outW)?.toDataURL('image/jpeg', 0.82) ?? '';
};

/** Зургийн нягтрал хүрэхгүй бол хиймлээр томруулахгүй — энэ доод хязгаар хүртэл. */
const MIN_DPI = 150;

/**
 * Хэвлэхэд бэлэн файл — сонгосон хэмжээний ЯГ харьцаатай, 300dpi-д
 * тохирсон пикселтэй JPEG.
 *
 * Хиймэл томруулалт хийхгүй: эх зураг 300dpi хүрэхгүй бол байгаа нягтралаараа
 * (гэхдээ 150dpi-аас доошгүй) гаргана. Ингэснээр файл дэмий томордоггүй бөгөөд
 * бодит нарийвчлал ч нэмэгддэггүй — зөвхөн уншиж чадахуйц дүрс үүснэ.
 */
export const renderPrintBlob = (
  image: HTMLImageElement,
  size: PhotoSize,
  edits: PhotoEdits,
): Promise<Blob | null> => {
  const target = Math.round((size.w / 2.54) * PRINT_DPI);
  const floor = Math.round((size.w / 2.54) * MIN_DPI);
  // Эх зургаас гарах бодит өргөн — `cover` тул богино талаараа хязгаарлагдана.
  const available = Math.round(
    Math.min(image.naturalWidth, image.naturalHeight * (size.w / size.h)) * edits.zoom,
  );
  const outW = Math.max(floor, Math.min(target, available || target));

  const canvas = drawEdited(image, size, edits, outW);
  if (!canvas) return Promise.resolve(null);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.92);
  });
};
