import type { ServiceCategory, ServiceItem } from '../data/catalog';
import { parsePrice } from './price';

/**
 * Тогтсон үнэгүй, тохиролцоогоор явдаг категориуд.
 *
 * ⚠️ Энэ жагсаалтад орсон категорийн үнийг КЛИЕНТ тогтооно: сервер нь
 * каталогийн үнийг орхиж, хүсэлтэд ирсэн `unitPrice`-ыг хүлээж авна
 * (`api/_shared.ts`). Тиймээс энд зөвхөн каталогт ҮНЭГҮЙ мөртэй,
 * ажилтан биечлэн тохирдог ажил байна.
 *
 * ⚠️ «Медаль & Цом» ХАСАГДСАН. Медалийн бүх мөр каталогт тогтсон үнэтэй
 * (төмөр 1,200₮, шилэн 2,500/1,500₮, цом 5,000₮) тул тохиролцох зүйл
 * байхгүй. Жагсаалтад үлдээх нь засварласан хүсэлтээр 100 ширхэг
 * медалийг 0₮-өөр захиалах боломж нээж байв — QPay-ийн нэхэмжлэх нь
 * серверийн тооцоолсон дүнгээр үүсдэг тул төлбөр нь ч 0₮ болно.
 */
export const CUSTOM_PRICE_CATEGORIES: readonly ServiceCategory[] = ['Хувцас хэвлэл'];

export const isCustomPrice = (category: ServiceCategory): boolean =>
  CUSTOM_PRICE_CATEGORIES.includes(category);

/**
 * Зураг ЗААВАЛ шаардахгүй категориуд.
 *
 * ── Яагаад хэрэгтэй вэ ──────────────────────────────────────────
 *
 * Захиалга илгээхийн өмнө «зураггүй мөр байна уу» гэж шалгадаг. Тэр
 * шалгалт нь зөв: хэвлэх зурагт зураг хэрэгтэй, зураггүй мөр ажилтанд
 * очвол хийх юмгүй ажил болно.
 *
 * ⚠️ Гэвч медаль нь ӨӨР. Голын зураг нь СОНГОЛТООР: зөвхөн бичээстэй
 * медаль нийтлэг бөгөөд сийлбэрийн эхийг ажилтан бэлддэг тул `Medal.tsx`
 * нь `file: null` илгээдэг. Бүх мөрөөс зураг шаардвал медалийн захиалга
 * НЭГ Ч УДАА илгээгдэхгүй: хэрэглэгч бүгдийг бөглөөд, «Зураггүй мөр
 * байна» гэсэн мессежтэй тулгарах бөгөөд засах арга нь ч байхгүй.
 */
export const PHOTO_OPTIONAL: readonly ServiceCategory[] = ['Медаль & Цом'];

/** Тухайн үйлчилгээнд зураг заавал хэрэгтэй эсэх. */
export const needsPhoto = (service: ServiceItem): boolean =>
  !PHOTO_OPTIONAL.includes(service.category);

export interface OrderLine {
  id: number;
  name: string;
  category: ServiceCategory;
  /** Нэгжийн үнэ төгрөгөөр. Тохиролцооны зүйлд хэрэглэгч өөрчилж болно. */
  unitPrice: number;
  qty: number;
  /**
   * Мөрийн тайлбар — медалийн загвар, сийлэх бичвэр гэх мэт.
   *
   * ⚠️ Энэ нь мөрийн ӨВӨРМӨЦ БАЙДЛЫГ тодорхойлно (`addLine`-ыг үз).
   */
  spec?: string;
}

export const lineFromService = (
  service: ServiceItem,
  qty = 1,
  spec?: string,
): OrderLine => ({
  id: service.id,
  name: service.name,
  category: service.category,
  unitPrice: parsePrice(service.price),
  qty,
  ...(spec === undefined || spec === '' ? {} : { spec }),
});

export const lineTotal = (line: OrderLine): number => line.unitPrice * line.qty;

export const subtotal = (lines: readonly OrderLine[]): number =>
  lines.reduce((sum, line) => sum + lineTotal(line), 0);

/**
 * Мөрийг нэмнэ; аль хэдийн байвал зөвхөн тоог нэмэгдүүлнэ.
 *
 * ⚠️ Нэгтгэх түлхүүр нь `id` + `spec` ХОЁУЛАА.
 *
 * Зөвхөн `id`-аар нэгтгэвэл ижил үйлчилгээний өөр тохируулгатай мөрүүд
 * (жишээ нь «алтлаг медаль, ТЭРГҮҮН БАЙР» ба «алтлаг медаль, ДЭД БАЙР»)
 * нэг мөр болж нийлээд, тайлбаруудын нэг нь ЧИМЭЭГҮЙ алга болно.
 * Хэрэглэгч сагсандаа хоёр зүйл харсан атлаа ажилтанд нэг нь очно.
 */
export const addLine = (
  lines: readonly OrderLine[],
  next: OrderLine,
): OrderLine[] => {
  const same = (line: OrderLine) => line.id === next.id && line.spec === next.spec;
  if (!lines.some(same)) return [...lines, next];
  return lines.map((l) => (same(l) ? { ...l, qty: l.qty + next.qty } : l));
};

export const updateLine = (
  lines: readonly OrderLine[],
  id: number,
  patch: Partial<OrderLine>,
): OrderLine[] => lines.map((l) => (l.id === id ? { ...l, ...patch } : l));

export const removeLine = (lines: readonly OrderLine[], id: number): OrderLine[] =>
  lines.filter((l) => l.id !== id);

/** Хүргэлтийн суурь хураамж — хотын дотор. */
export const DELIVERY_FEE = 5000;

/**
 * Захиалагч хэн бэ.
 *
 * НӨАТ-ын баримт хоёр төрөлд ӨӨР бөглөгддөг: хувь хүнд регистрийн дугаараар,
 * байгууллагад ТТД-аар. Ажилтан баримт бэлдэхийн өмнө үүнийг мэдэх ёстой тул
 * захиалгын тайлбарт тэмдэглэгдэж, ажлын самбарт харагдана.
 */
export type CustomerKind = 'person' | 'org';

export interface CustomerInfo {
  kind: CustomerKind;
  name: string;
  phone: string;
  email: string;
  note: string;
  /**
   * Хүргэлтийн хаяг. ЗӨВХӨН хүргэлт сонгосон үед шаардлагатай.
   *
   * Тайлбараас (`note`) тусад нь байх шалтгаан: аппын `WorkLog` дээр
   * `delivery` гэсэн тусдаа талбар аль хэдийн байдаг бөгөөд хүргэгч түүнийг
   * л хардаг. Хаягийг тайлбар дотор булшилбал ажилтан 1000 тэмдэгтийн
   * дундаас хайх хэрэгтэй болно.
   */
  address: string;

  /**
   * Хүлээж авахаар төлөвлөж буй өдөр — `YYYY-MM-DD`, сонголтоор.
   *
   * Аппын `WorkLog.deadline` талбар руу очно: ажилтан вэб захиалгыг өөрийн
   * ердийн ажлын жагсаалт дотроос хугацаагаар нь эрэмбэлж харна. Тусдаа
   * газар хадгалбал тэр эрэмбэ ажиллахгүй.
   */
  pickupDate: string;
}

export type FieldErrors = Partial<Record<keyof CustomerInfo | 'lines', string>>;
