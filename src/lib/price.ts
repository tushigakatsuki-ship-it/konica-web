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
