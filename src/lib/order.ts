import type { ServiceCategory, ServiceItem } from '../data/catalog';
import { parsePrice } from './price';

/** Тогтсон үнэгүй, тохиролцоогоор явдаг категориуд — config.ts дахьтай ижил. */
export const CUSTOM_PRICE_CATEGORIES: readonly ServiceCategory[] = [
  'Медаль & Цом',
  'Хувцас хэвлэл',
];

export const isCustomPrice = (category: ServiceCategory): boolean =>
  CUSTOM_PRICE_CATEGORIES.includes(category);

export interface OrderLine {
  id: number;
  name: string;
  category: ServiceCategory;
  /** Нэгжийн үнэ төгрөгөөр. Тохиролцооны зүйлд хэрэглэгч өөрчилж болно. */
  unitPrice: number;
  qty: number;
}

export const lineFromService = (service: ServiceItem, qty = 1): OrderLine => ({
  id: service.id,
  name: service.name,
  category: service.category,
  unitPrice: parsePrice(service.price),
  qty,
});

export const lineTotal = (line: OrderLine): number => line.unitPrice * line.qty;

export const subtotal = (lines: readonly OrderLine[]): number =>
  lines.reduce((sum, line) => sum + lineTotal(line), 0);

/** Мөрийг нэмнэ; аль хэдийн байвал зөвхөн тоог нэмэгдүүлнэ. */
export const addLine = (
  lines: readonly OrderLine[],
  next: OrderLine,
): OrderLine[] => {
  const existing = lines.find((l) => l.id === next.id);
  if (!existing) return [...lines, next];
  return lines.map((l) => (l.id === next.id ? { ...l, qty: l.qty + next.qty } : l));
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
