import { isDateStamp, isOrderNumber, isUploadId } from './_files';
import { getStore } from './_store';
import { isPaid } from './_payment';
import { isInvoicePaid, readQPayConfig } from './_qpay';
import { notify, paidText } from './_notify';

/**
 * GET /api/payment?order=…&date=…&u=… — захиалгын төлөв.
 *
 * Нэвтрэлт нь `uploadId`: 16 тэмдэгт санамсаргүй мөр бөгөөд зөвхөн захиалга
 * өгсөн хүнд буцаагдсан. Түүнгүйгээр хадгалалт өгөгдөл буцаадаггүй тул
 * дугаараа таасан ч өөр хүний захиалгыг харах боломжгүй.
 *
 * Хариунд и-мэйл, тайлбар зэрэг шаардлагагүй хувийн мэдээллийг ОРУУЛАХГҮЙ —
 * линк хуваалцагдвал ч зөвхөн төлбөрийн төлөв, дүн харагдана.
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
  const store = getStore(env);
  if (!store) return json({ error: 'Сервер тохируулагдаагүй байна.' }, 503);

  const order = await store.get(date, orderNumber, uploadId);
  if (!order) return json({ error: 'Захиалга олдсонгүй.' }, 404);

  const photoCount = order.files.filter((file) => file.kind === 'print').length;

  /** Захиалгын товч тойм — захиалагч өөрөө харах мэдээлэл. */
  const summary = {
    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    amount: order.payment?.amount ?? order.total,
    photoCount,
    lines: order.lines,
    printedAt: order.printedAt ?? null,
  };

  // Аль хэдийн төлөгдсөн бол QPay-г дэмий зовоохгүй.
  if (isPaid(order.payment))
    return json({ status: 'paid', paidAt: order.payment?.paidAt ?? null, ...summary }, 200);

  const qpay = readQPayConfig(env);
  const invoiceId = order.payment?.invoiceId;
  const now = Date.now();

  if (qpay && invoiceId && (lastCheck.get(invoiceId) ?? 0) + CHECK_EVERY_MS < now) {
    lastCheck.set(invoiceId, now);
    if (lastCheck.size > 2_000) lastCheck.clear();

    if (await isInvoicePaid(qpay, invoiceId, summary.amount)) {
      const payment = {
        ...(order.payment ?? { amount: summary.amount, method: 'qpay' as const }),
        status: 'paid' as const,
        method: 'qpay' as const,
        paidAt: now,
      };
      await store.update(order.ref, { payment });

      /*
       * Callback хоцорсон эсвэл ирээгүй тохиолдолд төлбөрийг ЭНД анх мэдэж
       * байна — ажилтанд мэдэгдэх ганц боломж тул алгасаж болохгүй.
       */
      await notify(
        paidText({
          orderNumber: order.orderNumber,
          amount: summary.amount,
          photoCount,
          customer: order.customer.name,
          phone: order.customer.phone,
          method: 'qpay',
        }),
      );

      return json({ status: 'paid', paidAt: now, ...summary }, 200);
    }
  }

  return json({ status: 'pending', paidAt: null, ...summary }, 200);
}
