/**
 * Зургийг R2 руу ШУУД байршуулах клиент тал.
 *
 * Урсгал:
 *   1. Хэвлэхэд бэлэн JPEG-ийг canvas дээр үүсгэнэ (`renderPrintBlob`).
 *   2. `/api/upload` руу файлын жагсаалт илгээж presigned PUT URL-үүд авна.
 *   3. Файл бүрийг R2 руу шууд PUT хийнэ — сервер дундаа ордоггүй тул
 *      Vercel-ийн 4.5MB биеийн хязгаар огт хамаагүй.
 *   4. Гарсан түлхүүрүүдийг `/api/order` руу дамжуулж manifest үүсгүүлнэ.
 */

import type { BasketItem } from '../state/basket';
import { renderPrintBlob } from './photoEdit';
import { sizeOf } from './photoSize';

export interface UploadedFile {
  key: string;
  kind: 'print' | 'original';
  name: string;
  size: number;
  serviceId: number;
  sizeLabel: string;
  qty: number;
  finish: string;
}

export interface UploadResult {
  uploadId: string;
  date: string;
  files: UploadedFile[];
}

export interface UploadProgress {
  /** 0–1 */
  ratio: number;
  done: number;
  total: number;
}

const extOf = (type: string): string =>
  type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';

/** `10×15 см` → `10x15` — файлын нэрэнд кирилл, тусгай тэмдэгт оруулахгүй. */
const asciiSize = (label: string): string =>
  label.replace(/×/g, 'x').replace(/[^\w.-]/g, '') || 'size';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Зургийг уншиж чадсангүй.'));
    image.src = src;
  });

/** Явцыг мэдэхийн тулд `fetch` биш XHR — `upload.onprogress` зөвхөн энд байдаг. */
const putWithProgress = (
  url: string,
  blob: Blob,
  onFraction: (fraction: number) => void,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('content-type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onFraction(event.loaded / event.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Зураг байршуулж чадсангүй (${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Сүлжээний алдаа — зураг илгээгдсэнгүй.'));
    xhr.ontimeout = () => reject(new Error('Зураг илгээх хугацаа хэтэрлээ.'));
    xhr.timeout = 5 * 60_000;
    xhr.send(blob);
  });

interface Planned {
  blob: Blob;
  meta: Omit<UploadedFile, 'key'>;
}

/**
 * Сагснаас байршуулах файлуудыг бэлдэнэ.
 *
 * Зураг бүрээс ХОЁР файл гарна:
 *   `print`    — сонгосон хэмжээний харьцаагаар тайрч, засвар тусгасан, шууд
 *                хэвлэхэд бэлэн JPEG.
 *   `original` — хэрэглэгчийн эх файл. Ажилтан тайралт буруу санагдвал эсвэл
 *                өөр хэмжээгээр дахин хэвлэх шаардлага гарвал энэ хэрэгтэй.
 */
export async function planFiles(items: readonly BasketItem[]): Promise<Planned[]> {
  const planned: Planned[] = [];

  for (const [index, item] of items.entries()) {
    if (!item.value.src) continue;

    const size = sizeOf(item.service.name);
    const label = `${String(index + 1).padStart(2, '0')}_${asciiSize(size.label)}_${item.value.qty}sh`;
    const image = await loadImage(item.value.src);

    const print = await renderPrintBlob(image, size, item.value.edits);
    if (print) {
      planned.push({
        blob: print,
        meta: {
          kind: 'print',
          name: `${label}_print.jpg`,
          size: print.size,
          serviceId: item.service.id,
          sizeLabel: size.label,
          qty: item.value.qty,
          finish: item.value.edits.finish,
        },
      });
    }

    const original = item.value.file;
    if (original) {
      planned.push({
        blob: original,
        meta: {
          kind: 'original',
          name: `${label}_original.${extOf(original.type)}`,
          size: original.size,
          serviceId: item.service.id,
          sizeLabel: size.label,
          qty: item.value.qty,
          finish: item.value.edits.finish,
        },
      });
    }
  }

  return planned;
}

export async function uploadBasketPhotos(
  items: readonly BasketItem[],
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadResult | null> {
  const planned = await planFiles(items);
  if (planned.length === 0) return null;

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      files: planned.map((p) => ({
        kind: p.meta.kind,
        ext: extOf(p.blob.type),
        size: p.blob.size,
        contentType: p.blob.type || 'image/jpeg',
      })),
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    uploadId?: string;
    date?: string;
    urls?: { key: string; url: string }[];
    error?: string;
  } | null;

  if (!response.ok || !body?.uploadId || !body.urls)
    throw new Error(body?.error ?? 'Зураг байршуулах хаяг авч чадсангүй.');

  const { uploadId, date, urls } = body as Required<typeof body>;

  // Явцыг файлын хэмжээгээр жигнэнэ — жижиг файл дүүрсэн ч мөр үсрэхгүй.
  const totalBytes = planned.reduce((sum, p) => sum + p.blob.size, 0);
  const sent = new Array<number>(planned.length).fill(0);
  const report = (done: number) =>
    onProgress({
      ratio: totalBytes === 0 ? 1 : sent.reduce((a, b) => a + b, 0) / totalBytes,
      done,
      total: planned.length,
    });

  report(0);

  /**
   * Дараалан илгээнэ.
   *
   * Зэрэг илгээвэл хурдан ч, гар утасны сүлжээнд олон том PUT зэрэг явуулбал
   * timeout-д орох магадлал огцом нэмэгддэг. Явц ч ойлгомжтой байна.
   */
  for (const [index, plan] of planned.entries()) {
    await putWithProgress(urls[index].url, plan.blob, (fraction) => {
      sent[index] = plan.blob.size * fraction;
      report(index);
    });
    sent[index] = plan.blob.size;
    report(index + 1);
  }

  return {
    uploadId,
    date,
    files: planned.map((plan, index) => ({ key: urls[index].key, ...plan.meta })),
  };
}
