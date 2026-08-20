/**
 * Telegram-ийн товчны `callback_data` — угсрах ба задлах.
 *
 * Тусдаа файл байгаа шалтгаан: `api/order.ts` нь товч ҮҮСГЭДЭГ, `api/telegram.ts`
 * нь товшилтыг ЗАДЛАДАГ. Хоёулаа Vercel-ийн маршрут тул нэг нь нөгөөгөө
 * import хийвэл Vercel хоёр функцийг хооронд нь наана. `_`-ээр эхэлсэн файлыг
 * Vercel маршрут болгодоггүй тул энэ нь зөв байр.
 *
 * ⚠️ Telegram-ийн `callback_data` нь **64 БАЙТААР** хязгаарлагдана. Хэтэрвэл
 * мессежийг бүхэлд нь татгалздаг — товч ажиллахгүй биш, МЭДЭГДЭЛ ОГТ ИРЭХГҮЙ.
 * Одоогийн хэлбэр 47 байт:
 *
 *   pay:2026-08-20:PMN-260820-0001:abcdefghijkmnpqr
 *   └4┘ └───10───┘ └─────15──────┘ └──────16──────┘  + 3 цэг
 *
 * Огноог захиалгын дугаараас гаргаж болох ЧТ мэт санагдана (PMN-YYMMDD-NNNN),
 * гэхдээ болохгүй: manifest-ийн зам нь БАЙРШУУЛСАН огноогоор явдаг бөгөөд
 * шөнө дунд өнгөрөхөд захиалгын дугаарын огноотой зөрж болно.
 */

const PAY_PREFIX = 'pay:';

/** Мэдэгдэлд наах товчийн өгөгдөл. */
export const payCallback = (
  date: string,
  orderNumber: string,
  uploadId: string,
): string => `${PAY_PREFIX}${date}:${orderNumber}:${uploadId}`;

/**
 * Товшилтын өгөгдлөөс manifest-ийн замыг сэргээнэ. Хэлбэр буруу бол `null`.
 *
 * Хэлбэрийг ЭНД шалгах нь чухал: `getByRef` дээр дахин шалгагдах ч, дурын мөр
 * серверийн гүн рүү орох тусам алдааны гадаргуу нэмэгдэнэ.
 */
export const refFromCallback = (data: string): string | null => {
  if (!data.startsWith(PAY_PREFIX)) return null;

  const parts = data.slice(PAY_PREFIX.length).split(':');
  if (parts.length !== 3) return null;

  const [date, orderNumber, uploadId] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (!/^PMN-\d{6}-\d{4}$/.test(orderNumber)) return null;
  if (!/^[a-z0-9]{16}$/.test(uploadId)) return null;

  return `manifests/${date}/${orderNumber}-${uploadId}.json`;
};
