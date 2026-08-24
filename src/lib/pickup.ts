/**
 * Хүлээж авах өдрийн дүрэм.
 *
 * ⚠️ Огноог `YYYY-MM-DD` МӨР хэлбэрээр л зөөнө, `Date` объектоор биш.
 *
 * Шалтгаан: `new Date('2026-08-25')` нь UTC шөнө дундаар задардаг. Улаанбаатар
 * UTC+8 тул хэрэглэгчийн `getDay()` нь өмнөх өдрийг заана — «Мягмар гараг
 * хаалттай» гэсэн шалгалт нэг өдрөөр гулсана. Тиймээс энд бүх тооцоог мөр
 * дээр, эсвэл `getUTC*` аргаар хийнэ.
 */

/** JS-ийн гарагийн дугаар: Ням = 0 … Мягмар = 2. */
const TUESDAY = 2;

/** Хэдэн хоногийн дараах өдрийг сонгож болох вэ. */
export const PICKUP_MAX_DAYS = 60;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Улаанбаатарын цагаар өнөөдөр — `YYYY-MM-DD`. */
export const todayInUB = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

/** `YYYY-MM-DD` дээр хоног нэмнэ. Цагийн бүсээс хамаарахгүй. */
export const addDays = (iso: string, days: number): string => {
  const at = new Date(`${iso}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};

/** Дэлгүүр хаалттай өдөр үү (Мягмар). */
export const isClosedDay = (iso: string): boolean =>
  ISO.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === TUESDAY;

/** `<input type="date">`-ийн `min` / `max`. */
export const pickupBounds = (now: Date = new Date()) => {
  const min = todayInUB(now);
  return { min, max: addDays(min, PICKUP_MAX_DAYS) };
};

/**
 * Сонгосон өдрийг шалгана.
 *
 * Хоосон = алдаа БИШ: талбар нь сонголтоор. Заавал болговол «хэзээ бэлэн
 * болохыг мэдэхгүй» хэрэглэгч захиалгаа дуусгалгүй гарах эрсдэлтэй.
 *
 * @returns алдааны мессеж, эсвэл `null`
 */
export const validatePickup = (
  iso: string,
  now: Date = new Date(),
): string | null => {
  const value = iso.trim();
  if (!value) return null;
  if (!ISO.test(value)) return 'Огноо буруу байна.';

  const { min, max } = pickupBounds(now);
  if (value < min) return 'Өнгөрсөн өдөр сонгож болохгүй.';
  if (value > max) return `${PICKUP_MAX_DAYS} хоногоос хол өдөр сонгож болохгүй.`;
  if (isClosedDay(value)) return 'Мягмар гарагт дэлгүүр хаалттай.';
  return null;
};
