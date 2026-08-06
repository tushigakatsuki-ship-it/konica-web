import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_LINES,
  ValidationError,
  buildOrder,
  numberWorkLogs,
  type IncomingOrder,
} from '../api/_shared';

/**
 * 2026-08-06 14:05 Улаанбаатар.
 *
 * `new Date(2026, 7, 6, 14, 5)` биш абсолют агшин бичсэн шалтгаан: тэр
 * хэлбэр нь ажиллуулагчийн цагийн бүсээр тайлагддаг тул CI Нью-Йоркт байвал
 * өөр өдөр гарч, тест хуурамчаар унана.
 */
const NOW = new Date('2026-08-06T06:05:00Z');

const customer = { name: 'Батболд', phone: '99001234', email: '', note: '' };

/** 103 = 'Зураг угаалт 10*15' → 500₮ (тогтмол үнэтэй) */
const ORDINARY = 103;
/** 707 = 'Цом' → 5,000₮, категори нь 'Медаль & Цом' (тохиролцоотой) */
const CUSTOM = 707;

const order = (over: Partial<IncomingOrder> = {}): IncomingOrder => ({
  customer,
  lines: [{ id: ORDINARY, qty: 2 }],
  delivery: false,
  vat: false,
  ...over,
});

test('энгийн захиалгын дүн каталогийн үнээр бодогдоно', () => {
  const built = buildOrder(order(), NOW, 0.5);
  assert.equal(built.base, 1000); // 500₮ × 2
  assert.equal(built.total, 1000);
  assert.equal(built.lines[0]?.name, 'Зураг угаалт 10*15');
});

test('НӨАТ ба хүргэлт зөв нэмэгдэнэ', () => {
  const built = buildOrder(order({ delivery: true, vat: true }), NOW, 0.5);
  assert.equal(built.base, 1000);
  assert.equal(built.deliveryFee, 5000);
  assert.equal(built.tax, 600); // (1000 + 5000) × 10%
  assert.equal(built.total, 6600);
});

test('клиентийн явуулсан үнийг тогтмол үнэтэй мөрөнд ҮЛ ТООМСОРЛОНО', () => {
  const built = buildOrder(
    order({ lines: [{ id: ORDINARY, qty: 1, unitPrice: 1 }] }),
    NOW,
    0.5,
  );
  // Хэрэв клиентэд итгэвэл 500₮-ийн ажлыг 1₮-өөр захиалж болно.
  assert.equal(built.lines[0]?.unitPrice, 500);
  assert.equal(built.total, 500);
});

test('тохиролцооны категорид клиентийн үнийг хүлээж авна', () => {
  const built = buildOrder(
    order({ lines: [{ id: CUSTOM, qty: 3, unitPrice: 7000 }] }),
    NOW,
    0.5,
  );
  assert.equal(built.lines[0]?.unitPrice, 7000);
  assert.equal(built.total, 21_000);
});

test('тохиролцооны үнэ хязгаараас хэтэрвэл татгалзана', () => {
  assert.throws(
    () => buildOrder(order({ lines: [{ id: CUSTOM, qty: 1, unitPrice: 99_000_000 }] })),
    ValidationError,
  );
});

test('буруу оролтуудыг татгалзана', () => {
  const bad: [string, Partial<IncomingOrder>][] = [
    ['нэр хоосон', { customer: { ...customer, name: '  ' } }],
    ['утас богино', { customer: { ...customer, phone: '1234' } }],
    ['утас 5-аар эхэлсэн', { customer: { ...customer, phone: '55001234' } }],
    ['и-мэйл буруу', { customer: { ...customer, email: 'batbold@' } }],
    ['мөр хоосон', { lines: [] }],
    ['байхгүй үйлчилгээ', { lines: [{ id: 999_999, qty: 1 }] }],
    ['тоо 0', { lines: [{ id: ORDINARY, qty: 0 }] }],
    ['тоо бутархай', { lines: [{ id: ORDINARY, qty: 1.5 }] }],
    [
      'мөр хэт олон',
      { lines: Array.from({ length: MAX_LINES + 1 }, () => ({ id: ORDINARY, qty: 1 })) },
    ],
  ];

  for (const [label, over] of bad) {
    assert.throws(() => buildOrder(order(over)), ValidationError, label);
  }
});

test('JSON биш оролтод унахгүй', () => {
  for (const input of [null, undefined, 'тийм ээ', 42, []]) {
    assert.throws(() => buildOrder(input), ValidationError);
  }
});

test('мөр бүрт Order + WorkLog хос үүсэж, id нь давхцахгүй', () => {
  const built = buildOrder(
    order({ lines: [{ id: ORDINARY, qty: 1 }, { id: 104, qty: 2 }] }),
    NOW,
    0.5,
  );

  const orderIds = Object.keys(built.orders);
  const logIds = Object.keys(built.worklogs);
  assert.equal(orderIds.length, 2);
  assert.equal(logIds.length, 2);
  // id нь Firebase-ийн хүүхэд зам учир давхцвал нэг бичлэг нөгөөгөө дарна.
  assert.equal(new Set([...orderIds, ...logIds]).size, 4);
});

test('хүргэлт зөвхөн эхний worklog дээр тэмдэглэгдэнэ', () => {
  const built = buildOrder(
    order({ lines: [{ id: ORDINARY, qty: 1 }, { id: 104, qty: 1 }], delivery: true }),
    NOW,
    0.5,
  );
  const flags = Object.values(built.worklogs).map((log) => log.isDelivery);
  assert.deepEqual(flags.filter(Boolean).length, 1, 'нэгээс олон удаа тоологдох ёсгүй');
});

test('захиалгын дугаар PMN-YYMMDD-NNNN хэлбэртэй', () => {
  const built = buildOrder(order(), NOW, 0.5);
  assert.match(built.orderNumber, /^PMN-260806-\d{4}$/);
  // Дугаар бүх бичлэг дээр давтагдаж, шүүхэд ашиглагдана.
  for (const record of [
    ...Object.values(built.orders),
    ...Object.values(built.worklogs),
  ]) {
    assert.equal(record.orderNumber, built.orderNumber);
  }
});

/**
 * `printmn-expo/firebase/database.rules.json`-ий `.validate` нөхцөлүүд.
 * Энд унавал бодит бичилт 401/403 болж, захиалга чимээгүй алдагдана.
 */
test('бичлэгүүд Firebase rules-ийн шаардлагыг хангана', () => {
  const built = buildOrder(order({ delivery: true, vat: true }), NOW, 0.5);

  for (const record of Object.values(built.orders)) {
    assert.equal(typeof record.id, 'number');
    assert.ok(typeof record.price === 'number' || typeof record.price === 'string');
    assert.equal(typeof record.desc, 'string');
    assert.equal(typeof record.paymentType, 'string');
    assert.equal(typeof record.time, 'string');
    assert.ok(Object.keys(record).length > 0, 'hasChildren()');
  }

  for (const log of Object.values(built.worklogs)) {
    assert.equal(typeof log.id, 'number');
    assert.equal(typeof log.date, 'string');
    assert.equal(typeof log.job, 'string');
    assert.ok(typeof log.price === 'string' || typeof log.price === 'number');
    assert.ok(typeof log.quantity === 'number' || typeof log.quantity === 'string');
    assert.equal(typeof log.hasVat, 'boolean');
    assert.equal(typeof log.isDelivery, 'boolean');
    assert.equal(typeof log.isTomorrow, 'boolean');
    assert.match(log.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(log.receivedTime, /^\d{2}:\d{2}$/);
  }

  // undefined утга JSON.stringify дээр алга болж, талбар дутуу бичигдэнэ.
  const serialised = JSON.stringify({ ...built.orders, ...built.worklogs });
  assert.ok(!serialised.includes('undefined'));
  assert.ok(!serialised.includes('null'));
});

/**
 * Vercel серверүүд UTC-ээр явдаг. Хэрэв огноог серверийн локал цагаар бодвол
 * Монголын өглөө 04:00-д ирсэн захиалга өмнөх өдрөөр бичигдэж, апп-ын
 * `visibleWorkLogs` (`date === today`) шүүлтүүрээс унаж, самбарт харагдахгүй.
 * Энэ тест ажиллуулагчийн TZ ямар ч байсан үүнийг барина.
 */
test('огноог Улаанбаатарын цагаар тавина', () => {
  // 2026-08-05 20:00 UTC = 2026-08-06 04:00 Улаанбаатар
  const built = buildOrder(order(), new Date('2026-08-05T20:00:00Z'), 0.5);
  const log = Object.values(built.worklogs)[0];

  assert.equal(log?.date, '2026-08-06');
  assert.equal(log?.orderDate, '2026-08-06');
  assert.equal(log?.receivedTime, '04:00');
  assert.equal(built.orderNumber.slice(0, 10), 'PMN-260806');
});

test('өдрийн сүүл ч мөн адил зөв өдөрт унана', () => {
  // 2026-08-06 15:59 UTC = 2026-08-06 23:59 Улаанбаатар
  const late = buildOrder(order(), new Date('2026-08-06T15:59:00Z'), 0.5);
  assert.equal(Object.values(late.worklogs)[0]?.date, '2026-08-06');

  // 2026-08-06 16:00 UTC = 2026-08-07 00:00 Улаанбаатар
  const next = buildOrder(order(), new Date('2026-08-06T16:00:00Z'), 0.5);
  assert.equal(Object.values(next.worklogs)[0]?.date, '2026-08-07');
});

/**
 * `newestFirst` эхлээд `no`-гоор эрэмбэлдэг тул дугааргүй мөр 0 болж
 * жагсаалтын доод талд ордог — шинэ захиалга харагдахгүй үлдэнэ.
 */
test('өнөөдрийн тооллоос үргэлжлүүлж no дугаарлана', () => {
  const built = numberWorkLogs(
    buildOrder(order({ lines: [{ id: ORDINARY, qty: 1 }, { id: 104, qty: 1 }] }), NOW, 0.5),
    7, // өнөөдөр аль хэдийн 7 мөр бүртгэгдсэн
  );
  const numbers = Object.values(built.worklogs).map((log) => log.no);
  assert.deepEqual(numbers, [8, 9]);
});

test('тоолол амжилтгүй бол no талбарыг огт бичихгүй', () => {
  const built = numberWorkLogs(buildOrder(order(), NOW, 0.5), null);
  const log = Object.values(built.worklogs)[0];
  assert.equal(log?.no, undefined);
  // `undefined` нь JSON.stringify дээр талбарыг бүрэн хасах ёстой.
  assert.ok(!Object.keys(JSON.parse(JSON.stringify(log))).includes('no'));
});
