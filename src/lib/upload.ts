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
import { ServiceUnavailableError } from './api';
import { DEFAULT_CROP } from './crop';
import { renderPrintBlob } from './photoRender';
import { sizeOf } from './photoSize';

export interface UploadedFile {
  key: string;
  kind: 'print' | 'original';
  name: string;
  size: number;
  serviceId: number;
  sizeLabel: string;
  qty: number;
}

export interface UploadResult {
  uploadId: string;
  date: string;
  files: UploadedFile[];
}

export interface UploadProgress {
  /** `prepare` — хэвлэлийн файл бэлдэж байна; `upload` — сүлжээгээр илгээж байна. */
  phase: 'prepare' | 'upload';
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

/**
 * Нэг файлыг хэдэн удаа оролдох, хэдэн миллисекунд хүлээх вэ.
 *
 * ⚠️ Урьд нь 3 оролдлого, 500ms суурьтай байсан (0.5с → 1с). Улаанбаатарын
 * автобус, лифт, подвалд сүлжээ 10–20 секунд бүрмөсөн тасардаг — тэр цонхыг
 * дааж гарахгүй. Одоо 4 оролдлого, 1с суурьтай (1с → 2с → 4с = ~7 секунд).
 * Presigned URL 20 минут амьдардаг тул энэ хүлээлт бүрэн аюулгүй.
 */
const RETRY_ATTEMPTS = 4;
const RETRY_BASE_MS = 1_000;

/** Бүх файл дуусмагц уначихсан нь байвал хэдэн секунд амраад ДАХИН үзнэ. */
const SECOND_PASS_DELAY_MS = 4_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Дахин оролдох утгатай эсэхийг ялгах. */
class UploadError extends Error {
  /** `true` бол давтаад ижил хариу ирнэ — шууд бууж өгнө. */
  permanent: boolean;

  constructor(message: string, permanent = false) {
    super(message);
    this.name = 'UploadError';
    this.permanent = permanent;
  }
}

/** Явцыг мэдэхийн тулд `fetch` биш XHR — `upload.onprogress` зөвхөн энд байдаг. */
const putOnce = (
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
        : reject(
            new UploadError(
              `Зураг байршуулж чадсангүй (${xhr.status}).`,
              // 4xx бол хүсэлт өөрөө буруу — давтаад ижил хариу ирнэ.
              xhr.status >= 400 && xhr.status < 500,
            ),
          );
    xhr.onerror = () =>
      reject(new UploadError('Сүлжээний алдаа — зураг илгээгдсэнгүй.'));
    xhr.ontimeout = () => reject(new UploadError('Зураг илгээх хугацаа хэтэрлээ.'));
    xhr.timeout = 5 * 60_000;
    xhr.send(blob);
  });

/**
 * Тасарсан байршуулалтыг дахин оролдоно.
 *
 * Гар утасны сүлжээ богино хугацаанд тасрах нь энгийн үзэгдэл. Дахин
 * оролдохгүй бол 20 зурагтай захиалга 19 дэх дээрээ унаж, хэрэглэгч бүхнийг
 * эхнээс нь давтах хэрэгтэй болно. Presigned URL 20 минут амьдардаг тул
 * хэдэн секундын хүлээлт асуудалгүй.
 *
 * `4xx` (гарын үсэг хүчингүй, хугацаа дууссан) дээр дахин оролдох нь утгагүй —
 * зөвхөн сүлжээний болон серверийн түр зуурын алдаанд давтана.
 */
const putWithProgress = async (
  url: string,
  blob: Blob,
  onFraction: (fraction: number) => void,
  attempts = RETRY_ATTEMPTS,
): Promise<void> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await putOnce(url, blob, onFraction);
      return;
    } catch (error) {
      const permanent = error instanceof UploadError && error.permanent;
      if (permanent || attempt >= attempts) throw error;

      // Явцын мөрийг тэглэж, дахин эхлэхийг харуулна.
      onFraction(0);
      await sleep(RETRY_BASE_MS * 2 ** (attempt - 1));
    }
  }
};

interface Planned {
  blob: Blob;
  meta: Omit<UploadedFile, 'key'>;
}

/**
 * Сагснаас байршуулах файлуудыг бэлдэнэ.
 *
 * Зураг бүрээс ХОЁР файл гарна:
 *   `print`    — сонгосон хэмжээний харьцаагаар төвөөр нь тайрсан, 300dpi,
 *                шууд хэвлэхэд бэлэн JPEG.
 *   `original` — хэрэглэгчийн эх файл. Автомат тайралт чухал хэсгийг таслачихвал
 *                эсвэл өнгө/гэрэл засах шаардлага гарвал ажилтанд энэ хэрэгтэй.
 */
export async function planFiles(
  items: readonly BasketItem[],
  onProgress?: (done: number, total: number) => void,
): Promise<Planned[]> {
  const planned: Planned[] = [];
  const withPhoto = items.filter((item) => item.value.file).length;
  let prepared = 0;

  for (const [index, item] of items.entries()) {
    const original = item.value.file;
    if (!original) continue;

    const size = sizeOf(item.service.name);
    const label = `${String(index + 1).padStart(2, '0')}_${asciiSize(size.label)}_${item.value.qty}sh`;

    /*
     * Задалсан зургийг хадгалахгүй — `renderPrintBlob` дотроо задалж, дуусмагц
     * `close()` дуудна. 20 зурагтай захиалгад бүгдийг зэрэг задалбал хямд утас
     * санах ойгүй болно.
     */
    /*
     * Хэрэглэгчийн тайралтыг ЗААВАЛ дамжуулна. Үүнийг мартвал дэлгэц дээр
     * тохируулсан зураг нь хэвлэхдээ автомат төв тайралтаар буцаж очих бөгөөд
     * хэрэглэгч зөвхөн бэлэн хэвлэсний дараа л мэдэх болно.
     */
    const print = await renderPrintBlob(original, size, item.value.crop ?? DEFAULT_CROP);
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
        },
      });
    }

    planned.push({
      blob: original,
      meta: {
        kind: 'original',
        name: `${label}_original.${extOf(original.type)}`,
        size: original.size,
        serviceId: item.service.id,
        sizeLabel: size.label,
        qty: item.value.qty,
      },
    });

    prepared += 1;
    onProgress?.(prepared, withPhoto);
    // Зураг бүрийн дараа хөтөчид зурах завсар өгнө — эс тэгвээс 20 зурагтай
    // захиалгад интерфейс хэдэн секунд царцсан мэт харагдана.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return planned;
}

export async function uploadBasketPhotos(
  items: readonly BasketItem[],
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadResult | null> {
  const planned = await planFiles(items, (done, total) =>
    onProgress({ phase: 'prepare', ratio: total === 0 ? 1 : done / total, done, total }),
  );
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

  /*
   * 503 = зургийн сан хараахан тохируулагдаагүй.
   *
   * Энэ бол алдаа биш, тохиргооны төлөв. Дуудагч тал үүнийг барьж аваад
   * захиалгыг зураггүйгээр үргэлжлүүлнэ — эс тэгвээс R2/NAS холбогдох хүртэл
   * вэбээр захиалга огт өгөх боломжгүй болно.
   */
  if (response.status === 503)
    throw new ServiceUnavailableError('Зургийн сан түр ажиллахгүй байна.');

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
      phase: 'upload',
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
  const sendOne = async (index: number): Promise<boolean> => {
    const plan = planned[index];
    try {
      await putWithProgress(urls[index].url, plan.blob, (fraction) => {
        sent[index] = plan.blob.size * fraction;
        report(index);
      });
      sent[index] = plan.blob.size;
      report(index + 1);
      return true;
    } catch {
      sent[index] = 0;
      return false;
    }
  };

  /*
   * ── Нэг файл унахад БҮХНИЙГ хаядаггүй ────────────────────────────
   *
   * ⚠️ Урьд нь энэ давталт `await putWithProgress(...)`-ыг шууд дууддаг
   * байсан тул 20 зурагтай захиалгын 19 дэх нь уначихвал алдаа дээшээ шидэгдэж,
   * АЛЬ ХЭДИЙН амжилттай орсон 18 зураг ч хамт хаягддаг байв. Хэрэглэгч 45 MB
   * илгээчихээд эхнээс нь дахин эхлэх шаардлагатай болно — гар утасны сүлжээн
   * дээр энэ нь хамгийн түгээмэл бүтэлгүйтэл.
   *
   * Одоо: эхний давталт бүх файлыг оролдож, унасныг нь ТЭМДЭГЛЭЖ авна.
   * Дараа нь хэдэн секунд амраад зөвхөн УНАСАН файлуудыг дахин илгээнэ.
   * Presigned URL 20 минут хүчинтэй тул ижил хаяг руу үргэлжлүүлж болно —
   * шинэ хаяг гуйх, сервер рүү дахин хандах шаардлагагүй.
   */
  const failed: number[] = [];
  for (let index = 0; index < planned.length; index += 1) {
    if (!(await sendOne(index))) failed.push(index);
  }

  if (failed.length > 0) {
    await sleep(SECOND_PASS_DELAY_MS);

    const stillFailed: number[] = [];
    for (const index of failed) {
      if (!(await sendOne(index))) stillFailed.push(index);
    }

    /*
     * Хоёр дахь давталт ч бүтэхгүй бол л бууж өгнө. Хэдэн файл дутсаныг
     * хэлэх нь чухал: «алдаа гарлаа» гэхээс илүү «19 зургаас 2 нь орсонгүй»
     * гэвэл хэрэглэгч сүлжээгээ соливол болно гэдгээ ойлгоно.
     */
    if (stillFailed.length > 0)
      throw new Error(
        `${planned.length} файлаас ${stillFailed.length} нь илгээгдсэнгүй. ` +
          'Сүлжээгээ шалгаад дахин оролдоно уу.',
      );
  }

  return {
    uploadId,
    date,
    files: planned.map((plan, index) => ({ key: urls[index].key, ...plan.meta })),
  };
}
