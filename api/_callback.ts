import { isDateStamp, isOrderNumber, isUploadId } from './_files';

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

/**
 * Хоёр үйлдэл:
 *   `pay` — «✅ Төлбөр орсон». Зургийн түгжээг тайлна.
 *   `prn` — «🖨 Хэвлэж дууслаа». Захиалагчийн мөшгөх хуудсан дээр гэрэлтэнэ.
 *
 * Угтварыг гурван тэмдэгтээр барьсан нь санамсаргүй биш — 64 байтын хязгаарт
 * аль болох зай үлдээх ёстой.
 */
const PREFIX = { pay: 'pay:', print: 'prn:' } as const;

export type CallbackAction = keyof typeof PREFIX;

const encode = (
  action: CallbackAction,
  date: string,
  orderNumber: string,
  uploadId: string,
): string => `${PREFIX[action]}${date}:${orderNumber}:${uploadId}`;

/** «✅ Төлбөр орсон» товчийн өгөгдөл. */
export const payCallback = (
  date: string,
  orderNumber: string,
  uploadId: string,
): string => encode('pay', date, orderNumber, uploadId);

/** «🖨 Хэвлэж дууслаа» товчийн өгөгдөл. */
export const printCallback = (
  date: string,
  orderNumber: string,
  uploadId: string,
): string => encode('print', date, orderNumber, uploadId);

/**
 * Товшилтын өгөгдлөөс manifest-ийн замыг сэргээнэ. Хэлбэр буруу бол `null`.
 *
 * Хэлбэрийг ЭНД шалгах нь чухал: `getByRef` дээр дахин шалгагдах ч, дурын мөр
 * серверийн гүн рүү орох тусам алдааны гадаргуу нэмэгдэнэ.
 */
export const refFromCallback = (
  data: string,
): { action: CallbackAction; ref: string } | null => {
  const entry = (Object.entries(PREFIX) as [CallbackAction, string][]).find(
    ([, prefix]) => data.startsWith(prefix),
  );
  if (!entry) return null;

  const [action, prefix] = entry;
  const parts = data.slice(prefix.length).split(':');
  if (parts.length !== 3) return null;

  const [date, orderNumber, uploadId] = parts;

  /*
   * ⚠️ Хэлбэрийг ЭНД гараар бүү бич — `_files.ts`-ийн шалгагчийг ашигла.
   *
   * Урьд нь энд `/^PMN-\d{6}-\d{4}$/` гэсэн ТУСДАА хуулбар байсан. Захиалгын
   * дугаарыг 4 → 5 орон болгоход `_files.ts` дэх нэгийг нь зассан ч энэ нь
   * хэвээр үлдсэн. Үр дүнд нь шинэ дугаартай захиалгын «✅ Төлсөн» товч
   * «Товчны өгөгдөл танигдсангүй» гэж хариулж, ажилтан төлбөрөө тэмдэглэж
   * чадахгүй болсон — өөрөөр хэлбэл зураг нь хэзээ ч татагдахгүй.
   *
   * Нэг дүрэм, нэг газар. Доорх round-trip тест үүнийг дахин давтахаас
   * хамгаална.
   */
  if (!isDateStamp(date)) return null;
  if (!isOrderNumber(orderNumber)) return null;
  if (!isUploadId(uploadId)) return null;

  return { action, ref: `manifests/${date}/${orderNumber}-${uploadId}.json` };
};

/**
 * Төлбөр баталгаажсаны мэдэгдэлд наах товч.
 *
 * Захиалга нь `date`, `orderNumber`, `uploadId` гурвыг мэддэг тул дуудагч тал
 * бүр өөрөө угсрахын оронд энд нэг газраас. Хэлбэр өөрчлөгдвөл нэг л газар
 * засна.
 */
export const printButton = (order: {
  date: string;
  orderNumber: string;
  uploadId: string;
}): { text: string; data: string }[] => [
  {
    text: '🖨 Хэвлэж дууслаа',
    data: printCallback(order.date, order.orderNumber, order.uploadId),
  },
];
