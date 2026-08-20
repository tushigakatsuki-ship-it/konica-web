/**
 * Вэб захиалгын хадгалалтын **порт** (интерфейс).
 *
 * Одоо R2 (объект сан) дээр JSON manifest болж хадгалагддаг. Ирээдүйд Postgres
 * руу шилжихэд `api/_store/postgres.ts` нэг файл бичээд `index.ts` дээр сонголт
 * нэмэхэд л хангалттай — `order.ts`, `admin.ts`, `payment.ts`, `qpay-callback.ts`
 * гурвуулаа зөвхөн ЭНЭ интерфейсийг мэднэ.
 *
 * Яагаад ийм хийсэн бэ: өмнө нь дөрвөн handler бүр R2-ийн түлхүүр угсарч,
 * `getObject`/`putObject`/`listKeys` шууд дууддаг байсан. Сан солих гэвэл
 * дөрвүүлэнг нь дахин бичих хэрэгтэй болно.
 *
 * ⚠️ Интерфейс нь ЗУРГИЙН ФАЙЛЫГ хамардаггүй. Файл нь ямар ч тохиолдолд объект
 * санд (R2/S3/MinIO) үлдэнэ — Postgres руу хэдэн MB-ийн зураг хийх нь буруу.
 * Postgres руу шилжинэ гэдэг нь **индекс, төлөв** нь SQL руу орно гэсэн үг.
 */

import type { ManifestFile, WebOrderManifest } from '../_files';
import type { PaymentInfo } from '../_payment';

export interface SaveOrderInput {
  orderNumber: string;
  uploadId: string;
  date: string;
  createdAt: number;
  /*
   * `WebOrderManifest['customer']`-аас нэрлэн авна — хоёр газар тусад нь
   * тодорхойлбол нэгд нь талбар нэмээд нөгөөг нь мартах нь цаг хугацааны
   * асуудал (хүргэлтийн хаяг нэмэхэд яг тэр болсон).
   */
  customer: WebOrderManifest['customer'];
  total: number;
  lines: { name: string; qty: number; total: number }[];
  files: ManifestFile[];
  payment: PaymentInfo;
}

/** Уншсан захиалга — хадгалалтын хэлбэрээс үл хамааран ижил бүтэц. */
export type StoredOrder = WebOrderManifest & {
  /**
   * Хадгалалтын дотоод таних тэмдэг.
   *
   * R2 дээр энэ нь manifest-ийн түлхүүр, Postgres дээр бол мөрийн `id` байх
   * болно. Дуудагч тал үүнийг ЗӨВХӨН буцааж дамжуулахад ашиглана, задлан
   * шинжлэхгүй.
   */
  ref: string;
};

export interface WebOrderStore {
  /** Тохиргоо бүрэн эсэх — дутуу бол handler-ууд зөөлөн доройтно. */
  readonly ready: boolean;

  save(input: SaveOrderInput): Promise<boolean>;

  /** Хэрэглэгчийн талын хандалт — `uploadId` нь нууц түлхүүрийн үүрэгтэй. */
  get(date: string, orderNumber: string, uploadId: string): Promise<StoredOrder | null>;

  /** Ажилтны талын хандалт — `ref`-ээр шууд. */
  getByRef(ref: string): Promise<StoredOrder | null>;

  /** Сүүлийн `days` өдрийн захиалгууд, шинэ нь эхэндээ. */
  list(days: number): Promise<StoredOrder[]>;

  /**
   * Талбар бүр `undefined` бол хөндөхгүй, `null` бол устгана.
   * (`printedAt: null` = «хэвлээгүй болгох», `syncedAt: null` = «дахин татуулах».)
   */
  update(
    ref: string,
    patch: {
      payment?: PaymentInfo;
      printedAt?: number | null;
      syncedAt?: number | null;
    },
  ): Promise<boolean>;

  /** Зураг татах түр линк. Төлбөр баталгаажаагүй бол дуудагч тал энийг дуудахгүй. */
  fileUrl(key: string): Promise<string>;
}
