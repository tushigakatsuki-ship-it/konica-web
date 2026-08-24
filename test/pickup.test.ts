import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PICKUP_MAX_DAYS,
  addDays,
  isClosedDay,
  pickupBounds,
  todayInUB,
  validatePickup,
} from '../src/lib/pickup';

/**
 * Хүлээж авах өдрийн дүрэм.
 *
 * ⚠️ Энэ бүх тестийн үндэс нь ЦАГИЙН БҮС.
 *
 * `new Date('2026-08-25')` нь UTC шөнө дундаар задардаг. Улаанбаатар UTC+8
 * тул хөтөч дээр `getDay()` дуудвал ӨМНӨХ өдрийг заана — «Мягмар гарагт
 * хаалттай» гэсэн шалгалт нэг өдрөөр гулсаж, хаалттай өдөр захиалга авах
 * (эсвэл нээлттэй өдрийг татгалзах) болно. Тестүүд нь UTC ашиглаж байгааг
 * баталгаажуулна.
 */

/** 2026-08-25 бол Мягмар гараг. */
const TUE = '2026-08-25';
const WED = '2026-08-26';

test('Мягмар гарагийг цагийн бүсээс үл хамааран таана', () => {
  assert.equal(isClosedDay(TUE), true, 'Мягмарыг танихгүй байна');
  assert.equal(isClosedDay(WED), false, 'Лхагваг хаалттай гэж үзэв');
  assert.equal(isClosedDay('2026-09-01'), true, 'дараа сарын Мягмар');
  assert.equal(isClosedDay(''), false, 'хоосон утга хаалттай болов');
  assert.equal(isClosedDay('25/08/2026'), false, 'буруу хэлбэрт унав');
});

test('хоног нэмэхэд сар, жил зөв дамжина', () => {
  assert.equal(addDays('2026-08-31', 1), '2026-09-01', 'сар дамжсангүй');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01', 'жил дамжсангүй');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29', 'өндөр жил алдав');
  assert.equal(addDays('2026-08-25', 0), '2026-08-25');
});

test('Улаанбаатарын огноо UTC-ээс ТУСДАА', () => {
  /*
   * UTC-ээр 2026-08-24 22:00 бол Улаанбаатарт аль хэдийн 25-ны 06:00.
   * Хэрэв `toISOString()`-ыг шууд ашиглавал шөнийн цагаар захиалга өгсөн
   * хүнд «өнөөдөр» нь өчигдөр гэж харагдаж, min нь өнгөрсөн өдрийг заана.
   */
  const late = new Date('2026-08-24T22:00:00Z');
  assert.equal(todayInUB(late), '2026-08-25', 'цагийн бүс тооцогдоогүй');
  assert.equal(late.toISOString().slice(0, 10), '2026-08-24', 'жишээ өөрөө буруу');
});

test('хоосон огноо алдаа БИШ — талбар сонголтоор', () => {
  /*
   * Заавал болговол «хэзээ бэлэн болохыг мэдэхгүй» хэрэглэгч захиалгаа
   * дуусгалгүй гарах эрсдэлтэй. Тэр нь шууд алдагдсан орлого.
   */
  assert.equal(validatePickup(''), null);
  assert.equal(validatePickup('   '), null, 'зөвхөн зайг алдаа гэж үзэв');
});

test('өнгөрсөн өдөр, хэт хол өдөр, хаалттай өдрийг татгалзана', () => {
  const now = new Date('2026-08-24T03:00:00Z'); // УБ-д 24-ний 11:00, Даваа

  assert.equal(validatePickup('2026-08-23', now), 'Өнгөрсөн өдөр сонгож болохгүй.');
  assert.equal(validatePickup(TUE, now), 'Мягмар гарагт дэлгүүр хаалттай.');
  assert.equal(validatePickup(WED, now), null, 'Лхагваг татгалзав');
  assert.equal(validatePickup('2026-08-24', now), null, 'өнөөдрийг татгалзав');

  const far = addDays('2026-08-24', PICKUP_MAX_DAYS + 1);
  assert.match(String(validatePickup(far, now)), /хол өдөр/, 'хязгаар ажиллахгүй');
});

test('буруу хэлбэрийг тодорхой хэлнэ', () => {
  const now = new Date('2026-08-24T03:00:00Z');
  assert.equal(validatePickup('25/08/2026', now), 'Огноо буруу байна.');
  assert.equal(validatePickup('2026-8-5', now), 'Огноо буруу байна.');
});

test('input-ын min/max нь өнөөдрөөс эхэлнэ', () => {
  const now = new Date('2026-08-24T03:00:00Z');
  const { min, max } = pickupBounds(now);

  assert.equal(min, '2026-08-24');
  assert.equal(max, addDays(min, PICKUP_MAX_DAYS));
  assert.ok(min < max, 'хил урвуу байна');
});
