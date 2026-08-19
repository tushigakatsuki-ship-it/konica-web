/**
 * Canvas үүсгэх — үндсэн урсгал болон Worker хоёуланд ажиллана.
 *
 * ── Яагаад хэрэгтэй вэ ───────────────────────────────────────────
 *
 * Worker дотор `document` БАЙХГҮЙ. `document.createElement('canvas')` нь
 * тэнд шууд унана. Гэвч зургийн боловсруулалт яг Worker-т явах ёстой —
 * эс бөгөөс 10 зураг боловсруулах үед интерфейс царцана.
 *
 * `OffscreenCanvas` нь Worker-т ажилладаг бөгөөд орчин үеийн бүх хөтөч
 * дэмждэг. Хуучин хөтөч дээр `document` рүү буцна.
 *
 * Энэ ялгааг НЭГ газар нуусан нь чухал: тарсан `typeof document` шалгалт
 * нь нэгийг нь мартахад Worker чимээгүй унана.
 */

export type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

/** Worker-т ажилладаг эсэх. */
export const hasOffscreen = (): boolean => typeof OffscreenCanvas !== 'undefined';

export function createCanvas(width: number, height: number): AnyCanvas {
  if (hasOffscreen()) return new OffscreenCanvas(width, height);

  if (typeof document === 'undefined') {
    throw new Error('Энэ хөтөч дээр зураг боловсруулах боломжгүй байна.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** 2D контекст — хоёр төрлийн canvas-д нийтлэг хэсгийг нь буцаана. */
export function context2d(canvas: AnyCanvas): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Зураг боловсруулах орчин бэлдэж чадсангүй.');
  return ctx as CanvasRenderingContext2D;
}

/** Canvas-аас Blob — `toBlob` (DOM) ба `convertToBlob` (Worker) хоёр өөр. */
export async function canvasToBlob(
  canvas: AnyCanvas,
  type = 'image/jpeg',
  quality = 0.95,
): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality });

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality),
  );
  if (!blob) throw new Error('Зургийг файл болгож чадсангүй.');
  return blob;
}
