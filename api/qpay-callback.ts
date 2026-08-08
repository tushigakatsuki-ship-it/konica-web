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
 * аль хэдийн төлөгдсөн manifest-ыг дахин бичихгүй.
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
  const r2 = readR2Config(env);
  const qpay = readQPayConfig(env);
  if (!r2 || !qpay) return ok({ error: 'Сервер тохируулагдаагүй байна.' }, 503);

  const key = manifestKey(date, orderNumber, uploadId);
  const raw = await getObject(r2, key);
  if (!raw) return ok({ error: 'Захиалга олдсонгүй.' }, 404);

  let manifest: WebOrderManifest;
  try {
    manifest = JSON.parse(raw) as WebOrderManifest;
  } catch {
    return ok({ error: 'Захиалга уншигдсангүй.' }, 500);
  }

  // Давхар мэдэгдэл — юу ч хийхгүй, гэхдээ QPay-д амжилттай гэж хариулна.
  if (isPaid(manifest.payment)) return ok({ status: 'paid' });

  const invoiceId = manifest.payment?.invoiceId;
  if (!invoiceId) return ok({ error: 'Нэхэмжлэл байхгүй.' }, 400);

  const amount = manifest.payment?.amount ?? manifest.total;
  if (!(await isInvoicePaid(qpay, invoiceId, amount)))
    return ok({ status: 'pending' });

  manifest.payment = {
    ...(manifest.payment ?? { amount, method: 'qpay' }),
    status: 'paid',
    method: 'qpay',
    paidAt: Date.now(),
  };

  const saved = await putObject(r2, key, JSON.stringify(manifest));
  if (!saved) return ok({ error: 'Хадгалж чадсангүй.' }, 502);

  /*
   * Ажилтанд ЗААВАЛ мэдэгдэнэ. Энэ бол ажлын урсгалын гол дохио: зураг энэ
   * мөчид түгжээгээ тайлж, хэвлэхэд бэлэн боллоо. Мэдэгдэлгүй бол ажилтан
   * /admin-ыг байнга сэргээж хараад суух хэрэгтэй болно.
   */
  await notify(
    paidText({
      orderNumber: manifest.orderNumber,
      amount,
      photoCount: manifest.files.filter((file) => file.kind === 'print').length,
      customer: manifest.customer.name,
      phone: manifest.customer.phone,
      method: 'qpay',
    }),
  );

  return ok({ status: 'paid' });
}
