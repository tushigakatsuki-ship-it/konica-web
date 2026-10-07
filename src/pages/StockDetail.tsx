import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StockPayment from '../components/StockPayment';
import StockImage from '../components/StockImage';
import { IconCheck } from '../components/icons';
import { stockById } from '../data/stock';
import { DELIVERY_FEE } from '../lib/order';
import { formatCurrency, VAT_RATE } from '../lib/price';
import { quantityChoices, quote } from '../lib/stockOrder';
import { useLang } from '../state/lang';

/**
 * Бэлэн барааны дэлгэрэнгүй — ppm-ийн урсгалыг дагасан.
 *
 * ── Яагаад тусдаа хуудас вэ ──────────────────────────────────────
 *
 * Жагсаалтын картанд тоо ширхэг, авах хэлбэр, НӨАТ, тэмдэглэл бүгдийг
 * багтаавал карт нь маягт болж хувирна — гурван бараа харах гэсэн
 * хүн гурван маягтыг гүйлгэнэ. Дэлгэрэнгүй хуудас нь нэг бараанд
 * бүтэн дэлгэц өгнө.
 *
 * ── Сагсгүй ──────────────────────────────────────────────────────
 *
 * Нэг бараа = нэг захиалга. Сагс нь хэвлэлийн урсгалд хэрэгтэй (нэг
 * хүн олон хэмжээний зураг угаалгана) ч бэлэн бараанд илүүц алхам.
 */

const MAX_NOTE = 200;

export default function StockDetail() {
  const { id = '' } = useParams();
  const { lang } = useLang();
  const item = stockById(id);

  const choices = useMemo(() => quantityChoices(item?.stock ?? 0), [item?.stock]);
  const [qty, setQty] = useState(() => choices[0] ?? 1);
  const [delivery, setDelivery] = useState(false);
  const [vat, setVat] = useState(false);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  /*
   * Байхгүй бараа — хаягийг гараар өөрчилсөн, эсвэл бараа жагсаалтаас
   * хасагдсан. Хоосон дэлгэц үлдээхийн оронд буцах зам өгнө.
   */
  if (!item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <h1 className="text-2xl font-black">Ийм бараа олдсонгүй</h1>
        <p className="mt-2 text-sm text-muted">
          Дууссан эсвэл жагсаалтаас хасагдсан байж магадгүй.
        </p>
        <Link to="/baraa" className="btn-brand mt-6 inline-flex">
          Бараа материал руу буцах
        </Link>
      </div>
    );
  }

  const soldOut = item.stock <= 0;
  const bill = quote(item, qty, {
    delivery,
    vat,
    deliveryFee: DELIVERY_FEE,
    vatRate: VAT_RATE,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Мөшгих зам — хэрэглэгч хаана байгаагаа мэдэж, нэг товшилтоор буцна. */}
      <nav aria-label="Мөшгих зам" className="text-[13px] text-muted">
        <Link to="/" className="hover:text-brand-500">
          Нүүр
        </Link>
        <span className="mx-1.5">/</span>
        <Link to="/baraa" className="hover:text-brand-500">
          Бараа материал
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink">{item.name[lang]}</span>
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px] lg:gap-10">
        <div>
          <StockImage item={item} className="aspect-[4/3] w-full rounded-xl" />

          <h1 className="mt-5 text-2xl font-black">{item.name[lang]}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.blurb[lang]}</p>

          <p className="mt-4 text-sm">
            <span className="text-muted">Нөөц: </span>
            {soldOut ? (
              <span className="font-bold text-muted">Дууссан</span>
            ) : (
              <span
                className={`font-bold ${item.stock <= 5 ? 'text-accent-strong' : 'text-brand-500'}`}
              >
                {item.stock} ширхэг
              </span>
            )}
          </p>
        </div>

        {/* ── Захиалгын самбар ────────────────────────────────── */}
        <div className="card h-fit p-5 lg:sticky lg:top-24">
          {soldOut ? (
            <p className="text-sm leading-relaxed text-muted">
              Энэ бараа одоогоор дууссан байна. Хэзээ орохыг мэдэхийн тулд
              залгаарай — эсвэл захиалгаар хийлгэж болно.
            </p>
          ) : (
            <>
              <label className="block">
                <span className="label">Тоо ширхэг</span>
                <select
                  value={qty}
                  onChange={(event) => setQty(Number(event.target.value))}
                  className="field"
                >
                  {choices.map((choice) => (
                    <option key={choice} value={choice}>
                      {choice} ширхэг
                    </option>
                  ))}
                </select>
                {item.bulk && (
                  <span className="mt-1 block text-[11px] font-semibold text-brand-500">
                    {qty >= item.bulk.from
                      ? `Олны үнэ идэвхжсэн (${item.bulk.from}-аас дээш)`
                      : `${item.bulk.from} ширхэгээс хямдарна`}
                  </span>
                )}
              </label>

              <fieldset className="mt-4">
                <legend className="label">Авах хэлбэр</legend>

                <label className="mt-1 flex items-center gap-2.5 py-1.5 text-sm">
                  <input
                    type="radio"
                    name="fulfilment"
                    checked={!delivery}
                    onChange={() => setDelivery(false)}
                    className="accent-brand-500"
                  />
                  Өөрийн биеэр авах
                </label>

                {/*
                  * ⚠️ Хүргэлт нь БҮХ сайт дээр түр хаалттай (`Order.tsx`).
                  * Нуухын оронд идэвхгүй харуулж байгаа шалтгаан:
                  * «хүргэдэг үү» гэсэн асуулт хамгийн их давтагддаг.
                  */}
                <label className="flex items-center gap-2.5 py-1.5 text-sm text-muted">
                  <input type="radio" name="fulfilment" disabled className="accent-brand-500" />
                  Хүргэлтээр авах
                  <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-strong">
                    Түр боломжгүй
                  </span>
                </label>
              </fieldset>

              <label className="mt-3 flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={vat}
                  onChange={(event) => setVat(event.target.checked)}
                  className="accent-brand-500"
                />
                и-Баримт авах (НӨАТ)
              </label>

              <label className="mt-4 block">
                <span className="label">Тэмдэглэл</span>
                <textarea
                  value={note}
                  maxLength={MAX_NOTE}
                  rows={2}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Өнгө, авах цаг гэх мэт"
                  className="field"
                />
              </label>

              {/* ── Дүн ─────────────────────────────────────── */}
              <dl className="mt-5 space-y-1.5 border-t border-hairline pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">
                    {formatCurrency(bill.unit)} × {qty}
                  </dt>
                  <dd>{formatCurrency(bill.subtotal)}</dd>
                </div>
                {bill.tax > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">НӨАТ</dt>
                    <dd>{formatCurrency(bill.tax)}</dd>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 text-base font-black">
                  <dt>Нийт</dt>
                  <dd className="text-brand-500">{formatCurrency(bill.total)}</dd>
                </div>
              </dl>

              <button type="button" onClick={() => setOpen(true)} className="btn-brand mt-4 w-full">
                Захиалах
              </button>

              <p className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <IconCheck className="mt-px size-3.5 shrink-0 text-brand-500" />
                Дараагийн алхамд захиалгын дугаар, дансны мэдээлэл гарна.
              </p>
            </>
          )}
        </div>
      </div>

      {open && (
        <StockPayment
          item={item}
          qty={qty}
          vat={vat}
          note={note}
          bill={bill}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
