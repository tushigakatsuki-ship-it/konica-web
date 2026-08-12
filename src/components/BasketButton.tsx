import { Link } from 'react-router-dom';
import { IconBasket } from './icons';
import { useBasket } from '../state/basket';

/**
 * Толгойн сагс.
 *
 * ── Яагаад хэрэгтэй болов ────────────────────────────────────────
 *
 * Сагсны интерфейс анх ЗӨВХӨН `/hevlel`-ийн баруун баганад байсан. Тэр
 * үед бүх зүйл нэг хуудаснаас сагсанд ордог байсан тул асуудалгүй байв.
 *
 * Цээж зургийг `/tseej-zurag`-аас захиалдаг болсноор энэ нь эвдэрсэн:
 * хэрэглэгч сагсанд нэмэхэд дэлгэц дээр ЮУ Ч өөрчлөгдөхгүй, сагсаа
 * хаанаас харахаа ч мэдэхгүй. Нэмэлт нь ажилласан эсэхээ ч хэлэхгүй.
 *
 * Толгой бол цорын ганц зөв газар: бүх хуудсанд байдаг тул сагс хаанаас
 * дүүрсэн ч хамаагүй.
 *
 * Хоосон үед ХАРАГДАХГҮЙ — хоосон сагс нь мэдээлэл өгөхгүй, зөвхөн
 * цэсийг л дүүргэнэ.
 */
export default function BasketButton({ onNavigate }: { onNavigate?: () => void }) {
  const basket = useBasket();
  if (basket.totalQty === 0) return null;

  return (
    <Link
      to="/zakhialga"
      onClick={onNavigate}
      aria-label={`Сагс — ${basket.totalQty} ширхэг. Захиалга үргэлжлүүлэх`}
      className="relative grid size-9 shrink-0 place-items-center rounded-md text-ink-soft transition-[background-color,transform] duration-150 hover:bg-brand-50 hover:text-brand-500 active:scale-90"
    >
      <IconBasket className="size-4.5" />
      <span
        aria-hidden
        className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-black leading-4.5 text-white"
      >
        {basket.totalQty}
      </span>
    </Link>
  );
}
