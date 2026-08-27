import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ServiceItem } from '../data/catalog';
import type { EditorValue } from '../components/PhotoEditor';
import { parsePrice, vatPortion } from '../lib/price';

/**
 * Сагс — `/hevlel` дээр сонгосон зурагтай мөрүүд.
 *
 * Яагаад router state биш вэ: сагсанд `File` объектууд байдаг бөгөөд тэдгээрийг
 * `history.pushState`-аар зөөх нь эвгүй. Мөн хэрэглэгч `/zakhialga`-аас буцаад
 * ирэхэд сонголт нь хэвээр байх ёстой.
 *
 * Санаатайгаар зөвхөн санах ойд амьдардаг: зураг хэрэглэгчийн төхөөрөмжөөс
 * захиалга илгээх хүртэл хаашаа ч явахгүй. Санах ойд зөвхөн `File`-ийн заагч
 * (диск дээрх файлын лавлагаа) болон 640px-ийн preview л үлддэг тул 20 зураг
 * сонгосон ч хэдхэн MB эзэлнэ.
 */

export interface BasketItem {
  key: string;
  service: ServiceItem;
  value: EditorValue;
}

interface BasketApi {
  items: BasketItem[];
  /** НӨАТ-гүй дүн. */
  total: number;
  /**
   * НӨАТ-ын дүн. `vat` унтраалттай үед 0.
   *
   * Сагсанд байгаа шалтгаан: НӨАТ нь мөр тус бүрийнх БИШ, бүтэн ЗАХИАЛГЫН
   * шинж чанар. Хэрэглэгч түүнийг зураг нэмэх цонхноос сонгодог болсон ч
   * утга нь бүх мөрөнд нэг удаа бодогдох ёстой — тиймээс сагсны төлөвт
   * амьдарна, зураг тус бүрийн `EditorValue` дотор биш.
   */
  tax: number;
  /** НӨАТ-тай эцсийн дүн — хэрэглэгчийн төлөх мөнгө. */
  grandTotal: number;
  totalQty: number;
  vat: boolean;
  setVat(on: boolean): void;
  /** Тухайн үйлчилгээгээр нийт хэдэн ширхэг сонгосон бэ. */
  countFor(serviceId: number): number;
  add(service: ServiceItem, value: EditorValue): void;
  update(key: string, value: EditorValue): void;
  setQty(key: string, qty: number): void;
  remove(key: string): void;
  clear(): void;
}

const BasketContext = createContext<BasketApi | null>(null);

export function BasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);
  const [vat, setVat] = useState(false);

  /*
   * Мутациудыг `useCallback`-аар тогтвортой байлгана: тэдгээр нь `items`-ээс
   * хамаардаггүй (бүгд функцэн шинэчлэлт ашигладаг) тул сагс өөрчлөгдөх бүрт
   * шинээр үүсэх шаардлагагүй.
   */
  const add = useCallback(
    (service: ServiceItem, value: EditorValue) =>
      setItems((list) => [
        ...list,
        { key: `${service.id}-${Date.now()}-${list.length}`, service, value },
      ]),
    [],
  );

  const update = useCallback(
    (key: string, value: EditorValue) =>
      setItems((list) => list.map((item) => (item.key === key ? { ...item, value } : item))),
    [],
  );

  const setQty = useCallback(
    (key: string, qty: number) =>
      setItems((list) =>
        list.map((item) =>
          item.key === key
            ? { ...item, value: { ...item.value, qty: Math.max(1, qty) } }
            : item,
        ),
      ),
    [],
  );

  const remove = useCallback(
    (key: string) => setItems((list) => list.filter((item) => item.key !== key)),
    [],
  );

  /*
   * Сагсыг цэвэрлэхэд НӨАТ-ын сонголт ч тэглэгдэнэ. Эс бөгөөс дараагийн
   * захиалга нь өмнөх хүний сонголтыг чимээгүй өвлөж, ажилтан буруу
   * баримт бэлдэнэ.
   */
  const clear = useCallback(() => {
    setItems([]);
    setVat(false);
  }, []);

  const api = useMemo<BasketApi>(() => {
    const priceOf = (item: BasketItem) => parsePrice(item.service.price) * item.value.qty;
    const total = items.reduce((sum, item) => sum + priceOf(item), 0);
    /*
     * ⚠️ Дүнг ЭНД нэг л газар бодно. Урьд нь `/zakhialga` хуудас өөрөө бодож
     * байсан тул сагсны хажуугийн дүн НӨАТ-гүй, захиалгын хуудасных НӨАТ-тай
     * гарч, хоёр өөр тоо харагддаг байв.
     */
    const tax = vat ? vatPortion(total) : 0;

    return {
      items,
      total,
      tax,
      grandTotal: total + tax,
      totalQty: items.reduce((sum, item) => sum + item.value.qty, 0),
      vat,
      setVat,
      countFor: (serviceId) =>
        items
          .filter((item) => item.service.id === serviceId)
          .reduce((sum, item) => sum + item.value.qty, 0),
      add,
      update,
      setQty,
      remove,
      clear,
    };
  }, [add, clear, items, remove, setQty, update, vat]);

  return <BasketContext.Provider value={api}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketApi {
  const api = useContext(BasketContext);
  if (!api) throw new Error('useBasket-ыг BasketProvider дотор ашиглана.');
  return api;
}
