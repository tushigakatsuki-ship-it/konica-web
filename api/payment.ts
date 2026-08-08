import {
  isDateStamp,
  isOrderNumber,
  isUploadId,
  manifestKey,
  type WebOrderManifest,
} from './_files';
import { getObject, putObject, readR2Config } from './_r2';
import { isPaid } from './_payment';
import { isInvoicePaid, readQPayConfig } from './_qpay';
import { notify, paidText } from './_notify';

/**
 * GET /api/payment?order=…&date=…&u=… — хэрэглэгч төлбөрийнхөө төлвийг шалгана.
 *
 * Нэвтрэлт нь `uploadId`: 16 тэмдэгт санамсаргүй мөр бөгөөд зөвхөн захиалга
 * өгсөн хүнд буцаагдсан. Түүнгүйгээр манифест уншигдахгүй тул дугаараа таасан
 * ч өөр хүний захиалгыг харах боломжгүй.
 *
 * Хариунд захиалагчийн нэр, утас зэрэг хувийн мэдээллийг ОГТ оруулахгүй —
 * зөвхөн төлбөрийн төлөв.
 */

export const config = { runtime: 'edge' };

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/**
 * QPay-ээс шалгах давтамжийн хязгаар.
 *
 * QPay «cron-оор байнга шалгахыг хориглоно» гэж заасан. Хэрэглэгч хуудсаа
 * нээлттэй байлгавал клиент 5 секунд тутам асуудаг тул энд instance тус бүрт
 * нэхэмжлэл бүрийн шалгалтыг сааруулна. Callback бол үндсэн зам — энэ нь
 * callback хоцорсон үеийн нөөц.
 */
const CHECK_EVERY_MS = 20_000;
const lastCheck = new Map<string, number>();

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'GET хүсэлт л хүлээн авна.' }, 405);

  const url = new URL(request.url);
  const orderNumber = url.searchParams.get('order') ?? '';
  const date = url.searchParams.get('date') ?? '';
  const uploadId = url.searchParams.get('u') ?? '';

  if (!isOrderNumber(orderNumber) || !isDateStamp(date) || !isUploadId(uploadId))
    return json({ error: 'Хүсэлт буруу байна.' }, 400);

  const env = process.env as Record<string, string | undefined>;
  const r2 = readR2Config(env);
  if (!r2) return json({ error: 'Сервер тохируулагдаагүй байна.' }, 503);

  const key = manifestKey(date, orderNumber, uploadId);
  const raw = await getObject(r2, key);
  if (!raw) return json({ error: 'Захиалга олдсонгүй.' }, 404);

  let manifest: WebOrderManifest;
  try {
    manifest = JSON.parse(raw) as WebOrderManifest;
  } catch {
    return json({ error: 'Захиалга уншигдсангүй.' }, 500);
  }

  const photoCount = manifest.files.filter((file) => file.kind === 'print').length;

  /**
   * Захиалгын товч тойм.
   *
   * `uploadId`-г мэдэж байгаа хүн бол захиалагч өөрөө тул түүнд өөрийнх нь
   * захиалгын хураангуйг харуулах нь зөв. Гэхдээ шаардлагагүй хувийн
   * мэдээллийг (и-мэйл, тайлбар) буцаахгүй — линк хуваалцагдвал ч.
   */
  const summary = {
    orderNumber: manifest.orderNumber,
    createdAt: manifest.createdAt,
    amount: manifest.payment?.amount ?? manifest.total,
    photoCount,
    lines: manifest.lines,
    printedAt: manifest.printedAt ?? null,
  };

  // Аль хэдийн төлөгдсөн бол QPay-г дэмий зовоохгүй.
  if (isPaid(manifest.payment))
    return json(
      { status: 'paid', paidAt: manifest.payment?.paidAt ?? null, ...summary },
      200,
    );

  const qpay = readQPayConfig(env);
  const invoiceId = manifest.payment?.invoiceId;
  const now = Date.now();

  if (qpay && invoiceId && (lastCheck.get(invoiceId) ?? 0) + CHECK_EVERY_MS < now) {
    lastCheck.set(invoiceId, now);
    if (lastCheck.size > 2_000) lastCheck.clear();

    if (await isInvoicePaid(qpay, invoiceId, summary.amount)) {
      manifest.payment = {
        ...(manifest.payment ?? { amount: summary.amount, method: 'qpay' }),
        status: 'paid',
        method: 'qpay',
        paidAt: now,
      };
      await putObject(r2, key, JSON.stringify(manifest));

      /*
       * Callback хоцорсон эсвэл ирээгүй тохиолдолд төлбөрийг ЭНД анх мэдэж
       * байна — ажилтанд мэдэгдэх ганц боломж тул алгасаж болохгүй.
       */
      await notify(
        paidText({
          orderNumber: manifest.orderNumber,
          amount: summary.amount,
          photoCount,
          customer: manifest.customer.name,
          phone: manifest.customer.phone,
          method: 'qpay',
        }),
      );

      return json({ status: 'paid', paidAt: now, ...summary }, 200);
    }
  }

  return json({ status: 'pending', paidAt: null, ...summary }, 200);
}
