import { useEffect, useState } from 'react';
import { PAYMENT_QR, PRIMARY_PHONE } from '../data/site';
import { formatCurrency } from '../lib/price';
import type { PaymentDetails } from '../lib/api';
import { IconAlert, IconCheckCircle, IconClock } from './icons';

interface Props {
  payment: PaymentDetails;
  orderNumber: string;
  photoCount: number;
}

/**
 * Төлбөрийн хэсэг — захиалга илгээсний дараа харагдана.
 *
 * Гол мессеж: **зураг тань хүлээн авагдсан, гэхдээ төлбөр орсны дараа
 * хэвлэлтэд орно.** Хэрэглэгч банкны апп руу шилжээд буцаж ирэхэд төлөв
 * автоматаар шинэчлэгдэж байхын тулд 5 секунд тутам сервэрээс асууна.
 */
export default function PaymentPanel({ payment, orderNumber, photoCount }: Props) {
  const [paid, setPaid] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  /**
   * Ирээгүй QR-ын замууд.
   *
   * ⚠️ Нэг QR дутуу байхад НӨГӨӨГ нь хамт нуух ёсгүй — тиймээс ганц
   * `boolean` биш, ЖАГСААЛТ. Хоёулаа дутвал хэсэг бүхэлдээ гарахгүй.
   */
  const [qrFailed, setQrFailed] = useState<string[]>([]);
  const qrShown = PAYMENT_QR.filter((qr) => !qrFailed.includes(qr.src));

  /*
   * Төлөв шалгах давтамж.
   *
   * QPay callback нь үндсэн зам — энэ нь зөвхөн интерфейсийг шинэчлэхэд.
   * Хуудас нуугдсан үед (хэрэглэгч банкны аппдаа байгаа) асуухаа больж,
   * буцаж ирмэгц нэг удаа шууд асууна.
   */
  useEffect(() => {
    // Хянах түлхүүр байхгүй (зургийн сан холбогдоогүй) — зөвхөн зааврыг харуулна.
    if (paid || !payment.tracking) return;

    let stopped = false;
    const { date, uploadId } = payment.tracking;
    const url =
      `/api/payment?order=${encodeURIComponent(orderNumber)}` +
      `&date=${encodeURIComponent(date)}&u=${encodeURIComponent(uploadId)}`;

    const check = async () => {
      if (stopped || document.hidden) return;
      try {
        const response = await fetch(url);
        const body = (await response.json()) as { status?: string };
        if (!stopped && body.status === 'paid') setPaid(true);
      } catch {
        // Сүлжээ тасарсан — дараагийн эргэлтэд дахин оролдоно.
      }
    };

    const timer = setInterval(check, 5000);
    document.addEventListener('visibilitychange', check);
    void check();

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [orderNumber, paid, payment.tracking]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard эрх байхгүй — хэрэглэгч гараар хуулна.
    }
  };

  if (paid) {
    return (
      <div className="mt-8 rounded-lg border border-ok/40 bg-ok/10 p-5 text-left">
        <p className="flex items-center gap-2 text-base font-black text-ok-strong">
          <IconCheckCircle className="size-5" /> Төлбөр баталгаажлаа
        </p>
        <p className="mt-2 text-sm text-ink-soft">
          {photoCount > 0
            ? `${photoCount} зураг тань хэвлэлтэд орлоо. Бэлэн болмогц утсаар мэдэгдэнэ.`
            : 'Захиалга тань хэвлэлтэд орлоо.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-lg border border-hairline text-left">
      <div className="border-b border-hairline bg-brand-50/60 px-5 py-4">
        <p className="flex items-center gap-2 text-base font-black">
          <IconClock className="size-5 text-accent-strong" /> Төлбөр хүлээгдэж байна
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {photoCount > 0 ? (
            <>
              Зураг тань хүлээн авагдсан. <strong>Төлбөр орсны дараа</strong>{' '}
              ажилтанд дамжиж, хэвлэлтэд орно.
            </>
          ) : (
            <>
              <strong>Төлбөр орсны дараа</strong> захиалга хэвлэлтэд орно.
            </>
          )}
        </p>
        <p className="mt-3 text-2xl font-black text-brand-500">
          {formatCurrency(payment.amount)}
        </p>
      </div>

      <div className="p-5">
        {/* ── QPay ─────────────────────────────────────────────── */}
        {payment.qpay && (
          <div>
            <p className="text-sm font-bold">Банкны аппаараа төлөх</p>

            {payment.qpay.qrImage && (
              <img
                src={`data:image/png;base64,${payment.qpay.qrImage}`}
                alt="QPay QR код"
                width={200}
                height={200}
                /*
                 * ⚠️ Цагаан дэвсгэр ЗААВАЛ. QR уншигч хар/цагаан ялгаа
                 * шаарддаг тул харанхуй горимд ч энэ хэвээр байх ёстой.
                 */
                className="mx-auto mt-3 size-50 rounded-md border border-hairline bg-white p-2"
              />
            )}
            <p className="mt-2 text-center text-xs text-muted">
              Банкны аппаараа QR-ыг уншуулна уу
            </p>

            {payment.qpay.urls.length > 0 && (
              <>
                <p className="mt-4 text-xs font-semibold text-ink-soft">
                  Эсвэл аппаа сонгоно уу
                </p>
                <ul className="mt-2 grid grid-cols-4 gap-2">
                  {payment.qpay.urls.map((app) => (
                    <li key={app.name}>
                      <a
                        href={app.link}
                        className="flex flex-col items-center gap-1 rounded-md border border-hairline p-2 text-center hover:bg-brand-50"
                      >
                        {app.logo && (
                          <img
                            src={app.logo}
                            alt=""
                            width={32}
                            height={32}
                            loading="lazy"
                            className="size-8 rounded"
                          />
                        )}
                        <span className="text-[10px] leading-tight text-ink-soft">
                          {app.description || app.name}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/*
          ── Банкны QR кодууд ────────────────────────────────────

          Хоёр QR ЗЭРЭГЦЭЭ: хэрэглэгч ямар банктай болохоо мэддэг тул
          сонголтыг нь зэрэгцүүлж тавих нь дараалуулснаас хурдан —
          нүд нэг хараад өөрийнхөө аппыг олно.

          ⚠️ Эдгээр нь QPay-ийн динамик QR-аас ТУСДАА: QPay нь нэхэмжлэл
          бүрт өөр QR үүсгэж төлбөрийг автоматаар баталгаажуулдаг бол
          эдгээр нь тогтмол данс руу шилжүүлэх бөгөөд ажилтан гараар
          баталгаажуулна. Тиймээс доорх дансны мэдээлэлтэй нэг бүлэгт.

          Файл дутуу бол тэр QR ганцаараа алга болно (`failed`) — үлдсэн нь
          хэвийн гарна.
        */}
        {PAYMENT_QR.length > 0 && qrShown.length > 0 && (
          <div className={payment.qpay ? 'mt-6 border-t border-hairline pt-5' : ''}>
            <p className="text-sm font-bold">Банкны аппаараа QR уншуулах</p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {qrShown.map((qr) => (
                <div key={qr.src} className="rounded-lg border border-hairline p-3">
                  {/*
                    ⚠️ Цагаан дэвсгэр ЗААВАЛ. QR уншигч хар/цагаан ялгаа
                    шаарддаг тул харанхуй горимд ч цагаан хэвээр байх ёстой —
                    эс бөгөөс камер уншихаа болино.
                  */}
                  <img
                    src={qr.src}
                    alt={`${qr.label} QR код`}
                    decoding="async"
                    onError={() =>
                      setQrFailed((list) =>
                        list.includes(qr.src) ? list : [...list, qr.src],
                      )
                    }
                    className="mx-auto block w-full max-w-[160px] rounded-md bg-white"
                  />
                  <p className="mt-2 text-center text-xs font-bold">{qr.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Дансаар шилжүүлэх ────────────────────────────────── */}
        {payment.bank && (
          <div className={payment.qpay ? 'mt-6 border-t border-hairline pt-5' : ''}>
            <p className="text-sm font-bold">
              {payment.qpay ? 'Эсвэл данс руу шилжүүлэх' : 'Данс руу шилжүүлэх'}
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Банк</dt>
                <dd className="font-semibold">{payment.bank.bank}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Данс</dt>
                <dd className="flex items-center gap-2 font-semibold">
                  {payment.bank.account}
                  <button
                    type="button"
                    onClick={() => void copy(payment.bank!.account, 'account')}
                    className="rounded-sm border border-hairline px-2 py-0.5 text-[11px] font-semibold text-brand-500"
                  >
                    {copied === 'account' ? 'Хууллаа' : 'Хуулах'}
                  </button>
                </dd>
              </div>
              {payment.bank.holder && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Хүлээн авагч</dt>
                  <dd className="font-semibold">{payment.bank.holder}</dd>
                </div>
              )}
              {/*
                IBAN нь дансны дугаарын ДООР байрлана — дээр нь биш.

                Ихэнх үйлчлүүлэгч дотоодын шилжүүлэг хийдэг бөгөөд тэдэнд
                ердийн дансны дугаар л хэрэгтэй. IBAN-ыг эхэнд тавивал урт
                тоог хараад «алийг нь хуулах вэ» гэж эргэлзэнэ.
              */}
              {payment.bank.iban && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">IBAN</dt>
                  <dd className="flex items-center gap-2 font-semibold">
                    <span className="break-all text-right">{payment.bank.iban}</span>
                    <button
                      type="button"
                      onClick={() => void copy(payment.bank!.iban, 'iban')}
                      className="shrink-0 rounded-sm border border-hairline px-2 py-0.5 text-[11px] font-semibold text-brand-500"
                    >
                      {copied === 'iban' ? 'Хууллаа' : 'Хуулах'}
                    </button>
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted">Гүйлгээний утга</dt>
                <dd className="flex items-center gap-2 font-semibold">
                  {payment.bank.reference}
                  <button
                    type="button"
                    onClick={() => void copy(payment.bank!.reference, 'ref')}
                    className="rounded-sm border border-hairline px-2 py-0.5 text-[11px] font-semibold text-brand-500"
                  >
                    {copied === 'ref' ? 'Хууллаа' : 'Хуулах'}
                  </button>
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent-strong">
              <IconAlert className="mt-px size-4 shrink-0" />
              <span>
                Гүйлгээний утгад <strong>{payment.bank.reference}</strong> гэж заавал
                бичнэ үү — эс тэгвээс аль захиалгынх нь болохыг таних боломжгүй.
                Шилжүүлэг ажлын цагт 10–30 минутын дотор баталгаажна.
              </span>
            </p>
          </div>
        )}

        {!payment.qpay && !payment.bank && (
          <p className="text-sm text-muted">
            Төлбөрийн мэдээллийг{' '}
            <a href={PRIMARY_PHONE.href} className="font-semibold text-accent">
              {PRIMARY_PHONE.label}
            </a>{' '}
            дугаараас тодруулна уу.
          </p>
        )}

        <p className="mt-5 text-center text-xs leading-relaxed text-muted">
          {payment.tracking
            ? 'Энэ хуудсыг нээлттэй үлдээвэл төлбөр орсныг шууд харуулна. Хаасан ч зүгээр — захиалга хадгалагдсан.'
            : 'Төлбөр орсныг ажилтан шалгаад баталгаажуулна.'}
        </p>
      </div>
    </div>
  );
}
