/**
 * Захиалгыг баталгаажуулж Firebase-д бичихэд хэрэгтэй цэвэр функцууд.
 *
 * `_`-ээр эхэлсэн файлыг Vercel тусдаа function болгодоггүй тул энд байрлуулав.
 * Сүлжээний дуудлагагүй тул `api/order.test.mjs` энэ бүхнийг шууд шалгана.
 */

import { SERVICES } from '../src/data/catalog';
import { VAT_RATE, isValidPhone } from '../src/lib/price';
import { CUSTOM_PRICE_CATEGORIES, DELIVERY_FEE } from '../src/lib/order';

// ── Оролт ──────────────────────────────────────────────────────────

export interface IncomingLine {
  id: number;
  qty: number;
  /** Зөвхөн тохиролцооны категорид хүчинтэй; бусад тохиолдолд үл хэрэгсэнэ. */
  unitPrice?: number;
}

export interface IncomingOrder {
  customer: {
    name: string;
    phone: string;
    email?: string;
    note?: string;
    /** Хүргэлтийн хаяг — `delivery: true` үед заавал. */
    address?: string;
  };
  lines: IncomingLine[];
  delivery: boolean;
  vat: boolean;
}

export const MAX_LINES = 50;
export const MAX_QTY = 10_000;
/** Тохиролцооны үнийн дээд хязгаар — гар алдаа, хорон санааг хоёуланг нь таслана. */
export const MAX_CUSTOM_UNIT_PRICE = 10_000_000;

// ── Гаралт ─────────────────────────────────────────────────────────

/** printmn-expo `types/index.ts` → `Order` */
export interface Order {
  id: number;
  paymentType: string;
  desc: string;
  price: number;
  time: string;
  /** Нэмэлт талбар — rules дээр `$other: true` тул зөвшөөрөгдөнө. */
  source: 'web';
  createdAt: number;
  orderNumber: string;
}

/** printmn-expo `types/index.ts` → `WorkLog` */
export interface WorkLog {
  id: number;
  date: string;
  /**
   * Өдрийн дараалал. `workLogLogic.ts → newestFirst` эхлээд үүгээр эрэмбэлдэг
   * тул орхивол `Number(undefined) || 0` = 0 болж, вэб захиалга апп дээр
   * өнөөдрийн жагсаалтын хамгийн доор — шинэ ажил хамгийн дээр байх ёстой атал.
   */
  no?: number;
  job: string;
  receivedTime: string;
  deadline: string;
  phone: string;
  delivery: string;
  note: string;
  status: string;
  color: string;
  price: string;
  unitPrice: string;
  quantity: number;
  payType: string;
  isDelivery: boolean;
  isTomorrow: boolean;
  customer: string;
  customerType: string;
  paymentStatus: string;
  hasVat: boolean;
  orderDate: string;
  agreedPrice: string;
  source: 'web';
  orderNumber: string;
}

export interface PricedLine {
  id: number;
  name: string;
  unitPrice: number;
  qty: number;
  total: number;
}

export interface BuiltOrder {
  orderNumber: string;
  lines: PricedLine[];
  base: number;
  deliveryFee: number;
  /** Хүргэлтийн хаяг — хүргэлтгүй бол хоосон. */
  address: string;
  tax: number;
  total: number;
  /** Firebase зангилаа → бичих бичлэгүүд. */
  orders: Record<string, Order>;
  worklogs: Record<string, WorkLog>;
}

export class ValidationError extends Error {}

// ── Туслахууд ──────────────────────────────────────────────────────

/**
 * Огноо, цагийг ЗААВАЛ Улаанбаатарын цагаар.
 *
 * `utils/date.ts` дээр "never toISOString, UTC would roll the day over at
 * 08:00 local" гэж бичсэн — гэхдээ тэр код Монгол дахь төхөөрөмж дээр ажилладаг
 * тул `getDate()` нь аль хэдийн орон нутгийн цаг байсан. Vercel-ийн сервер
 * UTC-ээр явдаг учир яг эсрэгээрээ: шөнийн 00:00–08:00 хооронд ирсэн захиалга
 * ӨМНӨХ өдрийн огноотой бичигдэж, `visibleWorkLogs`-ийн `date === today`
 * шүүлтүүрээс унаад апп-ын өнөөдрийн самбарт огт харагдахгүй болно.
 */
const MN_TZ = 'Asia/Ulaanbaatar';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: MN_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: MN_TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** `2026-08-06` — Улаанбаатарын огноо. */
const toDateString = (d: Date): string => dateFormatter.format(d);

/** `14:05` — Улаанбаатарын цаг. */
const nowTimeString = (d: Date): string => timeFormatter.format(d);

/** Улаанбаатарын өнөөдөр — Firebase-ийн `orderBy="date"` асуултад хэрэглэнэ. */
export const mongolianToday = (d: Date = new Date()): string => toDateString(d);

const byId = new Map(SERVICES.map((s) => [s.id, s]));

const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

const clean = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

/**
 * `utils/id.ts` — `Date.now()` дангаараа давхцаж болно. id нь Firebase-ийн
 * хүүхэд зам учраас давхцвал нэг бичлэг нөгөөгөө дарж устгана.
 */
const makeIdGenerator = () => {
  let last = 0;
  return (): number => {
    const now = Date.now();
    last = now > last ? now : last + 1;
    return last;
  };
};

/**
 * Нэг өдөрт хэдэн удаа дугаар сонгож үзэх вэ.
 *
 * 12 оролдлого нь өдөрт 4000 захиалга байсан ч (боломжит 9000-аас) чөлөөт
 * дугаар олох магадлалыг 99.99%-иас дээш байлгана. Хязгаар тавьсан нь
 * `taken` олонтой үед мөнхийн давталтад орохоос сэргийлэх зорилготой.
 */
const NUMBER_TRIES = 12;

/**
 * `PMN-260806-4821` — огнооны хэсэг нь мөн Улаанбаатарын цагаар.
 *
 * ── Яагаад `taken` параметр вэ ────────────────────────────────────
 *
 * Сүүлийн 4 орон нь санамсаргүй тул өдөрт 9000 л боломж байна. Төрсөн өдрийн
 * парадоксоор өдрийн 50 захиалгад давхцах магадлал **12.7%** хүрнэ (20 захиалгад
 * 2.1%). Дугаар нь БАНКНЫ ГҮЙЛГЭЭНИЙ УТГА болдог тул давхцвал хоёр
 * үйлчлүүлэгч ижил утгаар мөнгө шилжүүлж, аль нь төлснийг ялгах арга байхгүй
 * болно.
 *
 * Тиймээс дуудагч тал тухайн өдөр аль хэдийн ашиглагдсан дугааруудыг өгнө.
 *
 * `random` нь тоо ч, функц ч байж болно: тест тогтмол утга өгдөг, production
 * дээр `Math.random` өөрөө орж, оролдлого бүрт шинэ утга гаргана.
 */
export const makeOrderNumber = (
  now: Date,
  random: number | (() => number) = Math.random,
  taken: ReadonlySet<string> = new Set(),
): string => {
  const draw = typeof random === 'function' ? random : () => random;
  const prefix = `PMN-${toDateString(now).slice(2).replaceAll('-', '')}-`;
  const make = (): string => `${prefix}${String(Math.floor(1000 + draw() * 9000))}`;

  let candidate = make();
  for (let attempt = 1; attempt < NUMBER_TRIES && taken.has(candidate); attempt += 1) {
    candidate = make();
  }
  /*
   * Бүх оролдлого дүүрсэн ч буцаана. Өдөрт 9000 дугаар дүүрэх нь бодит биш
   * бөгөөд захиалгыг ЭНЭ шалтгаанаар унагах нь давхцлаас хамаагүй дор —
   * хэрэглэгч мөнгөө төлж чадахгүй болно.
   */
  return candidate;
};

// ── Баталгаажуулалт + бүтээх ───────────────────────────────────────

/**
 * Клиентээс ирсэн үнэд ХЭЗЭЭ Ч итгэхгүй — каталогоос дахин хайж тооцно.
 * Зөвхөн тохиролцооны категорид (`Медаль & Цом`, `Хувцас хэвлэл`) хэрэглэгчийн
 * оруулсан үнийг, хязгаарын дотор байвал, хүлээж авна.
 */
export function buildOrder(
  input: unknown,
  now: Date = new Date(),
  random: number | (() => number) = Math.random,
  /** Тухайн өдөр аль хэдийн ашиглагдсан захиалгын дугаарууд. */
  taken: ReadonlySet<string> = new Set(),
): BuiltOrder {
  if (typeof input !== 'object' || input === null)
    throw new ValidationError('Захиалгын өгөгдөл буруу байна.');

  const body = input as Partial<IncomingOrder>;
  const customerInput = (body.customer ?? {}) as Partial<IncomingOrder['customer']>;

  const name = clean(customerInput.name, 60);
  const phone = clean(customerInput.phone, 20);
  const email = clean(customerInput.email, 120);
  const note = clean(customerInput.note, 1000);
  const address = clean(customerInput.address, 300);

  if (!name) throw new ValidationError('Нэр хоосон байна.');
  if (!isValidPhone(phone)) throw new ValidationError('Утасны дугаар буруу байна.');
  if (email && !/^\S+@\S+\.\S+$/.test(email))
    throw new ValidationError('И-мэйл хаяг буруу байна.');

  /*
   * Хүргэлт сонгосон бол хаяг ЗААВАЛ.
   *
   * ⚠️ Энэ шалгалт интерфейст ч байгаа. Давхардуулсан нь санамсаргүй биш:
   * `delivery` нь ҮНЭД нөлөөлдөг (+5,000₮) тул хэн ч DevTools нээгээд
   * хүргэлттэй захиалгыг хаяггүй илгээж чадвал ажилтан төлбөр авчихаад
   * хаана хүргэхээ мэдэхгүй үлдэнэ. Үнэд нөлөөлдөг талбарын шалгалт
   * серверт байх ёстой.
   */
  const delivery = body.delivery === true;
  if (delivery && !address)
    throw new ValidationError('Хүргэлт сонгосон бол хаягаа бичнэ үү.');

  if (!Array.isArray(body.lines) || body.lines.length === 0)
    throw new ValidationError('Дор хаяж нэг үйлчилгээ сонгоно уу.');
  if (body.lines.length > MAX_LINES)
    throw new ValidationError(`Нэг захиалгад ${MAX_LINES}-аас олон мөр байж болохгүй.`);

  const priced: PricedLine[] = body.lines.map((raw) => {
    const service = byId.get((raw as IncomingLine)?.id);
    if (!service) throw new ValidationError('Байхгүй үйлчилгээ сонгосон байна.');

    const qty = (raw as IncomingLine).qty;
    if (!isInt(qty, 1, MAX_QTY)) throw new ValidationError('Тоо ширхэг буруу байна.');

    const catalogPrice = Number(service.price.replace(/[^0-9]/g, '')) || 0;
    let unitPrice = catalogPrice;

    if (CUSTOM_PRICE_CATEGORIES.includes(service.category)) {
      const asked = (raw as IncomingLine).unitPrice;
      if (asked !== undefined) {
        if (!isInt(asked, 0, MAX_CUSTOM_UNIT_PRICE))
          throw new ValidationError('Тохиролцсон үнэ буруу байна.');
        unitPrice = asked;
      }
    }

    return { id: service.id, name: service.name, unitPrice, qty, total: unitPrice * qty };
  });

  const vat = body.vat === true;

  const base = priced.reduce((sum, line) => sum + line.total, 0);
  const deliveryFee = delivery ? DELIVERY_FEE : 0;
  const tax = vat ? Math.round((base + deliveryFee) * VAT_RATE) : 0;
  const total = base + deliveryFee + tax;

  const orderNumber = makeOrderNumber(now, random, taken);
  const time = nowTimeString(now);
  const date = toDateString(now);
  const nextId = makeIdGenerator();
  const contactNote = [note, `[web ${orderNumber}]`, email && `✉ ${email}`]
    .filter(Boolean)
    .join(' ');

  const orders: Record<string, Order> = {};
  const worklogs: Record<string, WorkLog> = {};

  /**
   * Мөр бүрт Order + WorkLog хосыг ХАМТ үүсгэнэ. `orderLogic.ts` дээр
   * тайлбарласанчлан толин тусгалыг алгасах нь орлогыг чимээгүй алдагдуулах
   * хамгийн хялбар арга зам.
   */
  priced.forEach((line, index) => {
    const label = `${line.name} (${line.qty}ш)`;

    const orderId = nextId();
    orders[String(orderId)] = {
      id: orderId,
      paymentType: 'Бусад',
      desc: label,
      price: line.total,
      time,
      source: 'web',
      createdAt: now.getTime(),
      orderNumber,
    };

    const logId = nextId();
    worklogs[String(logId)] = {
      id: logId,
      date,
      job: label,
      receivedTime: time,
      deadline: '',
      phone,
      /*
       * Аппын `WorkLog.delivery` нь хүргэлтийн дэлгэрэнгүйд зориулсан чөлөөт
       * талбар (`WorkLogForm.tsx` дэх «8. Хүргэлт & тайлбар»). Хаягийг ЭНД
       * тавьснаар ажилтан аппаасаа шууд харна — тайлбар дотор хайх хэрэггүй.
       *
       * Зөвхөн ЭХНИЙ мөрөнд: `isDelivery` ч мөн адил, эс тэгвээс олон мөртэй
       * захиалгад хаяг давхардаж, тайланд хүргэлт олон удаа тоологдоно.
       */
      delivery: delivery && index === 0 ? address : '',
      note: contactNote,
      status: '',
      color: '#ffffff',
      price: String(line.total),
      unitPrice: String(line.unitPrice),
      quantity: line.qty,
      payType: 'Бусад',
      // Хүргэлт, НӨАТ бол захиалгын түвшний зүйл — эхний мөрөнд л тэмдэглэнэ,
      // эс тэгвээс тайланд олон дахин тоологдоно.
      isDelivery: delivery && index === 0,
      isTomorrow: false,
      customer: name,
      customerType: '',
      paymentStatus: 'Төлөгдөөгүй',
      hasVat: vat,
      orderDate: date,
      agreedPrice: '',
      source: 'web',
      orderNumber,
    };
  });

  return {
    orderNumber,
    lines: priced,
    base,
    deliveryFee,
    tax,
    total,
    address: delivery ? address : '',
    orders,
    worklogs,
  };
}

/**
 * Өдрийн дарааллын дугаарыг олгоно.
 *
 * `buildOrder`-оос тусдаа байгаа шалтгаан: дугаар олгохын тулд өнөөдрийн мөрийг
 * тоолох сүлжээний дуудлага хэрэгтэй бөгөөд түүнийг баталгаажуулалт амжилттай
 * болсны ДАРАА л хийх ёстой. Эс тэгвээс хог өгөгдөл бүр Firebase рүү нэг
 * нэмэлт хүсэлт үүсгэнэ.
 *
 * `startNo` нь `null` бол дугаарлахгүй өнгөрнө — тоолол унасан нь захиалгыг
 * унагах шалтгаан биш, эрэмбэ нь id руу шилжинэ.
 */
export function numberWorkLogs(built: BuiltOrder, startNo: number | null): BuiltOrder {
  if (startNo === null) return built;

  Object.values(built.worklogs).forEach((log, index) => {
    log.no = startNo + index + 1;
  });
  return built;
}

/** Telegram мэдэгдлийн бие — `telegramService.ts`-ийн хэв маягтай ижил. */
export const alertText = (built: BuiltOrder, name: string, phone: string): string => {
  const jobs = built.lines.map((l) => `• ${l.name} × ${l.qty}`).join('\n');
  return (
    `🌐 <b>Вэбээс шинэ захиалга!</b> ${built.orderNumber}\n` +
    `${jobs}\n` +
    `💰 Нийт: ${built.total.toLocaleString('en-US')}₮` +
    `${built.tax > 0 ? ' (НӨАТ-тай)' : ''}` +
    `${built.deliveryFee > 0 ? ' · хүргэлттэй' : ''}\n` +
    `👤 ${name}\n📞 ${phone}` +
    /*
     * Хаягийг мэдэгдэлд оруулах нь чухал: ажилтан Telegram-аас шууд хараад
     * хүргэгчид дамжуулна. Апп нээх, хайх алхам хасагдана.
     */
    (built.address ? `\n📍 ${built.address}` : '')
  );
};
