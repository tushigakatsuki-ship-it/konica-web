import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import { PRIMARY_PHONE } from '../data/site';
import {
  DELIVERY_FEE,
  addLine,
  lineFromService,
  lineTotal,
  subtotal,
  type CustomerInfo,
  type FieldErrors,
  type OrderLine,
} from '../lib/order';
import { formatCurrency, isValidPhone, vatPortion } from '../lib/price';
import { sizeOf } from '../lib/photoSize';
import {
  ServiceUnavailableError,
  makeRequestId,
  submitOrder,
  type OrderResult,
} from '../lib/api';
import { receiptPath, saveReceipt } from '../lib/lastOrder';
import PaymentPanel from '../components/PaymentPanel';
import { uploadBasketPhotos, type UploadProgress } from '../lib/upload';
import { useBasket } from '../state/basket';
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconImage,
} from '../components/icons';

const EMPTY_CUSTOMER: CustomerInfo = { name: '', phone: '', email: '', note: '' };

const validate = (
  customer: CustomerInfo,
  lines: readonly OrderLine[],
): FieldErrors => {
  const errors: FieldErrors = {};
  if (!customer.name.trim()) errors.name = 'Нэрээ оруулна уу.';
  if (!customer.phone.trim()) errors.phone = 'Утасны дугаараа оруулна уу.';
  else if (!isValidPhone(customer.phone))
    errors.phone = '8 оронтой дугаар оруулна уу (жишээ: 99001234).';
  if (customer.email && !/^\S+@\S+\.\S+$/.test(customer.email))
    errors.email = 'И-мэйл хаяг буруу байна.';
  if (lines.length === 0) errors.lines = 'Дор хаяж нэг зураг сонгоно уу.';
  return errors;
};

export default function Order() {
  const basket = useBasket();

  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [delivery, setDelivery] = useState(false);
  const [vat, setVat] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<(OrderResult & { photoCount: number }) | null>(
    null,
  );

  /**
   * Захиалгын мөрүүд нь ЗӨВХӨН сагсны зурагнаас гарна.
   *
   * Өмнө нь энд каталогийн бүх үйлчилгээг хайж нэмэх хэсэг байсан. Вэбийн
   * зорилго зөвхөн зураг хүлээн авах болсон тул хассан — өргөмжлөл, медаль
   * зэрэг ажлыг утсаар эсвэл дэлгүүр дээр захиалдаг.
   */
  const lines = useMemo(
    () =>
      basket.items.reduce<OrderLine[]>(
        (acc, item) => addLine(acc, lineFromService(item.service, item.value.qty)),
        [],
      ),
    [basket.items],
  );

  const base = subtotal(lines);
  const deliveryFee = delivery ? DELIVERY_FEE : 0;
  const tax = vat ? vatPortion(base + deliveryFee) : 0;
  const total = base + deliveryFee + tax;

  const photoCount = basket.items.filter((item) => item.value.file).length;

  /*
   * Илгээж байх үед хуудас хаахаас сэрэмжлүүлнэ.
   *
   * Зураг байршуулах нь хэдэн арван секунд үргэлжилж болно. Хэрэглэгч энэ
   * зуур табаа хаавал захиалга хагас үлдэж, зураг нь ирээгүй ажлын мөр
   * үүсэх эрсдэлтэй.
   */
  useEffect(() => {
    if (!sending) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [sending]);

  const setField = (key: keyof CustomerInfo, value: string) => {
    setCustomer((c) => ({ ...c, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return; // давхар дарахаас — сервер талд бас хамгаалалттай

    const found = validate(customer, lines);

    /*
     * Сүүлчийн хамгаалалт: зураггүй мөр сагсанд орох ёсгүй (`PhotoEditor` үүнийг
     * хаадаг). Хэрэв ямар нэг замаар орсон бол илгээхийн оронд буцаана —
     * ажилтанд хэвлэх юмгүй ажлын мөр очихоос сэргийлнэ.
     */
    if (basket.items.some((item) => !item.value.file)) {
      found.lines = 'Зураггүй мөр байна. Түүнийг хасах эсвэл зураг нэмнэ үү.';
    }

    setErrors(found);
    setSendError(null);

    if (Object.keys(found).length > 0) {
      /*
       * Эхний алдаатай талбар руу автоматаар очно.
       *
       * Утсан дээр маягт урт байдаг тул алдааны текст дэлгэцээс гадуур үлдэж,
       * хэрэглэгч «яагаад илгээгдэхгүй байна вэ» гэж эргэлзэх нь түгээмэл.
       */
      const firstField = (['name', 'phone', 'email'] as const).find((key) => found[key]);
      if (firstField) {
        const element = document.getElementById(firstField);
        element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        element?.focus({ preventScroll: true });
      }
      return;
    }

    /*
     * Илгээх оролдлого бүрт нэг түлхүүр. Сүлжээ унаж дахин илгээвэл ижил утга
     * явах тул сервер давхар захиалга үүсгэхгүй.
     */
    const requestId = makeRequestId();
    setSending(true);
    try {
      /**
       * Зургийг ЭХЛЭЭД байршуулна.
       *
       * Захиалгыг эхэлж бичээд дараа нь зураг унавал ажилтан зураггүй ажлын
       * мөр хараад, хэрэглэгч рүү залгаж файл гуйх хэрэг гарна. Эсрэг
       * дарааллаар — зураг унавал захиалга огт үүсэхгүй тул хэрэглэгч дахин
       * оролдоод л болно.
       *
       * Онцгой тохиолдол: зургийн сан хараахан тохируулагдаагүй бол (503)
       * захиалгыг ЗОГСООХГҮЙ. Хэрэглэгч буруугүй, ажилтан утсаар холбогдож
       * зургийг нь авна. Ингэснээр R2/NAS-ыг хожим асаах хүртэл вэб бүрэн
       * ажиллана.
       */
      let upload = null;
      try {
        upload = await uploadBasketPhotos(basket.items, setProgress);
      } catch (error) {
        if (!(error instanceof ServiceUnavailableError)) throw error;
      }

      const result = await submitOrder(customer, lines, {
        delivery,
        vat,
        upload,
        requestId,
      });

      /*
       * Баримтаа хадгална — хэрэглэгч хуудсаа хааж, дараа нь `/zakhialga/<дугаар>`
       * хаягаар буцаж орж төлбөрөө төлж чадна.
       */
      if (result.payment?.tracking) {
        saveReceipt({
          orderNumber: result.orderNumber,
          date: result.payment.tracking.date,
          uploadId: result.payment.tracking.uploadId,
        });
      }

      setConfirmed({ ...result, photoCount });
      basket.clear();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Захиалга илгээхэд алдаа гарлаа.',
      );
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  if (confirmed) {
    return (
      <>
        <PageHero
          eyebrow="Захиалга"
          title="Захиалга хүлээн авлаа"
          subtitle="Ажлын цагт операторууд тань руу залгаж баталгаажуулна."
        />
        <div className="mx-auto max-w-2xl px-4 py-14 text-center sm:px-6 sm:py-20">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-ok/10 text-ok-strong">
            <IconCheckCircle className="size-8" />
          </span>
          <p className="mt-6 text-sm text-muted">Захиалгын дугаар</p>
          <p className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
            {confirmed.orderNumber}
          </p>
          <p className="mt-6 text-base text-ink-soft">
            Нийт дүн <strong>{formatCurrency(confirmed.total)}</strong> ·{' '}
            {customer.name}, {customer.phone}
          </p>

          {confirmed.photos === 'unavailable' && (
            <p className="mt-6 flex items-start gap-2 rounded-md bg-accent/10 px-4 py-3 text-left text-sm leading-relaxed text-accent-strong">
              <IconAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Зураг хүлээн авах систем түр ажиллахгүй байна. Захиалга тань
                бүртгэгдсэн — ажилтан тань руу залгаж зургийг тань авна.
              </span>
            </p>
          )}

          {confirmed.payment && (
            <PaymentPanel
              payment={confirmed.payment}
              orderNumber={confirmed.orderNumber}
              photoCount={confirmed.photos === 'saved' ? confirmed.photoCount : 0}
            />
          )}

          <p className="mt-6 text-sm text-muted">
            Асуух зүйл байвал{' '}
            <a href={PRIMARY_PHONE.href} className="font-semibold text-accent">
              {PRIMARY_PHONE.label}
            </a>{' '}
            дугаарт холбогдоно уу.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {confirmed.payment?.tracking && (
              <Link
                to={receiptPath({
                  orderNumber: confirmed.orderNumber,
                  date: confirmed.payment.tracking.date,
                  uploadId: confirmed.payment.tracking.uploadId,
                })}
                className="btn-brand"
              >
                Захиалгын төлөв харах
              </Link>
            )}
            <Link to="/" className="btn-outline">
              Нүүр хуудас
            </Link>
          </div>
          {confirmed.payment?.tracking && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Энэ линкийг хадгалж аваарай — хэзээ ч буцаж орж төлбөр, бэлэн
              байдлаа шалгаж болно.
            </p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Онлайн захиалга"
        title="Захиалга өгөх"
        subtitle="Мэдээллээ бөглөөд илгээхэд зураг тань хамт очно."
      />

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-16 lg:grid-cols-[1fr_380px] lg:gap-10">
        <div>
          {/* ── Зурагтай мөрүүд ──────────────────────────────── */}
          <section>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-bold">1. Таны зураг</h2>
              <Link to="/hevlel" className="text-sm font-semibold text-brand-500">
                Засах
              </Link>
            </div>

            {basket.items.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-brand-200 px-4 py-8 text-center text-sm text-muted">
                Одоогоор зураг сонгоогүй байна.{' '}
                <Link to="/hevlel" className="font-semibold text-brand-500">
                  Хэвлэл хуудас руу очих
                </Link>
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {basket.items.map((item) => (
                  <li key={item.key} className="card p-2.5">
                    <span className="grid aspect-square place-items-center overflow-hidden rounded-sm bg-brand-50 text-2xl">
                      {item.value.preview ? (
                        <img
                          src={item.value.preview}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <IconImage className="size-6 text-brand-400" />
                      )}
                    </span>
                    <p className="mt-2 text-xs font-bold">
                      {sizeOf(item.service.name).label} × {item.value.qty}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {item.value.fileName}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Сагс + маягт ────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4 sm:p-5">
            <h2 className="text-lg font-bold sm:text-xl">2. Таны захиалга</h2>

            {lines.length === 0 ? (
              <p className="mt-4 rounded-md bg-brand-50 px-4 py-6 text-center text-sm text-muted">
                Одоогоор хоосон байна.
              </p>
            ) : (
              <ul className="mt-4 space-y-2 text-sm">
                {lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-3">
                    <span className="min-w-0 text-muted">
                      {line.name} × {line.qty}
                    </span>
                    <span className="shrink-0 font-semibold">
                      {formatCurrency(lineTotal(line))}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/*
              * Тоо, хэмжээг ЭНД засдаггүй.
              *
              * Мөр бүр нь тодорхой зурагтай хосолсон учир энд тоог өөрчилвөл
              * аль зургийг нь хэвлэхээ ойлгохгүй болно. Засах шаардлагатай бол
              * «Зураг засах» товчоор /hevlel руу буцна.
              */}
            {lines.length > 0 && (
              <Link
                to="/hevlel"
                className="mt-3 block text-center text-xs font-semibold text-brand-500 hover:underline"
              >
                Зураг, тоо ширхэг засах
              </Link>
            )}

            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={delivery}
                  onChange={(e) => setDelivery(e.target.checked)}
                  className="size-4 accent-[#1a56db]"
                />
                Хүргэлттэй (+{formatCurrency(DELIVERY_FEE)})
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vat}
                  onChange={(e) => setVat(e.target.checked)}
                  className="size-4 accent-[#1a56db]"
                />
                НӨАТ-тай баримт (+10%)
              </label>
            </div>

            <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Дүн</dt>
                <dd>{formatCurrency(base)}</dd>
              </div>
              {delivery && (
                <div className="flex justify-between text-muted">
                  <dt>Хүргэлт</dt>
                  <dd>{formatCurrency(deliveryFee)}</dd>
                </div>
              )}
              {vat && (
                <div className="flex justify-between text-muted">
                  <dt>НӨАТ (10%)</dt>
                  <dd>{formatCurrency(tax)}</dd>
                </div>
              )}
              <div className="flex justify-between pt-1.5 text-base font-black">
                <dt>Нийт</dt>
                <dd className="text-brand-500">{formatCurrency(total)}</dd>
              </div>
            </dl>
          </div>

          <div className="card mt-6 p-4 sm:p-5">
            <h2 className="text-lg font-bold sm:text-xl">3. Холбоо барих мэдээлэл</h2>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label" htmlFor="name">
                  Нэр *
                </label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  enterKeyHint="next"
                  aria-invalid={Boolean(errors.name)}
                  value={customer.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="field"
                  placeholder="Батболд"
                />
                {errors.name && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.name}
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="phone">
                  Утас *
                </label>
                <input
                  id="phone"
                  name="tel"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={8}
                  enterKeyHint="next"
                  aria-invalid={Boolean(errors.phone)}
                  value={customer.phone}
                  // Зөвхөн цифр — хэрэглэгч зай, зураас бичсэн ч шалгалтад унахгүй.
                  onChange={(e) => setField('phone', e.target.value.replace(/\D/g, ''))}
                  className="field"
                  placeholder="99001234"
                />
                {errors.phone && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.phone}
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="email">
                  И-мэйл
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  enterKeyHint="next"
                  aria-invalid={Boolean(errors.email)}
                  value={customer.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="field"
                  placeholder="name@example.com"
                />
                {errors.email && (
                  <p role="alert" className="mt-1 text-xs text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>

              <div>
                <label className="label" htmlFor="note">
                  Нэмэлт тайлбар
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={customer.note}
                  onChange={(e) => setField('note', e.target.value)}
                  className="field resize-y"
                  placeholder="Хэмжээ, өнгө, хугацаа гэх мэт…"
                />
              </div>
            </div>

            {errors.lines && (
              <p className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-xs text-red-600">
                {errors.lines}
              </p>
            )}

            {sendError && (
              <p
                role="alert"
                className="mt-4 rounded-sm bg-red-50 px-3 py-2 text-xs text-red-600"
              >
                {sendError}{' '}
                <a href={PRIMARY_PHONE.href} className="font-semibold underline">
                  {PRIMARY_PHONE.label}
                </a>
              </p>
            )}

            {progress && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted">
                  <span>
                    {progress.phase === 'prepare'
                      ? 'Зургийг хэвлэлд бэлдэж байна…'
                      : 'Зураг илгээж байна…'}
                  </span>
                  <span>
                    {progress.done}/{progress.total}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-brand-50">
                  <div
                    className="h-full rounded-full bg-brand-500 transition-[width]"
                    style={{ width: `${Math.round(progress.ratio * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  Цонхоо бүү хаагаарай — зураг илгээгдэж дуустал хүлээнэ үү.
                </p>
              </div>
            )}

            <button type="submit" disabled={sending} className="btn-accent mt-6 w-full">
              {sending ? (
                'Илгээж байна…'
              ) : (
                <>
                  Захиалга илгээх <IconArrowRight className="size-4" />
                </>
              )}
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              Илгээсний дараа ажлын цагт холбогдоно.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
