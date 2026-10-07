/**
 * Бэлэн барааны захиалгын цэвэр логик.
 *
 * DOM-гүй тул `test/stock.test.ts` шууд шалгана. Мөнгө, тоо ширхэгтэй
 * холбоотой шийдвэрийг компонент дотор бичвэл зөвхөн гараар л шалгана.
 */

import type { StockItem } from '../data/stock';
import { serviceIdFor } from './price';
import { SERVICES } from '../data/catalog';
import { parsePrice } from './price';

/**
 * Тоо ширхэгийн бэлэн сонголтууд.
 *
 * ── Яагаад жагсаалт вэ, чөлөөт тоо биш вэ ───────────────────────
 *
 * ppm-ийн урсгалыг дагаж байна: хэрэглэгч гараар тоо бичихийн оронд
 * жагсаалтаас сонгоно. Энэ нь хоёр зүйл өгнө — нэгд, ердийн захиалгын
 * хэмжээ юу болохыг харуулна; хоёрт, олны хямдрал хаанаас эхэлдгийг
 * нүдэнд харагдуулна.
 */
const STEPS: readonly number[] = [1, 5, 10, 20, 30, 50, 100, 200, 500];

/**
 * Тухайн бараанд сонгож болох тоонууд.
 *
 * ⚠️ Нөөцөөс ИЛҮҮ тоо жагсаалтад ОРОХГҮЙ. Үлдэгдлийн тоо бол амлалт:
 * «40 байна» гэж бичээд 100-г сонгуулах нь итгэл алдуулна.
 *
 * Нөөц нь алхмуудын хооронд таарвал (37 гэх мэт) яг тэр тоог төгсгөлд
 * нь нэмнэ — «бүгдийг нь авах» боломжгүй бол жагсаалт дутуу болно.
 */
export function quantityChoices(stock: number): number[] {
  if (!(stock > 0)) return [];

  const fit = STEPS.filter((step) => step <= stock);
  if (fit.length === 0) return [stock];
  return fit.includes(stock) ? [...fit] : [...fit, stock];
}

/** Тухайн тоонд харгалзах нэгж үнэ — олны хямдралыг тооцно. */
export const unitPriceFor = (item: StockItem, qty: number): number =>
  parsePrice(SERVICES.find((s) => s.id === serviceIdFor(item, qty))?.price);

export interface Quote {
  unit: number;
  /** Барааны дүн, НӨАТ ба хүргэлтгүй. */
  subtotal: number;
  delivery: number;
  /** НӨАТ — сонгосон үед л тооцогдоно. */
  tax: number;
  total: number;
}

/**
 * Захиалгын дүнг бүрэн задалж бодно.
 *
 * ⚠️ Энэ нь ЗӨВХӨН харуулах зориулалттай. Эцсийн дүнг сервер
 * каталогоос дахин бодно (`api/_shared.ts`) — хоёулаа ижил дүрмээр
 * (НӨАТ нь бараа + хүргэлтийн НИЙЛБЭР дээр) бодох ёстой, эс бөгөөс
 * хэрэглэгч дэлгэц дээр нэг тоо хараад данс руу өөр дүн шилжүүлнэ.
 */
export function quote(
  item: StockItem,
  qty: number,
  options: { delivery: boolean; vat: boolean; deliveryFee: number; vatRate: number },
): Quote {
  const unit = unitPriceFor(item, qty);
  const subtotal = unit * Math.max(0, Math.floor(qty));
  const delivery = options.delivery ? options.deliveryFee : 0;
  const tax = options.vat ? Math.round((subtotal + delivery) * options.vatRate) : 0;

  return { unit, subtotal, delivery, tax, total: subtotal + delivery + tax };
}

/**
 * Дансны дугаарыг хуулахад бэлтгэнэ — зайг хасна.
 *
 * Банкны апп руу зайтай дугаар буулгавал «буруу данс» гэж татгалздаг.
 * Дэлгэц дээр зайтай нь уншихад амар тул харагдац, хуулбар хоёрыг
 * салгав.
 */
export const plainAccount = (formatted: string): string => formatted.replace(/\s+/g, '');
