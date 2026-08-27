import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import { PRIMARY_PHONE } from '../data/site';
import {
  addLine,
  lineFromService,
  lineTotal,
  subtotal,
  type CustomerInfo,
  type FieldErrors,
  type OrderLine,
} from '../lib/order';
import { formatCurrency, isValidEmail, isValidPhone, vatPortion } from '../lib/price';
import { pickupBounds, validatePickup } from '../lib/pickup';
import { joinContact, splitContact } from '../lib/contact';
import DatePicker from '../components/DatePicker';
import PhotoLimitNote from '../components/PhotoLimitNote';
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
import { useLang } from '../state/lang';
import {
  IconAlert,
  IconArrowRight,
  IconCheckCircle,
  IconClose,
  IconImage,
} from '../components/icons';

const EMPTY_CUSTOMER: CustomerInfo = {
  /* Анхдагч нь хувь хүн — үйлчлүүлэгчдийн дийлэнх нь тийм. */
  kind: 'person',
  name: '',
  phone: '',
  email: '',
  note: '',
  address: '',
  pickupDate: '',
};

const validate = (customer: CustomerInfo, lines: readonly OrderLine[]): FieldErrors => {
  const errors: FieldErrors = {};
  if (!customer.name.trim()) errors.name = 'Нэрээ оруулна уу.';

  const phone = customer.phone.trim();
  const email = customer.email.trim();

  /*
   * ── Нэг талбар, хоёр төрөл ─────────────────────────────────────
   *
   * Алдааг үргэлж `phone` дээр тавина: интерфейс дээр талбар НЭГ л
   * ширхэг бөгөөд түүний `id` нь `contact`. Хоёр өөр түлхүүр ашиглавал
   * «эхний алдаатай талбар руу очих» логик аль нэгийг нь олохгүй.
   *
   * Бичсэн зүйл нь ЗӨВ хэлбэртэй байх ёстой: буруу дугаар нь хоосон
   * талбараас ДОР, учир нь ажилтан залгаад холбогдохгүй байхад
   * «хэрэглэгч утсаа авахгүй байна» гэж бодож цаг алдана.
   */
  if (!phone && !email) errors.phone = 'Утас эсвэл и-мэйлээ оруулна уу.';
  else if (phone && !isValidPhone(phone))
    errors.phone = '8 оронтой дугаар оруулна уу (жишээ: 99001234).';
  else if (email && !isValidEmail(email))
    errors.phone = 'И-мэйл хаяг буруу байна.';

  const pickup = validatePickup(customer.pickupDate);
  if (pickup) errors.pickupDate = pickup;

  if (lines.length === 0) errors.lines = 'Дор хаяж нэг зураг сонгоно уу.';
  return errors;
};

interface OrderProps {
  /**
   * `page` — өөрийн хуудсаараа (`/zakhialga`). Шууд линк, буцах товч ажиллана.
   * `modal` — `/hevlel` дээрээс сагсанд нэмэх даруйд гарч ирэх цонх.
   *
   * ⚠️ Хоёр горим ИЖИЛ компонентыг хуваалцана. Урьд нь маягтыг хоёр газар
   * хуулбарлах санал байсан ч тэр нь баталгаатай алдаа: талбар нэмэхэд нэгийг
   * нь мартаж, хэрэглэгч аль замаар орсноосоо хамаараад өөр маягт хардаг
   * болно. Ялгаа нь зөвхөн ГАДНА бүрхүүлд — доторх логик нэг.
   */
  variant?: 'page' | 'modal';
  /** Зөвхөн `modal` горимд. */
  onClose?: () => void;
  /**
   * «Засах» — зураг оруулах цонх руу буцаана (зөвхөн `modal` горимд).
   *
   * Өгөөгүй бол товч ОГТ гарахгүй: буцах газаргүй байхад товч харуулбал
   * хэрэглэгч дарж, юу ч болохгүйд эргэлзэнэ.
   */
  onEdit?: () => void;
}

export default function Order({ variant = 'page', onClose, onEdit }: OrderProps = {}) {
  const asModal = variant === 'modal';
  const basket = useBasket();
  /*
   * Энэ хуудас бүхэлдээ хараахан орчуулагдаагүй. Гэхдээ «Тохиролцоно» нь
   * ҮНИЙН талбарт гардаг тул англи горимд кириллээр үлдэж болохгүй —
   * хэрэглэгч дүнг буруу ойлгоно.
   */
  const { t } = useLang();
  const byAgreement = t('custom.byAgreement');

  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);

  /**
   * Холбоо барих талбарт ХЭРЭГЛЭГЧИЙН бичсэн ТҮҮХИЙ мөр.
   *
   * ⚠️ Энэ тусдаа төлөв ЗААВАЛ хэрэгтэй. Эхний хувилбар нь талбарын утгыг
   * `joinContact(customer)`-оос гаргадаг байсан бөгөөд и-мэйл бичих
   * боломжгүй болгож байв:
   *
   *   «n» → `@` алга → цифр гэж үзээд цифр биш бүхнийг хаяна → «»
   *   «na» → «» … `@` хүртэл нэг ч тэмдэгт үлдэхгүй.
   *
   * Хэрэглэгч и-мэйлээ бичих гэж оролдоод талбар нь хоосон хэвээр байхыг
   * хараад «сайт эвдэрсэн» гэж бодно. Тиймээс бичсэнийг нь ХЭВЭЭР
   * харуулж, `splitContact`-ыг зөвхөн СЕРВЕР рүү явуулах утгад хэрэглэнэ.
   */
  const [contactText, setContactText] = useState(() => joinContact(EMPTY_CUSTOMER));
  /** Цонхны гүйдэг хэсэг — илгээсний дараа дээш нь авчрахад. */
  const modalScroller = useRef<HTMLDivElement>(null);
  /*
   * ⚠️ НӨАТ-ыг ЭНД төлөвлөхөө болив — сагсанд амьдардаг болсон.
   *
   * Хэрэглэгч түүнийг зураг нэмэх цонхноос сонгодог болсон тул энд тусдаа
   * төлөв барьвал хоёр өөр утга үүсч, товчны дээр харсан дүн нь эцсийн
   * дүнтэй таарахаа болино.
   */
  const vat = basket.vat;
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
  const tax = vat ? vatPortion(base) : 0;
  const total = base + tax;

  /* `<input type="date">`-ийн хил — хуудас нээгдэхэд нэг л удаа тооцно. */
  const bounds = useMemo(() => pickupBounds(), []);

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
      const firstField = (['name', 'phone', 'pickupDate'] as const).find((key) => found[key]);
      if (firstField) {
        // Утас/и-мэйл НЭГ талбар тул түүний `id` нь `contact`.
        const element = document.getElementById(firstField === 'phone' ? 'contact' : firstField);
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
        /*
         * ⚠️ Хүргэлтийг ТҮР ХААСАН — интерфейсээс ч, эндээс ч.
         *
         * Сервер тал нь `delivery` + хаягийг хүлээн авах чадвартай хэвээр
         * (`api/_shared.ts`), тиймээс буцаан асаахад зөвхөн интерфейс л
         * хэрэгтэй. Энд `false` гэж ХАТУУ бичсэн нь санамсаргүй биш:
         * төлөв нь үлдээд, хаана ч солигддоггүй бол унтраасан эсэх нь
         * кодоос харагдахгүй болно.
         */
        delivery: false,
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
      /*
       * ⚠️ Цонх горимд `window.scrollTo` нь БУРУУ зүйлийг гүйлгэнэ: гүйлт нь
       * цонхны дотоод хэсэгт байдаг тул хуудас хөдөлж, цонх байрандаа үлдэнэ —
       * хэрэглэгч баталгаажуулалтын оройг харахгүй.
       */
      if (asModal) {
        modalScroller.current?.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : 'Захиалга илгээхэд алдаа гарлаа.',
      );
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  /*
   * ⚠️ Баталгаажуулалт нь ЭРТ БУЦДАГ байсныг зассан.
   *
   * `if (confirmed) return (...)` нь доорх portal бүрхүүлийг БҮРМӨСӨН
   * алгасдаг байв. Цонх горимд үүний үр дүнд баталгаажуулалт нь Print
   * хуудасны ДОТОР шууд зурагдаж, ард нь хэвлэлийн хуудас хэвээр харагдаж,
   * дээр нь `PageHero` (хуудасны толгой) хамт гарч — хоёр хуудас
   * давхарласан мэт харагддаг байлаа.
   *
   * Одоо энэ нь ердөө агуулгын нэг хувилбар: доод талын НЭГ бүрхүүл
   * хоёуланг нь адилхан ороож өгнө.
   */
  const confirmedContent = confirmed && (
      <>
        {!asModal && (
          <PageHero
            eyebrow="Захиалга"
            title="Захиалга хүлээн авлаа"
            subtitle="Ажлын цагт операторууд тань руу залгаж баталгаажуулна."
          />
        )}
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
                Төлбөр шалгах
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

  const formContent = (
    <>
      {!asModal && (
        <PageHero
          eyebrow="Онлайн захиалга"
          title="Захиалга өгөх"
          subtitle="Мэдээллээ бөглөөд илгээхэд зураг тань хамт очно."
        />
      )}

      {/*
        * Цонх горимд НЭГ баганаар. Хоёр багана (зураг | маягт) нь өргөн
        * дэлгэцэд зориулагдсан бөгөөд цонхны дотор багтахгүй — хэрэглэгч
        * хажуу тийш гүйлгэх болно.
        */}
      <div
        className={
          asModal
            ? 'grid gap-6 px-4 py-5 sm:px-6'
            : 'mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 sm:py-16 lg:grid-cols-[1fr_380px] lg:gap-10'
        }
      >
        {/*
          * ⚠️ Зураг ба захиалгын хураангуй нь ЗӨВХӨН хуудас горимд.
          *
          * Цонх нь зураг оруулах цонхны ДАРАА шууд гардаг тул хэрэглэгч
          * зургаа, ширхэгээ, дүнгээ тэндээ дөнгөж сая харсан байна. Дахин
          * харуулбал нэг мэдээлэл хоёр удаа гарч, цонх уртсаж, холбоо барих
          * талбар нугалаас доош унана.
          *
          * Хуудас горимд (`/zakhialga` руу шууд линкээр орсон) эдгээр
          * ЗААВАЛ хэрэгтэй — тэр хүн зураг оруулах цонхыг огт хараагүй.
          */}
        {!asModal && (
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
        )}

        {/* ── Сагс + маягт ────────────────────────────────────── */}
        <form
          onSubmit={handleSubmit}
          className={asModal ? undefined : 'lg:sticky lg:top-24 lg:self-start'}
        >
          {!asModal && (
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
                    {/*
                      * Үнэгүй мөр = тохиролцооны хэмжээ (жишээ нь «өөр
                      * хэмжээ»). «0₮» гэж харуулбал хэрэглэгч үнэгүй гэж
                      * ойлгож, ажилтан үнэ хэлэхэд гайхна.
                      */}
                    <span className="shrink-0 font-semibold">
                      {line.unitPrice > 0
                        ? formatCurrency(lineTotal(line))
                        : byAgreement}
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

            {/*
              ⚠️ ХҮРГЭЛТ ТҮР ХААГДСАН.
              Сонголтын дөрвөлжин болон хаягийн талбарыг эндээс хассан.
              Сервер тал (`api/_shared.ts`) нь `delivery` + хаягийг хүлээн
              авах чадвартай хэвээр тул буцаан асаахад зөвхөн энэ хэсгийг
              сэргээхэд хангалттай.
            */}
            {/*
              НӨАТ-ын сонголт зураг нэмэх цонх руу НҮҮСЭН — хэрэглэгч дүнг
              тэндээс шууд хардаг. Гэвч энд ч ҮЛДЭЭВ: `/zakhialga` руу шууд
              линкээр орсон хүн зураг нэмэх цонхыг огт харахгүй тул үгүй бол
              НӨАТ сонгох бололцоогүй болно.

              ⚠️ Хоёул САГСНЫ нэг утгыг уншиж бичнэ — тусдаа төлөв барьвал
              товчны дээр харсан дүн эцсийн дүнтэй таарахаа болино.
            */}
            <div className="mt-4 space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vat}
                  onChange={(e) => basket.setVat(e.target.checked)}
                  className="size-4 accent-brand-500"
                />
                НӨАТ-тай баримт (+10%)
              </label>
            </div>

            {/*
              Хязгаар, илгээх хугацааг ЭНД дахин хэлнэ.

              Хэрэглэгч хэвлэлийн хуудсан дээр анзаараагүй байж болно;
              илгээх товч дарахын өмнөх сүүлчийн боломж нь энэ. 100 зураг
              нь гар утасны сүлжээгээр 40+ минут — үүнийг мэдэлгүй эхэлсэн
              хүн дундуур нь табаа хааж, аль хэдийн орсон зураг ч дэмий
              болно.
            */}
            <PhotoLimitNote photos={photoCount} />

            <dl className="mt-4 space-y-1.5 border-t border-hairline pt-4 text-sm">
              <div className="flex justify-between text-muted">
                <dt>Дүн</dt>
                <dd>{formatCurrency(base)}</dd>
              </div>
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

              {/* Тохиролцооны мөр дүнд ороогүйг ил хэлнэ. */}
              {lines.some((line) => line.unitPrice === 0) && (
                <p className="mt-2 rounded-md bg-accent/10 px-3 py-2 text-[11px] leading-relaxed text-accent-strong">
                  {t('custom.totalNote')}
                </p>
              )}
            </dl>
          </div>
          )}

          <div className={asModal ? 'card p-4 sm:p-5' : 'card mt-6 p-4 sm:p-5'}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold sm:text-xl">
                {asModal ? 'Холбоо барих мэдээлэл' : '3. Холбоо барих мэдээлэл'}
              </h2>
              {/*
                Зураг, ширхэг, НӨАТ бүгд зураг оруулах цонхонд тохирогддог тул
                «Засах» нь ТЭР цонх руу буцаана — сагсны хуудас руу биш.
              */}
              {asModal && onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="shrink-0 text-sm font-semibold text-brand-500"
                >
                  Засах
                </button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              {/*
                ── Захиалагчийн төрөл ─────────────────────────────────

                Нэрний талбарын ДЭЭР байрлана: сонголт нь доорх талбарын
                утгыг өөрчилдөг (хүний нэр үү, байгууллагын нэр үү) тул
                эхлээд асуух нь уншигдах дараалалд зөв.

                НӨАТ-ын баримт хоёр төрөлд өөр бөглөгддөг тул ажилтанд энэ
                мэдээлэл захиалгын хамт очно.
              */}
              <div>
                <label className="label" htmlFor="kind">
                  Захиалагч
                </label>
                <select
                  id="kind"
                  name="kind"
                  value={customer.kind}
                  onChange={(e) => setField('kind', e.target.value as CustomerInfo['kind'])}
                  className="field"
                >
                  <option value="person">Хувь хүн</option>
                  <option value="org">Байгууллага</option>
                </select>
              </div>

              <div>
                <label className="label" htmlFor="name">
                  {customer.kind === 'org' ? 'Байгууллагын нэр' : 'Нэр'} *
                </label>
                <input
                  id="name"
                  name="name"
                  autoComplete={customer.kind === 'org' ? 'organization' : 'name'}
                  enterKeyHint="next"
                  aria-invalid={Boolean(errors.name)}
                  value={customer.name}
                  onChange={(e) => setField('name', e.target.value)}
                  className="field"
                  placeholder={customer.kind === 'org' ? 'Блюрайгел ХХК' : 'Батболд'}
                />
                {errors.name && (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {errors.name}
                  </p>
                )}
              </div>

              {/*
                ── Утас ба и-мэйл НЭГ талбарт ────────────────────────

                Хоёр талбар зэрэгцэн байхад аль нэгийг нь л бөглөх ёстой
                гэдэг нь маягтаас ХАРАГДДАГГҮЙ: хэрэглэгч хоёуланг нь бөглөх
                гэж оролдоод, и-мэйлгүй бол «дутуу бөглөлөө» гэж эргэлзэнэ.

                Бичсэнийг нь `splitContact` задалж `phone` / `email` болгоно
                — сервер тал ХУВААГДСАН хэвээр, учир нь Konica апп дээрх
                `WorkLog.phone` нь тусдаа талбар бөгөөд ажилтан түүгээр
                шүүж, дарж залгадаг.

                ⚠️ `type="text"` — `type="tel"` БИШ. `tel` нь утсан дээр
                зөвхөн цифрийн гар гаргадаг тул и-мэйл бичих боломжгүй
                болно. `inputMode` ч тавихгүй: хэрэглэгч юу бичихээ өөрөө
                мэднэ, хөтөч бүтэн гар гаргах нь зөв.
              */}
              <div>
                <label className="label" htmlFor="contact">
                  Утас эсвэл и-мэйл <span className="text-danger">*</span>
                </label>
                <input
                  id="contact"
                  name="contact"
                  type="text"
                  autoComplete="tel"
                  enterKeyHint="next"
                  aria-invalid={Boolean(errors.phone)}
                  aria-describedby={errors.phone ? undefined : 'contact-hint'}
                  value={contactText}
                  onChange={(e) => {
                    const typed = e.target.value;
                    setContactText(typed);
                    const { phone, email } = splitContact(typed);
                    setCustomer((c) => ({ ...c, phone, email }));
                    setErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  className="field"
                  placeholder="99001234 эсвэл name@example.com"
                />
                {errors.phone ? (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {errors.phone}
                  </p>
                ) : (
                  <p id="contact-hint" className="mt-1 text-xs text-muted">
                    Захиалга бэлэн болоход бид эндүүр холбогдоно.
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

              {/*
                ── Хүлээж авах өдөр ──────────────────────────────────

                Хөтөчийн төрөлх `<input type="date">`-ийг орлосон. Тэр нь
                найдвартай ч хаалттай өдрийг (Мягмар) унтраах боломжгүй
                байсан тул хэрэглэгч сонгоод л, дараа нь алдаа хардаг байв.
                Мөн хэлбэр нь үйлдлийн системийн хэлээр гардаг — монгол
                хуудсан дээр `mm/dd/yyyy`.

                Заавал БИШ: «хэзээ бэлэн болохыг мэдэхгүй» хэрэглэгч
                захиалгаа дуусгалгүй гарах эрсдэлээс сэргийлнэ.
              */}
              <div>
                <label className="label" htmlFor="pickupDate">
                  Хэзээ ирж авах вэ?{' '}
                  <span className="font-normal text-muted">(сонголтоор)</span>
                </label>
                <DatePicker
                  id="pickupDate"
                  value={customer.pickupDate}
                  onChange={(next) => setField('pickupDate', next)}
                  min={bounds.min}
                  max={bounds.max}
                  invalid={Boolean(errors.pickupDate)}
                  describedBy={errors.pickupDate ? undefined : 'pickup-hint'}
                />
                {errors.pickupDate ? (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {errors.pickupDate}
                  </p>
                ) : (
                  <p id="pickup-hint" className="mt-1 text-xs text-muted">
                    Ажлын цаг: 10:00–18:00. Мягмар гарагт хаалттай.
                  </p>
                )}
              </div>
            </div>

            {errors.lines && (
              <p className="mt-4 rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger">
                {errors.lines}
              </p>
            )}

            {sendError && (
              <p
                role="alert"
                className="mt-4 rounded-sm bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                {sendError}{' '}
                <a href={PRIMARY_PHONE.href} className="font-semibold underline">
                  {PRIMARY_PHONE.label}
                </a>
              </p>
            )}

            {progress && (
              <div className="mt-4">
                {/*
                  ⚠️ НЭГ мөр, НЭГ тоолуур.
                  Урьд нь «бэлдэж байна» / «илгээж байна» гэсэн хоёр үе шат
                  тусад нь харагддаг байсан тул мөр 3/3 болоод 0/3 руу буцдаг
                  байв. Одоо зураг бүр бэлдэгдээд тэр даруй илгээгддэг тул
                  үнэхээр нэг үе шат болов.

                  Тоо нь ЗУРГААР явна (файлаар биш) — зураг бүрээс хоёр файл
                  гардаг тул «24/60» гэж харуулбал хэрэглэгч ойлгохгүй.
                */}
                <div className="flex justify-between text-xs text-muted">
                  <span>Зураг илгээж байна…</span>
                  <span className="tabular-nums">
                    {progress.done}/{progress.total} зураг
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

            {/*
              ⚠️ Цонх горимд НИЙТ дүнг ЗААВАЛ харуулна.

              Захиалгын хураангуй нуугдсан тул үүнгүй бол хэрэглэгч төлөх
              дүнгээ ХАРАЛГҮЙ «Захиалга илгээх» дарах болно. Мөнгө холбогдсон
              үйлдлийн өмнө дүн нь нүдний өмнө байх ёстой.
            */}
            {asModal && (
              <dl className="mt-5 space-y-1.5 border-t border-hairline pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Дүн</dt>
                  <dd>{formatCurrency(base)}</dd>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-muted">НӨАТ</dt>
                    <dd>{formatCurrency(tax)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-hairline pt-1.5 text-base font-black">
                  <dt>Нийт</dt>
                  <dd className="text-brand-500">{formatCurrency(total)}</dd>
                </div>
              </dl>
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

  const content = confirmedContent || formContent;

  if (!asModal) return content;

  /*
   * Цонх нь `document.body` дээр portal-аар зурагдана.
   *
   * `PhotoEditor`-той ЯГ адил шалтгаанаар: `<main>` дээрх `page-enter`
   * хөдөлгөөн нь `transform`-ыг идэвхтэй үлдээдэг тул `position: fixed` нь
   * дэлгэц биш `<main>`-ы өндөр рүү суудаг. Portal тэр гинжийг тасална.
   */
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={confirmed ? 'Захиалга хүлээн авлаа' : 'Захиалга өгөх'}
      className="fixed inset-0 z-60 flex items-end justify-center bg-ink/60 backdrop-blur-sm sm:items-center"
      onClick={(event) => {
        /* Зөвхөн ДЭВСГЭР дээр дарахад хаана — дотор дарахад биш. */
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-xl bg-canvas sm:max-h-[88dvh] sm:rounded-xl">
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3 sm:px-6">
          {/* Илгээсний дараа гарчиг ч өөрчлөгдөнө — «Захиалга өгөх» гэсэн
              хэвээр үлдвэл хэрэглэгч илгээгдсэн эсэхэд эргэлзэнэ. */}
          <h2 className="text-base font-bold">
            {confirmed ? 'Захиалга хүлээн авлаа' : 'Захиалга өгөх'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="grid size-9 shrink-0 place-items-center rounded-md hover:bg-brand-50"
          >
            <IconClose className="size-5" />
          </button>
        </div>

        {/*
          * ⚠️ Гүйлт нь ЭНД, гадна биш. Гадна талд тавибал утсан дээр цонхны
          * толгой ч хамт гүйж, хаах товч дэлгэцээс гарна.
          */}
        <div ref={modalScroller} className="min-h-0 flex-1 overflow-y-auto">
          {content}
        </div>
      </div>
    </div>,
    document.body,
  );
}
