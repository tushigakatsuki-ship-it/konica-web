import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHero from '../components/PageHero';
import {
  SERVICES,
  SERVICE_CATEGORIES,
  type ServiceCategory,
} from '../data/catalog';
import { CONTACT } from '../data/site';
import {
  DELIVERY_FEE,
  addLine,
  isCustomPrice,
  lineFromService,
  lineTotal,
  removeLine,
  subtotal,
  updateLine,
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
  if (lines.length === 0) errors.lines = 'Дор хаяж нэг үйлчилгээ сонгоно уу.';
  return errors;
};

export default function Order() {
  const [params, setParams] = useSearchParams();
  const basket = useBasket();

  const categoryParam = params.get('category') as ServiceCategory | null;
  const active: ServiceCategory =
    categoryParam && SERVICE_CATEGORIES.includes(categoryParam)
      ? categoryParam
      : SERVICE_CATEGORIES[0];

  const [query, setQuery] = useState('');
  const [extra, setExtra] = useState<OrderLine[]>([]);
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

  /** Сагснаас ирсэн зурагтай мөрүүд — ижил үйлчилгээг нэгтгэнэ. */
  const photoLines = useMemo(
    () =>
      basket.items.reduce<OrderLine[]>(
        (acc, item) => addLine(acc, lineFromService(item.service, item.value.qty)),
        [],
      ),
    [basket.items],
  );

  const lines = useMemo(
    () => extra.reduce<OrderLine[]>((acc, line) => addLine(acc, line), [...photoLines]),
    [extra, photoLines],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SERVICES.filter((s) =>
      q ? s.name.toLowerCase().includes(q) : s.category === active,
    );
  }, [active, query]);

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
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-ok/10 text-3xl">
            <span aria-hidden>✅</span>
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
            <p className="mt-6 rounded-md bg-accent/10 px-4 py-3 text-sm leading-relaxed text-accent-strong">
              ⚠️ Зураг хүлээн авах систем түр ажиллахгүй байна. Захиалга тань
              бүртгэгдсэн — ажилтан тань руу залгаж зургийг тань авна.
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
            <a href={CONTACT.phoneHref} className="font-semibold text-accent">
              {CONTACT.phone}
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
                Засах →
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
                        <span aria-hidden>🖼️</span>
                      )}
                    </span>
                    <p className="mt-2 text-xs font-bold">
                      {sizeOf(item.service.name).label} × {item.value.qty}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {item.value.fileName ?? '⚠️ зураг ороогүй'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Нэмэлт үйлчилгээ ─────────────────────────────── */}
          <section className="mt-10">
            <h2 className="text-xl font-bold">2. Нэмэлт үйлчилгээ</h2>
            <p className="mt-1 text-sm text-muted">
              Өргөмжлөл, медаль, фудболк гэх мэт зурагнаас өөр ажил байвал энэ хэсгээс.
            </p>

            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Үйлчилгээ хайх… (жишээ: өргөмжлөл)"
              className="field mt-4"
            />

            {!query && (
              <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
                <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
                  {SERVICE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setParams({ category: cat })}
                      className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                        cat === active
                          ? 'bg-brand-500 text-white'
                          : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ul className="mt-6 divide-y divide-hairline rounded-lg border border-hairline">
              {visible.map((service) => (
                <li
                  key={service.id}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-brand-50/50 sm:gap-4 sm:px-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{service.name}</p>
                    <p className="text-xs text-muted">
                      {service.category}
                      {isCustomPrice(service.category) && ' · тохиролцоогоор'}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-brand-500">
                    {service.price}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExtra((ls) => addLine(ls, lineFromService(service)));
                      setErrors((e) => ({ ...e, lines: undefined }));
                    }}
                    className="shrink-0 rounded-sm bg-accent px-3 py-1.5 text-xs font-bold text-white hover:bg-accent-strong"
                  >
                    + Нэмэх
                  </button>
                </li>
              ))}
              {visible.length === 0 && (
                <li className="px-4 py-10 text-center text-sm text-muted">
                  Тохирох үйлчилгээ олдсонгүй.
                </li>
              )}
            </ul>
          </section>
        </div>

        {/* ── Сагс + маягт ────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-4 sm:p-5">
            <h2 className="text-lg font-bold sm:text-xl">3. Таны захиалга</h2>

            {lines.length === 0 ? (
              <p className="mt-4 rounded-md bg-brand-50 px-4 py-6 text-center text-sm text-muted">
                Одоогоор хоосон байна.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {lines.map((line) => {
                  const fromPhotos = photoLines.some((p) => p.id === line.id);
                  return (
                    <li key={line.id} className="border-b border-hairline pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">
                          {line.name}
                          {fromPhotos && (
                            <span className="ml-1 text-[11px] text-muted">🖼</span>
                          )}
                        </p>
                        {!fromPhotos && (
                          <button
                            type="button"
                            aria-label="Хасах"
                            onClick={() => setExtra((ls) => removeLine(ls, line.id))}
                            className="shrink-0 text-muted hover:text-ink"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        {fromPhotos ? (
                          <span className="text-sm text-muted">{line.qty} ш</span>
                        ) : (
                          <div className="flex items-center rounded-sm border border-hairline">
                            <button
                              type="button"
                              aria-label="Хорогдуулах"
                              onClick={() =>
                                setExtra((ls) =>
                                  updateLine(ls, line.id, {
                                    qty: Math.max(1, line.qty - 1),
                                  }),
                                )
                              }
                              className="px-2.5 py-1 text-sm"
                            >
                              −
                            </button>
                            <span className="w-9 text-center text-sm font-semibold">
                              {line.qty}
                            </span>
                            <button
                              type="button"
                              aria-label="Нэмэгдүүлэх"
                              onClick={() =>
                                setExtra((ls) =>
                                  updateLine(ls, line.id, { qty: line.qty + 1 }),
                                )
                              }
                              className="px-2.5 py-1 text-sm"
                            >
                              +
                            </button>
                          </div>
                        )}

                        {isCustomPrice(line.category) && !fromPhotos ? (
                          <label className="flex flex-1 items-center gap-1">
                            <span className="sr-only">Тохиролцсон нэгж үнэ</span>
                            <input
                              type="number"
                              min={0}
                              step={100}
                              value={line.unitPrice}
                              onChange={(e) =>
                                setExtra((ls) =>
                                  updateLine(ls, line.id, {
                                    unitPrice: Number(e.target.value) || 0,
                                  }),
                                )
                              }
                              className="w-full rounded-sm border border-hairline px-2 py-1 text-right text-sm"
                            />
                            <span className="text-sm text-muted">₮</span>
                          </label>
                        ) : (
                          <span className="flex-1 text-right text-sm font-bold">
                            {formatCurrency(lineTotal(line))}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
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
            <h2 className="text-lg font-bold sm:text-xl">4. Холбоо барих мэдээлэл</h2>

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
                <a href={CONTACT.phoneHref} className="font-semibold underline">
                  {CONTACT.phone}
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
              {sending ? 'Илгээж байна…' : 'Захиалга илгээх →'}
            </button>
            <p className="mt-3 text-center text-xs text-muted">
              Илгээсний дараа {CONTACT.hours} хооронд холбогдоно.
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
