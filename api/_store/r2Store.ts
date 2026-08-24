/**
 * `WebOrderStore`-ийн R2 (объект сан) хэрэгжүүлэлт.
 *
 * Захиалга бүр нэг JSON объект:
 *   `manifests/<огноо>/<захиалгын дугаар>-<uploadId>.json`
 *
 * Яагаад ийм вэ: зураг аль хэдийн R2-д байгаа тул индексийг нь тэндээ барих нь
 * нэг эх сурвалжтай, нэмэлт үйлчилгээгүй, бараг үнэгүй. Мөн native app-ын
 * Firebase rules-д хүрэхгүй тул захиалга бичих үндсэн урсгалыг эрсдэлд
 * оруулахгүй.
 *
 * Хязгаарлалт (хэзээ Postgres руу шилжих вэ):
 *   • Хайлт байхгүй — утсаар, нэрээр хайх боломжгүй
 *   • Жагсаалт нь өдөр бүрээр `ListObjectsV2` + объект бүрийг тусад нь унших
 *     тул өдөрт 200+ захиалгатай болоход удаана
 *   • Тайлан, нэгтгэл (өдрийн орлого, хэмжээний статистик) хийх боломжгүй
 *   • Атомик шинэчлэл байхгүй — хоёр ажилтан зэрэг тэмдэглэвэл сүүлийнх нь дарна
 */

import {
  GET_EXPIRES_SEC,
  manifestKey,
  parseManifestKey,
  type WebOrderManifest,
} from '../_files';
import { getObject, listKeys, presign, putObject, readR2Config, type R2Config } from '../_r2';
import type { PaymentInfo } from '../_payment';
import type { SaveOrderInput, StoredOrder, WebOrderStore } from './types';

/** Улаанбаатарын огноогоор сүүлийн `days` өдрийн `YYYY-MM-DD` жагсаалт. */
const recentDates = (days: number, now = new Date()): string[] => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return Array.from({ length: days }, (_, i) =>
    formatter.format(new Date(now.getTime() - i * 86_400_000)),
  );
};

const parse = (raw: string, ref: string): StoredOrder | null => {
  try {
    return { ...(JSON.parse(raw) as WebOrderManifest), ref };
  } catch {
    return null;
  }
};

export class R2Store implements WebOrderStore {
  readonly ready = true;
  private readonly config: R2Config;

  constructor(config: R2Config) {
    this.config = config;
  }

  async save(input: SaveOrderInput): Promise<boolean> {
    const manifest: WebOrderManifest = { ...input };
    try {
      return await putObject(
        this.config,
        manifestKey(input.date, input.orderNumber, input.uploadId),
        JSON.stringify(manifest),
      );
    } catch {
      return false;
    }
  }

  async get(
    date: string,
    orderNumber: string,
    uploadId: string,
  ): Promise<StoredOrder | null> {
    const ref = manifestKey(date, orderNumber, uploadId);
    const raw = await getObject(this.config, ref);
    return raw ? parse(raw, ref) : null;
  }

  async getByRef(ref: string): Promise<StoredOrder | null> {
    // Дурын түлхүүрээр объект уншихаас сэргийлж хэлбэрийг шалгана.
    if (!parseManifestKey(ref)) return null;
    const raw = await getObject(this.config, ref);
    return raw ? parse(raw, ref) : null;
  }

  async list(days: number): Promise<StoredOrder[]> {
    const keys = (
      await Promise.all(
        recentDates(days).map((date) =>
          listKeys(this.config, `manifests/${date}/`, 200),
        ),
      )
    ).flat();

    const orders = (
      await Promise.all(
        keys.map(async (key) => {
          const raw = await getObject(this.config, key);
          return raw ? parse(raw, key) : null;
        }),
      )
    ).filter((order): order is StoredOrder => order !== null);

    return orders.sort((a, b) => b.createdAt - a.createdAt);
  }

  async update(
    ref: string,
    patch: {
      payment?: PaymentInfo;
      printedAt?: number | null;
      syncedAt?: number | null;
    },
  ): Promise<boolean> {
    const current = await this.getByRef(ref);
    if (!current) return false;

    const { ref: _ref, ...manifest } = current;
    if (patch.payment) manifest.payment = patch.payment;

    // `undefined` = хөндөхгүй, `null` = талбарыг устгана.
    if (patch.printedAt !== undefined) {
      if (patch.printedAt === null) delete manifest.printedAt;
      else manifest.printedAt = patch.printedAt;
    }
    if (patch.syncedAt !== undefined) {
      if (patch.syncedAt === null) delete manifest.syncedAt;
      else manifest.syncedAt = patch.syncedAt;
    }

    return putObject(this.config, ref, JSON.stringify(manifest));
  }

  /**
   * Тухайн өдрийн manifest-уудын нэрнээс захиалгын дугаарыг гаргана.
   *
   * ⚠️ Хамрах хүрээ: зурагтай захиалгууд. Зураггүй захиалга manifest
   * үүсгэдэггүй тул энд харагдахгүй — практикт вэб бол зураг захиалах
   * газар учир бараг бүх захиалга хамрагдана.
   */
  async usedOrderNumbers(date: string): Promise<Set<string>> {
    const keys = await listKeys(this.config, `manifests/${date}/`, 1000);
    const numbers = new Set<string>();
    for (const key of keys) {
      const parsed = parseManifestKey(key);
      if (parsed) numbers.add(parsed.orderNumber);
    }
    return numbers;
  }

  fileUrl(key: string): Promise<string> {
    return presign(this.config, 'GET', key, GET_EXPIRES_SEC);
  }
}

export const createR2Store = (
  env: Record<string, string | undefined>,
): R2Store | null => {
  const config = readR2Config(env);
  return config ? new R2Store(config) : null;
};
