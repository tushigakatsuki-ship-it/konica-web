/**
 * Цээж зураг боловсруулах бүтэн дамжлага — DOM-гүй.
 *
 * ⚠️ Энэ модуль `document`, `window`-д хүрч БОЛОХГҮЙ: Worker дотроос
 * дуудагддаг. Canvas хэрэгтэй бол `lib/canvas.ts` — тэр нь OffscreenCanvas
 * руу шилждэг.
 *
 * Worker БАЙХГҮЙ хөтөч дээр үндсэн урсгалаас яг энэ функц дуудагдана.
 * Тиймээс дамжлага НЭГ л газар бичигдсэн — Worker болон fallback хоёрын
 * хооронд зөрөх боломжгүй.
 */

import {
  applyBackground,
  autoWhiteBalance,
  backgroundMask,
  cropForFace,
  featherMask,
  fitBackdrop,
  ID_SIZES,
  zoomCrop,
  type IdSize,
  type Rgb,
} from './idPhoto';
import { detectFace } from './faceDetect';
import { segmentWithModel } from './segment';
import { checkQuality, type Check } from './quality';
import { canvasToBlob, context2d, createCanvas } from './canvas';

/** Нүүр хайх ажлын зургийн өргөн — жижигрүүлж хурдасгана. */
const DETECT_W = 480;

export interface ProcessRequest {
  id: number;
  blob: Blob;
  /** `ID_SIZES` доторх индекс — бүтэн объект дамжуулах шаардлагагүй. */
  sizeIndex: number;
  /** Дэвсгэрийн өнгө. `null` = хэвээр үлдээнэ. */
  background: Rgb | null;
  tolerance: number;
  /** Гаралтын өндөр пикселээр (300dpi). */
  outHeight: number;
}

export interface ProcessResponse {
  id: number;
  ok: boolean;
  /** Хэвлэхэд бэлэн JPEG. */
  blob?: Blob;
  checks?: Check[];
  /** Дэвсгэр салгалтад аль хөдөлгүүр ажиллав. */
  engine?: 'silhouette' | 'u2net';
  /** Хэрэглэгчид харуулах ЭНГИЙН шалтгаан. */
  reason?: string;
}

export async function processPhoto(request: ProcessRequest): Promise<ProcessResponse> {
  const size: IdSize = ID_SIZES[request.sizeIndex] ?? ID_SIZES[0];
  const bitmap = await createImageBitmap(request.blob);

  try {
    /* ── 1. Нүүр олох — жижигрүүлсэн хуулбар дээр ────────────── */
    const scale = Math.min(1, DETECT_W / bitmap.width);
    const dw = Math.max(1, Math.round(bitmap.width * scale));
    const dh = Math.max(1, Math.round(bitmap.height * scale));

    const work = createCanvas(dw, dh);
    const workCtx = context2d(work);
    workCtx.drawImage(bitmap, 0, 0, dw, dh);

    const found = await detectFace(workCtx.getImageData(0, 0, dw, dh).data, dw, dh);

    /*
     * Нүүр олдоогүй бол ЗОРИУД таслахгүй. Таамгаар таслаад хэвлэвэл
     * толгой тасарсан зураг гарна. Багцын энэ мөр алдаатай гэж
     * тэмдэглэгдэж, ажилтан гараар засна.
     */
    if (!found) {
      return { id: request.id, ok: false, reason: 'Нүүр олдсонгүй' };
    }

    if (found.faceCount !== undefined && found.faceCount > 1) {
      return {
        id: request.id,
        ok: false,
        reason: `Зурагт ${found.faceCount} хүн байна`,
      };
    }

    // Ажлын хуулбарын координатыг эх зураг руу буцаана.
    const face = {
      x: found.box.x / scale,
      y: found.box.y / scale,
      w: found.box.w / scale,
      h: found.box.h / scale,
    };

    /* ── 2. Автомат тайралт ──────────────────────────────────── */
    const auto = cropForFace(face, size, bitmap.width, bitmap.height);
    const crop = zoomCrop(
      auto.rect,
      { x: auto.rect.x + auto.rect.w / 2, y: auto.rect.y + auto.rect.h / 2 },
      1,
      bitmap.width,
      bitmap.height,
    );

    /* ── 3. Гаралт зурах ─────────────────────────────────────── */
    const outH = request.outHeight;
    const outW = Math.round(outH * (size.w / size.h));

    const canvas = createCanvas(outW, outH);
    const ctx = context2d(canvas);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);

    const image = ctx.getImageData(0, 0, outW, outH);
    let engine: 'silhouette' | 'u2net' = 'silhouette';
    let backgroundShare: number | undefined;
    const backdrop = fitBackdrop(image.data, outW, outH);

    if (request.background) {
      let mask = await segmentWithModel(image.data, outW, outH);
      engine = mask ? 'u2net' : 'silhouette';
      mask ??= backgroundMask(image.data, outW, outH, request.tolerance, undefined, {
        backdrop,
      });

      const soft = featherMask(mask, outW, outH, Math.max(1, Math.round(outH / 200)));

      let backgroundPixels = 0;
      for (let i = 0; i < soft.length; i += 1) if (soft[i] > 200) backgroundPixels += 1;
      backgroundShare = backgroundPixels / soft.length;

      // Дэвсгэр СОЛИГДОХООС ӨМНӨ — солигдсоны дараа лавлагаа алга болно.
      autoWhiteBalance(image.data, soft);
      applyBackground(image.data, soft, request.background);
      ctx.putImageData(image, 0, 0);
    }

    /* ── 4. Чанарын шалгалт — эцсийн пиксел дээр ─────────────── */
    const scaleX = outW / crop.w;
    const scaleY = outH / crop.h;
    const checks = checkQuality({
      data: ctx.getImageData(0, 0, outW, outH).data,
      width: outW,
      height: outH,
      face: {
        x: (face.x - crop.x) * scaleX,
        y: (face.y - crop.y) * scaleY,
        w: face.w * scaleX,
        h: face.h * scaleY,
      },
      faceCount: found.faceCount,
      size,
      backdrop,
      backgroundShare,
    });

    return {
      id: request.id,
      ok: true,
      blob: await canvasToBlob(canvas),
      checks,
      engine,
    };
  } finally {
    // Санах ойг ЯГ одоо чөлөөлнө — 10 зураг хуримтлагдвал таб унана.
    bitmap.close();
  }
}

