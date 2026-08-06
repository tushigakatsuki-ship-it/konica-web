import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ServiceItem } from '../data/catalog';
import type { EditorValue } from '../components/PhotoEditor';
import { parsePrice } from '../lib/price';

/**
 * Сагс — `/hevlel` дээр сонгосон зурагтай мөрүүд.
 *
 * Яагаад router state биш вэ: сагсанд `File`, `Blob` объектууд байдаг бөгөөд
 * тэдгээрийг `history.pushState`-аар зөөх нь эвгүй (хуудас сэргээхэд объект
 * URL нь аль хэдийн хүчингүй болсон байдаг). Мөн хэрэглэгч `/zakhialga`-аас
 * буцаад ирэхэд сонголт нь хэвээр байх ёстой.
 *
 * Санаатайгаар зөвхөн санах ойд амьдардаг: зураг хэрэглэгчийн төхөөрөмжөөс
 * захиалга илгээх хүртэл хаашаа ч явахгүй.
 */

export interface BasketItem {
  key: string;
  service: ServiceItem;
  value: EditorValue;
}

interface BasketApi {
  items: BasketItem[];
  total: number;
  totalQty: number;
  /** Тухайн үйлчилгээгээр нийт хэдэн ширхэг сонгосон бэ. */
  countFor(serviceId: number): number;
  add(service: ServiceItem, value: EditorValue): void;
  update(key: string, value: EditorValue): void;
  setQty(key: string, qty: number): void;
  remove(key: string): void;
  clear(): void;
}

const BasketContext = createContext<BasketApi | null>(null);

const revoke = (item: BasketItem | undefined) => {
  if (item?.value.src) URL.revokeObjectURL(item.value.src);
};

export function BasketProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BasketItem[]>([]);

  const api = useMemo<BasketApi>(() => {
    const priceOf = (item: BasketItem) => parsePrice(item.service.price) * item.value.qty;

    return {
      items,
      total: items.reduce((sum, item) => sum + priceOf(item), 0),
      totalQty: items.reduce((sum, item) => sum + item.value.qty, 0),

      countFor: (serviceId) =>
        items
          .filter((item) => item.service.id === serviceId)
          .reduce((sum, item) => sum + item.value.qty, 0),

      add: (service, value) =>
        setItems((list) => [
          ...list,
          { key: `${service.id}-${Date.now()}-${list.length}`, service, value },
        ]),

      update: (key, value) =>
        setItems((list) =>
          list.map((item) => {
            if (item.key !== key) return item;
            // Зураг сольсон бол хуучин object URL-ыг чөлөөлнө.
            if (item.value.src && item.value.src !== value.src) {
              URL.revokeObjectURL(item.value.src);
            }
            return { ...item, value };
          }),
        ),

      setQty: (key, qty) =>
        setItems((list) =>
          list.map((item) =>
            item.key === key
              ? { ...item, value: { ...item.value, qty: Math.max(1, qty) } }
              : item,
          ),
        ),

      remove: (key) =>
        setItems((list) => {
          revoke(list.find((item) => item.key === key));
          return list.filter((item) => item.key !== key);
        }),

      clear: () =>
        setItems((list) => {
          list.forEach(revoke);
          return [];
        }),
    };
  }, [items]);

  return <BasketContext.Provider value={api}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketApi {
  const api = useContext(BasketContext);
  if (!api) throw new Error('useBasket-ыг BasketProvider дотор ашиглана.');
  return api;
}
