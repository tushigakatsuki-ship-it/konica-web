/**
 * Мөнгөний туслах функцууд.
 *
 * printmn-expo/src/utils/price.ts-ийн зан төлөвийг яг хадгалсан: үнэ нь
 * '8,500₮' эсвэл '8500' аль ч хэлбэрээр ирж болох тул тоо биш бүх тэмдэгтийг
 * хасаад Number рүү хөрвүүлнэ.
 */

/** config.ts → VAT_RATE */
export const VAT_RATE = 0.1;

export const parsePrice = (price: string | number | null | undefined): number => {
  if (price === null || price === undefined || price === '') return 0;
  return Number(String(price).replace(/[^0-9]/g, '')) || 0;
};

/** `8500` → `8,500` */
export const formatNumber = (value: number): string =>
  Math.round(value).toLocaleString('en-US');

/** `8500` → `8,500₮` */
export const formatCurrency = (value: number): string => `${formatNumber(value)}₮`;

/**
 * Тоо ширхэгээс хамаарах үнийн шатлал.
 *
 * ── Яагаад каталогийн МӨР солигддог вэ ──────────────────────────
 *
 * Каталогт олны хямдралыг тусдаа мөрөөр бичдэг («Медаль шилэн (10
 * дотор)» 2,500₮ ба «Медаль шилэн олон» 1,500₮). Хямдралыг хувиар
 * бодох биш, ЗӨВ МӨРИЙГ сонгох нь зөв: ажилтны каталог, вэбийн үнэ
 * хоёр үргэлж яг ижил үлдэнэ.
 */
export interface PriceTier {
  /** Үндсэн каталогийн мөр. */
  serviceId: number;
  /** Олноор захиалахад хямдарсан мөр. */
  bulk?: { serviceId: number; from: number };
}

/**
 * Тухайн тоо ширхэгт харгалзах каталогийн мөрийн `id`.
 *
 * ⚠️ Хямдралыг АВТОМАТААР хэрэглэнэ. «11-ээс дээш бол хямд» гэж бичээд
 * өөрөө бодохгүй байх нь худал үнэ харуулахтай адил — хэрэглэгч үнийг
 * хараад буцна.
 */
export const serviceIdFor = (tier: PriceTier, qty: number): number =>
  tier.bulk && qty >= tier.bulk.from ? tier.bulk.serviceId : tier.serviceId;

/** НӨАТ-тай нийт дүн. */
export const withVat = (value: number): number => Math.round(value * (1 + VAT_RATE));

/** НӨАТ-ын дүн дангаар. */
export const vatPortion = (value: number): number => Math.round(value * VAT_RATE);

/** Талбайн үнэ (баннер, хулдаас): `round(өргөн * өндөр * суурь)` */
export const areaPrice = (
  width: number,
  height: number,
  base: number,
): { area: number; total: number } => {
  const area = (Number(width) || 0) * (Number(height) || 0);
  return { area, total: Math.round(area * (Number(base) || 0)) };
};

/**
 * Монгол гар утасны дугаар — 8 орон, 6/7/8/9-өөр эхэлнэ.
 * Клиент болон `api/_shared.ts` хоёул үүнийг ашигладаг тул шалгалт ижил байна.
 */
export const isValidPhone = (phone: string): boolean =>
  /^[6-9]\d{7}$/.test(phone.replace(/\D/g, ''));

/**
 * И-мэйлийн ЗӨӨЛӨН шалгалт — `isValidPhone`-той нэг зэрэгцээ байрлана.
 *
 * ⚠️ Яагаад тусад нь гаргасан бэ:
 *
 * Урьд нь энэ хэв `src/pages/Order.tsx` болон `api/_shared.ts` ХОЁРТ тусад
 * нь бичигдсэн байв — тэр ч бүү хэл `isValidPhone`-ыг зөв хуваалцаж байгаа
 * мөрийн ЯГ ХАЖУУД. Нэгийг нь чангатгаад нөгөөг мартвал хэрэглэгч дэлгэц
 * дээр зөв гэж харагдсан хаягаа илгээхэд сервер татгалзаж, юу буруу байгааг
 * ойлгох арга байхгүй болно.
 *
 * (Telegram-ийн товч яг ийм давхардлаас болж эвдэрсэн — `_callback.ts` доторх
 * захиалгын дугаарын хоёр дахь хуулбар. Тэр сургамжийг энд урьдчилан авав.)
 *
 * Шалгалт нь ЗОРИУДААР зөөлөн: RFC-ийн бүрэн дүрэм маш нарийн бөгөөд хатуу
 * хийвэл хүчинтэй хаягийг татгалзах эрсдэл нь буруу хаягийг өнгөрүүлэхээс
 * илүү хортой. Жинхэнэ баталгаа нь и-мэйл хүрсэн эсэхээр л мэдэгдэнэ.
 */
export const isValidEmail = (email: string): boolean => /^\S+@\S+\.\S+$/.test(email);
