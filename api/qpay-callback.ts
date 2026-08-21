import { printButton } from './_callback';
import { isDateStamp, isOrderNumber, isUploadId } from './_files';
import { getStore } from './_store';
import { isPaid } from './_payment';
import { isInvoicePaid, readQPayConfig } from './_qpay';
import { notify, paidText } from './_notify';

/**
 * QPay-ийн төлбөрийн мэдэгдэл.
 *
 * Хаяг нь нэхэмжлэл үүсгэхэд `callback_url` болж дамждаг:
 *   /api/qpay-callback?order=PMN-…&date=2026-08-06&u=<uploadId>
 * QPay үүн дээр `payment_id`-г нэмж дуудна.
 *
 * ⚠️ ХАМГИЙН ЧУХАЛ: энэ дуудлагыг ӨӨРӨӨР НЬ БАТАЛГАА болгож үзэхгүй. Хаяг нь
 * нийтэд нээлттэй тул хэн ч дуудаж «төлөгдлөө» гэж бичүүлэх боломжтой.
 * Тиймээс мэдэгдэл ирмэгц QPay рүү буцаж `POST /v2/payment/check` дуудаж,
 * нэхэмжлэл БОДИТООР бүрэн төлөгдсөн эсэхийг асууна. Хуурамч дуудлага
 * шалгалтад унаад юу ч өөрчлөгдөхгүй.
 *
 * QPay давтан мэдэгдэл илгээж болзошгүй тул үйлдэл нь давталтад тэсвэртэй:
 * аль хэдийн төлөгдсөн захиалгыг дахин бичихгүй.
 */

export const config = { runtime: 'edge' };

/** QPay амжилттай гэж үзэхийн тулд 200 хүлээдэг. */
const ok = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const orderNumber = url.searchParams.get('order') ?? '';
  const date = url.searchParams.get('date') ?? '';
  const uploadId = url.searchParams.get('u') ?? '';

  if (!isOrderNumber(orderNumber) || !isDateStamp(date) || !isUploadId(uploadId))
    return ok({ error: 'Хүсэлт буруу байна.' }, 400);

  const env = process.env as Record<string, string | undefined>;
  const store = getStore(env);
  const qpay = readQPayConfig(env);
  if (!store || !qpay) return ok({ error: 'Сервер тохируулагдаагүй байна.' }, 503);

  const order = await store.get(date, orderNumber, uploadId);
  if (!order) return ok({ error: 'Захиалга олдсонгүй.' }, 404);

  // Давхар мэдэгдэл — юу ч хийхгүй, гэхдээ QPay-д амжилттай гэж хариулна.
  if (isPaid(order.payment)) return ok({ status: 'paid' });

  const invoiceId = order.payment?.invoiceId;
  if (!invoiceId) return ok({ error: 'Нэхэмжлэл байхгүй.' }, 400);

  const amount = order.payment?.amount ?? order.total;
  if (!(await isInvoicePaid(qpay, invoiceId, amount))) return ok({ status: 'pending' });

  const saved = await store.update(order.ref, {
    payment: {
      ...(order.payment ?? { amount, method: 'qpay' }),
      status: 'paid',
      method: 'qpay',
      paidAt: Date.now(),
    },
  });
  if (!saved) return ok({ error: 'Хадгалж чадсангүй.' }, 502);

  /*
   * Ажилтанд ЗААВАЛ мэдэгдэнэ. Энэ бол ажлын урсгалын гол дохио: зураг энэ
   * мөчид түгжээгээ тайлж, хэвлэхэд бэлэн боллоо. Мэдэгдэлгүй бол ажилтан
   * /admin-ыг байнга сэргээж хараад суух хэрэгтэй болно.
   */
  await notify(
    paidText({
      orderNumber: order.orderNumber,
      amount,
      photoCount: order.files.filter((file) => file.kind === 'print').length,
      customer: order.customer.name,
      phone: order.customer.phone,
      method: 'qpay',
    }),
    // Дараагийн алхам нь хэвлэх — товчийг тэр дороо санал болгоно.
    printButton(order),
  );

  return ok({ status: 'paid' });
}
