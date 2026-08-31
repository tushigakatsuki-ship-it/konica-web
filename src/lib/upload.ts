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
import { DEFAULT_ADJUST } from './adjust';
import { ServiceUnavailableError } from './api';
import { DEFAULT_CROP } from './crop';
import { renderPrintBlob } from './photoRender';
import { sizeOf } from './photoSize';
import { FILE_KINDS, createProgress, slotIndex, type UploadProgress } from './uploadProgress';

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

export type { UploadProgress } from './uploadProgress';

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
  /**
   * Аль зурагт харьяалагдах вэ (0-оос эхэлсэн дугаар).
   *
   * `Math.floor(index / 2)` гэж тооцож БОЛОХГҮЙ: `renderPrintBlob` унавал
   * тухайн зураг зөвхөн нэг файл (`original`) үлдээдэг тул хосын дараалал
   * тэр цэгээс эхлэн бүхэлдээ гажина.
   */
  photo: number;
}


/**
 * Нэг зургаас байршуулах файлуудыг бэлдэнэ.
 *
 * Зураг бүрээс ХОЁР файл гарна:
 *   `print`    — сонгосон хэмжээний харьцаагаар тайрсан, 300dpi, шууд
 *                хэвлэхэд бэлэн JPEG.
 *   `original` — хэрэглэгчийн эх файл. Автомат тайралт чухал хэсгийг таслачихвал
 *                эсвэл өнгө/гэрэл засах шаардлага гарвал ажилтанд энэ хэрэгтэй.
 *
 * `renderPrintBlob` унавал зөвхөн `original` буцна — эх файл нь ажилтанд
 * хамгийн чухал нь учир зургийг бүхэлд нь хаяхгүй.
 */
async function preparePhoto(
  item: BasketItem,
  labelIndex: number,
  photo: number,
): Promise<Planned[]> {
  const original = item.value.file;
  if (!original) return [];

  const size = sizeOf(item.service.name);
  const label = `${String(labelIndex + 1).padStart(2, '0')}_${asciiSize(size.label)}_${item.value.qty}sh`;
  const common = {
    serviceId: item.service.id,
    sizeLabel: size.label,
    qty: item.value.qty,
  };

  /*
   * Хэрэглэгчийн тайралтыг ЗААВАЛ дамжуулна. Үүнийг мартвал дэлгэц дээр
   * тохируулсан зураг нь хэвлэхдээ автомат төв тайралтаар буцаж очих бөгөөд
   * хэрэглэгч зөвхөн бэлэн хэвлэсний дараа л мэдэх болно.
   *
   * ⚠️ `item.value.adjust`-ыг ч мөн ЗААВАЛ дамжуулна (Цээж зурагт л утгатай,
   * бусад ангилалд `undefined` → `DEFAULT_ADJUST`, өөрчлөлтгүй). Үүнийг
   * мартвал харилцагчийн тохируулсан brightness/blur/sharpen/дэвсгэр зөвхөн
   * дэлгэцэн дээрх preview дээр үлдэж, ХЭВЛЭХ файлд огт ордоггүй болно.
   */
  const print = await renderPrintBlob(
    original,
    size,
    item.value.crop ?? DEFAULT_CROP,
    item.value.adjust ?? DEFAULT_ADJUST,
  );
  const files: Planned[] = [];

  if (print) {
    files.push({
      blob: print,
      photo,
      meta: { kind: 'print', name: `${label}_print.jpg`, size: print.size, ...common },
    });
  }

  files.push({
    blob: original,
    photo,
    meta: {
      kind: 'original',
      name: `${label}_original.${extOf(original.type)}`,
      size: original.size,
      ...common,
    },
  });

  return files;
}

/**
 * Захиалгын бүх зургийг R2 руу байршуулна.
 *
 * ── Яагаад бэлтгэл, илгээлт хоёрыг СОЛЬЖ явуулдаг вэ ────────────────
 *
 * Урьд нь эхлээд БҮХ зургийг бэлдэж (30 зурагт 10–25 секунд), дараа нь
 * илгээж эхэлдэг байв. Гурван бодит гэм:
 *
 *   1. Явцын мөр хоёр удаа дүүрдэг — бэлтгэл 30/30 болоод илгээлт 0/30-аас
 *      дахин эхэлнэ. Хэрэглэгч «эхнээс нь эхэллээ юү?» гэж эргэлзэнэ.
 *   2. Эхний 20 секундэд сүлжээ ХООСОН зогсоно. Тэр хугацаанд эхний хэдэн
 *      зураг аль хэдийн орчихож болох байсан.
 *   3. Бэлдсэн 30 хэвлэлийн файл (~30–45MB) бүгд санах ойд зэрэг хуримтлагдана.
 *
 * Одоо зураг бүр бэлдэгдээд ТЭР ДАРУЙ илгээгдэнэ. Дараагийн зургийн бэлтгэл
 * нь одоогийн зургийн илгээлттэй ЗЭРЭГ явна (процессор ба сүлжээ хоёр өөр
 * нөөц — зэрэг ажиллуулбал нийт хугацаа богиносно).
 *
 * ⚠️ Хаягуудыг бэлтгэлээс ӨМНӨ, зураг бүрт хоёр байр урьдчилан захиална.
 * Хэвлэлийн файлын ЯГ хэмжээг тэр үед мэдэхгүй тул эх файлын хэмжээг мэдүүлнэ —
 * presigned гарын үсэгт хэмжээ ОРДОГГҮЙ тул энэ нь зөвхөн серверийн 30MB
 * шалгалтад л нөлөөлнө (хэвлэлийн файл нь эх файлаас томрох боломжгүй,
 * учир нь хиймэл томруулалт хийдэггүй). Manifest руу ҮРГЭЛЖ жинхэнэ хэмжээ
 * бичигдэнэ.
 */
export async function uploadBasketPhotos(
  items: readonly BasketItem[],
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadResult | null> {
  const photos = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.value.file);
  if (photos.length === 0) return null;

  // ── 1. Хаягуудыг урьдчилан захиалах ──────────────────────────────
  /*
   * ⚠️ Дарааллыг ГАРААР бүү бич — `FILE_KINDS`-ээс гарга.
   *
   * `slotIndex` нь энэ жагсаалтын дарааллаас тоолдог. Хоёрыг тусад нь бичвэл
   * нэгийг нь сольсон хүн нөгөөг мартаж, хэвлэх файл эх файлын хаяг руу
   * илгээгдэнэ — R2 алдаа өгөхгүй тул хэн ч анзаарахгүй.
   */
  const reserved = photos.flatMap(({ item }) => {
    const original = item.value.file as File;
    return FILE_KINDS.map((kind) =>
      kind === 'print'
        ? { kind, ext: 'jpg', size: original.size, contentType: 'image/jpeg' }
        : {
            kind,
            ext: extOf(original.type),
            size: original.size,
            contentType: original.type || 'image/jpeg',
          },
    );
  });

  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ files: reserved }),
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

  // ── 2. Явцын тооцоо ──────────────────────────────────────────────
  /*
   * Зураг бүр ижил жинтэй. Байтаар жигнэх боломжгүй — бэлдэж дуустал
   * хэвлэлийн файлын хэмжээг мэдэхгүй, харин мөр эхний секундээс л хөдлөх
   * ёстой.
   */
  const total = photos.length;
  const progress = createProgress(total);
  const report = (state: UploadProgress) => onProgress(state);

  report(progress.snapshot());

  // ── 3. Бэлтгэл + илгээлтийг сольж явуулах ────────────────────────
  /** Хоёр дахь давталтад зориулж УНАСАН зургийн файлыг л хадгална. */
  const retry: Planned[] = [];
  const uploaded: UploadedFile[] = [];

  const sendPhoto = async (files: Planned[], photo: number): Promise<boolean> => {
    const bytes = files.reduce((sum, file) => sum + file.blob.size, 0);
    const sent = new Array<number>(files.length).fill(0);

    const tick = () =>
      report(
        progress.sending(
          photo,
          bytes === 0 ? 1 : sent.reduce((a, b) => a + b, 0) / bytes,
        ),
      );

    for (const [index, file] of files.entries()) {
      const slot = urls[slotIndex(photo, file.meta.kind)];
      try {
        await putWithProgress(slot.url, file.blob, (fraction) => {
          sent[index] = file.blob.size * fraction;
          tick();
        });
        sent[index] = file.blob.size;
        tick();
      } catch {
        /*
         * Хагас явсныг тэглэнэ — эс тэгвээс дахин илгээхэд ижил байт давхарлаж
         * тооцоо 100%-иас давна.
         */
        sent[index] = 0;
        return false;
      }
    }

    for (const file of files) {
      uploaded.push({ key: urls[slotIndex(photo, file.meta.kind)].key, ...file.meta });
    }
    report(progress.finished(photo));
    return true;
  };

  /*
   * Нэг зураг ТУРУУЛЖ бэлдэнэ. Дараа нь давталт бүрт: одоогийн зургийг
   * илгээхийн ЗЭРЭГЦЭЭ дараагийнхыг бэлдэнэ. Процессор, сүлжээ хоёр зэрэг
   * ажиллана — 30 зурагт бэлтгэлийн 10–25 секунд бүхэлдээ хэмнэгдэнэ.
   */
  let ahead = preparePhoto(photos[0].item, photos[0].index, 0);

  for (let photo = 0; photo < total; photo += 1) {
    const files = await ahead;
    report(progress.prepared(photo));

    const next = photos[photo + 1];
    ahead = next
      ? preparePhoto(next.item, next.index, photo + 1)
      : Promise.resolve([]);

    if (!(await sendPhoto(files, photo))) retry.push(...files);
  }

  // ── 4. Унасан файлуудыг дахин үзэх ───────────────────────────────
  /*
   * ⚠️ Нэг файл унахад БҮХНИЙГ хаядаггүй.
   *
   * Урьд нь алдаа дээшээ шидэгддэг байсан тул 20 зурагтай захиалгын 19 дэх нь
   * уначихвал АЛЬ ХЭДИЙН орсон 18 зураг ч хамт хаягддаг байв — хэрэглэгч 45MB
   * илгээчихээд эхнээс нь эхэлнэ.
   *
   * Presigned URL 20 минут хүчинтэй тул ижил хаяг руу үргэлжлүүлж болно —
   * шинэ хаяг гуйх, сервер рүү дахин хандах шаардлагагүй.
   */
  if (retry.length > 0) {
    await sleep(SECOND_PASS_DELAY_MS);

    const stillFailed: Planned[] = [];
    const byPhoto = new Map<number, Planned[]>();
    for (const file of retry) {
      byPhoto.set(file.photo, [...(byPhoto.get(file.photo) ?? []), file]);
    }

    for (const [photo, files] of byPhoto) {
      if (!(await sendPhoto(files, photo))) stillFailed.push(...files);
    }

    /*
     * Хоёр дахь давталт ч бүтэхгүй бол л бууж өгнө. Хэдэн зураг дутсаныг
     * хэлэх нь чухал: «алдаа гарлаа» гэхээс илүү «19 зургаас 2 нь орсонгүй»
     * гэвэл хэрэглэгч сүлжээгээ соливол болно гэдгээ ойлгоно.
     */
    if (stillFailed.length > 0) {
      const lost = new Set(stillFailed.map((file) => file.photo)).size;
      throw new Error(
        `${total} зургаас ${lost} нь илгээгдсэнгүй. Сүлжээгээ шалгаад дахин оролдоно уу.`,
      );
    }
  }

  return { uploadId, date, files: uploaded };
}
