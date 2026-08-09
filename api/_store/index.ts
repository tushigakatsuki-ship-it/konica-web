/**
 * Хадгалалтын сонголт — ГАНЦ газар.
 *
 * Handler-ууд `getStore()`-оос цааш юу ажиллаж байгааг мэдэхгүй. Postgres руу
 * шилжих алхам:
 *
 *   1. `api/_store/postgres.ts` дотор `WebOrderStore`-ыг хэрэгжүүлнэ
 *      (`docs/schema.sql` дэх хүснэгтүүдийн дагуу)
 *   2. Доорх `getStore()` дээр `DATABASE_URL` байвал түүнийг сонгоно
 *   3. Хуучин manifest-уудыг нэг удаагийн script-ээр SQL руу хуулна
 *
 * Handler-ууд болон тестүүд өөрчлөгдөхгүй.
 */

import { createR2Store } from './r2Store';
import type { WebOrderStore } from './types';

export type { SaveOrderInput, StoredOrder, WebOrderStore } from './types';

/**
 * Тохируулагдсан хадгалалтыг буцаана. Юу ч тохируулаагүй бол `null` —
 * дуудагч тал зөөлөн доройтож, захиалгыг зураггүйгээр үргэлжлүүлнэ.
 */
export const getStore = (
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): WebOrderStore | null => {
  /*
   * Postgres нэмэгдэх үед энд эхлээд шалгана:
   *
   *   if (env.DATABASE_URL) return createPostgresStore(env);
   *
   * R2 нь зургийн файлд ЯМАР Ч ТОХИОЛДОЛД хэрэгтэй хэвээр байна — Postgres нь
   * зөвхөн индекс, төлвийг л авна.
   */
  return createR2Store(env);
};
