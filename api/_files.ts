/**
 * Зургийн файлын нэршил, баталгаажуулалт, manifest бүтэц.
 *
 * Сүлжээний дуудлагагүй цэвэр функцууд тул `test/files.test.ts` шууд шалгана.
 * `_`-ээр эхэлсэн файлыг Vercel тусдаа function болгодоггүй.
 */

import { ValidationError } from './_shared';
import type { PaymentInfo } from './_payment';

// ── Хязгаарууд ─────────────────────────────────────────────────────

/*
 * ⚠️ Хязгаарууд `src/lib/limits.ts`-д амьдарна — клиент, сервер ХОЁУЛАА
 * тэндээс уншина. Энд дахин бичвэл нэгийг нь өөрчлөөд нөгөөг мартах нь цаг
 * хугацааны асуудал; тэр үед хэрэглэгч зургаа сонгож, бүгдийг бэлдээд,
 * дараа нь сервер татгалзана — хийсэн ажил бүхэлдээ хаягдана.
 */
import { MAX_FILES, MAX_FILE_BYTES, PUT_EXPIRES_SEC } from '../src/lib/limits';

export { MAX_FILES, MAX_FILE_BYTES, PUT_EXPIRES_SEC };
export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp'] as const;

/** Admin татах линкийн хугацаа. */
export const GET_EXPIRES_SEC = 60 * 60;

export type FileKind = 'print' | 'original';

// ── Түлхүүр үүсгэх ─────────────────────────────────────────────────

/**
 * Таамаглах боломжгүй байршуулалтын id.
 *
 * Түлхүүр нь нууц биш ч, дараалсан дугаар байвал хэн ч хөрш захиалгын
 * зургийн замыг таамаглах боломжтой болно. Presigned URL шаардлагатай хэвээр
 * байх ч давхар хамгаалалт хямд.
 */
export const makeUploadId = (random: () => number = Math.random): string => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 16; i += 1) {
    id += alphabet[Math.floor(random() * alphabet.length)];
  }
  return id;
};

const safeExt = (value: unknown): string => {
  const ext = String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');
  return (ALLOWED_EXT as readonly string[]).includes(ext) ? ext : 'jpg';
};

/** `uploads/2026-08-06/ab12…/01-print.jpg` */
export const uploadKey = (
  date: string,
  uploadId: string,
  index: number,
  kind: FileKind,
  ext: string,
): string =>
  `uploads/${date}/${uploadId}/${String(index + 1).padStart(2, '0')}-${kind}.${safeExt(ext)}`;

/** `manifests/2026-08-06/PMN-260806-4821-ab12….json` */
export const manifestKey = (
  date: string,
  orderNumber: string,
  uploadId: string,
): string => `manifests/${date}/${orderNumber}-${uploadId}.json`;

/** `manifests/2026-08-06/PMN-…-ab12.json` → `{ date, orderNumber, uploadId }` */
export const parseManifestKey = (
  key: string,
): { date: string; orderNumber: string; uploadId: string } | null => {
  const match = key.match(
    /^manifests\/(\d{4}-\d{2}-\d{2})\/([A-Z0-9-]+)-([a-z0-9]{16})\.json$/,
  );
  if (!match) return null;
  return { date: match[1], orderNumber: match[2], uploadId: match[3] };
};

// ── /api/upload — хүсэлтийн баталгаажуулалт ────────────────────────

export interface RequestedFile {
  kind: FileKind;
  ext: string;
  size: number;
  contentType: string;
}

const isKind = (value: unknown): value is FileKind =>
  value === 'print' || value === 'original';

export function validateUploadRequest(input: unknown): RequestedFile[] {
  if (typeof input !== 'object' || input === null)
    throw new ValidationError('Хүсэлтийн өгөгдөл буруу байна.');

  const files = (input as { files?: unknown }).files;
  if (!Array.isArray(files) || files.length === 0)
    throw new ValidationError('Файл заагаагүй байна.');
  if (files.length > MAX_FILES)
    throw new ValidationError(`Нэг захиалгад ${MAX_FILES}-аас олон файл байж болохгүй.`);

  return files.map((raw) => {
    const file = (raw ?? {}) as Partial<RequestedFile>;

    if (!isKind(file.kind)) throw new ValidationError('Файлын төрөл буруу байна.');

    const size = Number(file.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES)
      throw new ValidationError('Зургийн хэмжээ хэтэрсэн байна (дээд тал нь 30MB).');

    const contentType = String(file.contentType ?? '').toLowerCase();
    if (!(ALLOWED_TYPES as readonly string[]).includes(contentType))
      throw new ValidationError('Зөвхөн JPG, PNG, WEBP зураг хүлээн авна.');

    return { kind: file.kind, ext: safeExt(file.ext), size, contentType };
  });
}

// ── Manifest ───────────────────────────────────────────────────────

export interface ManifestFile {
  key: string;
  kind: FileKind;
  /** Татахад ашиглах ойлгомжтой нэр: `01_10x15_2sh_print.jpg`. */
  name: string;
  size: number;
  serviceId: number;
  sizeLabel: string;
  qty: number;
}

export interface WebOrderManifest {
  orderNumber: string;
  uploadId: string;
  date: string;
  createdAt: number;
  customer: {
    name: string;
    phone: string;
    email: string;
    note: string;
    /** Хүргэлтийн хаяг — NAS дээрх ЗАХИАЛГА.txt дээр гарна. Хүргэлтгүй бол хоосон. */
    address?: string;
    /**
     * Хэрэглэгчийн хүссэн хүлээж авах өдөр `YYYY-MM-DD`.
     *
     * Хуучин manifest дээр байхгүй байж болзошгүй тул уншихдаа заавал
     * хоосон утгыг тооцно.
     */
    pickupDate?: string;
  };
  total: number;
  lines: { name: string; qty: number; total: number }[];
  files: ManifestFile[];
  /**
   * Төлбөрийн төлөв. Хуучин manifest дээр байхгүй байж болзошгүй тул
   * уншихдаа `isPaid()`-ыг ашиглана (`undefined` = төлөгдөөгүй).
   */
  payment?: PaymentInfo;
  /** Ажилтан хэвлэсэн гэж тэмдэглэсэн хугацаа. */
  printedAt?: number;
  /**
   * NAS энэ захиалгын бүх файлыг бүрэн татсан хугацаа.
   *
   * Яагаад серверт бичдэг вэ: NAS дээрх `synced.json` нь дискний нэг файл —
   * NAS-ыг дахин суулгах, диск солих, хавтас цэвэрлэхэд арчигдаж, дараа нь
   * сүүлийн 31 хоногийн БҮХ зураг дахин татагдана. Мөн ажилтан «энэ захиалга
   * NAS дээр очсон уу» гэдгийг өөр газраас харах аргагүй байсан.
   */
  syncedAt?: number;
}

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * Захиалгын хүсэлтэд ирсэн файлын жагсаалтыг шалгана.
 *
 * ⚠️ Хамгийн чухал шалгалт: түлхүүр нь ЗААВАЛ тухайн `uploadId`-ийн зам дотор
 * байх ёстой. Үгүй бол хэрэглэгч дурын түлхүүр бичиж, өөр хүний захиалгын
 * зургийг өөрийн manifest-даа оруулаад admin хуудсаар дамжуулан татаж авах
 * боломжтой болно.
 */
export function validateManifestFiles(
  input: unknown,
  date: string,
  uploadId: string,
): ManifestFile[] {
  if (input === undefined || input === null) return [];
  if (!Array.isArray(input)) throw new ValidationError('Файлын жагсаалт буруу байна.');
  if (input.length > MAX_FILES)
    throw new ValidationError(`Нэг захиалгад ${MAX_FILES}-аас олон файл байж болохгүй.`);

  const prefix = `uploads/${date}/${uploadId}/`;

  return input.map((raw) => {
    const file = (raw ?? {}) as Partial<ManifestFile>;
    const key = clean(file.key, 200);

    if (!key.startsWith(prefix) || key.includes('..'))
      throw new ValidationError('Файлын хаяг буруу байна.');
    if (!isKind(file.kind)) throw new ValidationError('Файлын төрөл буруу байна.');

    const size = Number(file.size);
    if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES)
      throw new ValidationError('Зургийн хэмжээ хэтэрсэн байна.');

    const qty = Number(file.qty);

    return {
      key,
      kind: file.kind,
      name: clean(file.name, 80).replace(/[^\w.\-]/g, '_') || key.split('/').pop()!,
      size,
      serviceId: Number(file.serviceId) || 0,
      sizeLabel: clean(file.sizeLabel, 30),
      qty: Number.isInteger(qty) && qty > 0 ? qty : 1,
    };
  });
}

/** `PMN-260806-4821` хэлбэрийг л зөвшөөрнө. */
export const isOrderNumber = (value: string): boolean =>
  /^PMN-\d{6}-\d{4}$/.test(value);

/**
 * `ab12cdef…` — 16 тэмдэгт, `makeUploadId`-ийн цагаан толгойн доторх.
 * `l`, `o`, `0`, `1` байхгүй (гараар бичихэд андуурдаг).
 */
export const isUploadId = (value: string): boolean =>
  /^[a-km-np-z2-9]{16}$/.test(value);

export const isDateStamp = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);
