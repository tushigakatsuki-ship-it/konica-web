import { refFromCallback } from './_callback';
import { answerCallback, editMessage, notify, paidText } from './_notify';
import { isPaid, type PaymentInfo } from './_payment';
import { getStore } from './_store';

/**
 * POST /api/telegram — Telegram-ийн webhook.
 *
 * Ганц зорилго: мэдэгдэл доорх «✅ Төлбөр орсон» товчийг барих. Ажилтан
 * банкны аппаасаа мөнгө орсныг хараад Telegram дээрээ л нэг товшино —
 * терминал, апп, вэб гурвын аль нь ч хэрэггүй.
 *
 * ── Яагаад энэ нь аюулгүй вэ ─────────────────────────────────────
 *
 * Endpoint нь интернэтэд нээлттэй тул ГУРВАН давхар шалгалттай:
 *
 *   1. `X-Telegram-Bot-Api-Secret-Token` толгой нь `TELEGRAM_WEBHOOK_SECRET`-тэй
 *      таарах ёстой. Энэ утгыг `setWebhook` дуудахдаа өгдөг бөгөөд Telegram
 *      хүсэлт бүрд буцааж явуулдаг. Гуравдагч этгээд мэдэхгүй.
 *   2. Товшилт нь ЗӨВХӨН `TELEGRAM_CHAT_ID` чатаас ирсэн байх ёстой. Ботыг
 *      өөр хэн нэгэн олж яриа эхлүүлсэн ч түүний товшилт хүчингүй.
 *   3. `callback_data` нь хатуу хэлбэртэй — дурын мөр илгээж дурын объект
 *      уншуулах боломжгүй (`parseManifestKey` дээр давхар шалгагдана).
 *
 * ⚠️ Товшилтын эрх нь чатад байгаа хүнд бий. Хувийн чат бол зөвхөн эзэн нь.
 * Групп болговол бүх гишүүн дарж чадна — тиймээс зөвхөн ажилтнууд байх ёстой.
 */

export const config = { runtime: 'edge' };

/**
 * Telegram-д ҮРГЭЛЖ 200 буцаана.
 *
 * Алдааны статус буцаавал Telegram нь ижил товшилтыг дахин дахин илгээж,
 * эцэст нь webhook-ыг унтраадаг. Асуудлыг хэрэглэгчид `answerCallback`-аар
 * хэлнэ — HTTP статусаар биш.
 */
const ok = (): Response => new Response('ok', { status: 200 });

const timeIn = (at: number): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ulaanbaatar',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(at));

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('POST only', { status: 405 });

  const secret = (process.env.TELEGRAM_WEBHOOK_SECRET ?? '').trim();
  if (!secret) return new Response('not configured', { status: 503 });

  // ── 1. Telegram-аас ирсэн эсэх ──
  if (request.headers.get('x-telegram-bot-api-secret-token') !== secret)
    return new Response('forbidden', { status: 403 });

  let update: {
    callback_query?: {
      id: string;
      data?: string;
      from?: { first_name?: string; username?: string };
      message?: { message_id: number; text?: string; chat?: { id: number } };
    };
  };
  try {
    update = JSON.parse(await request.text());
  } catch {
    return ok();
  }

  const query = update.callback_query;
  if (!query) return ok(); // энгийн мессеж — бид зөвхөн товшилт хүлээнэ

  // ── 2. Зөвшөөрөгдсөн чатаас ирсэн эсэх ──
  const allowed = (process.env.TELEGRAM_CHAT_ID ?? '').trim();
  if (String(query.message?.chat?.id ?? '') !== allowed) {
    await answerCallback(query.id, 'Энэ товч танд зориулагдаагүй.');
    return ok();
  }

  // ── 3. Өгөгдлийн хэлбэр ──
  const ref = refFromCallback(query.data ?? '');
  if (!ref) {
    await answerCallback(query.id, 'Товчны өгөгдөл танигдсангүй.');
    return ok();
  }

  const store = getStore();
  if (!store) {
    await answerCallback(query.id, 'Зургийн сан тохируулаагүй байна.');
    return ok();
  }

  const order = await store.getByRef(ref);
  if (!order) {
    await answerCallback(query.id, 'Захиалга олдсонгүй.');
    return ok();
  }

  const who = query.from?.first_name || query.from?.username || 'ажилтан';

  /*
   * Аль хэдийн төлөгдсөн бол ДАХИН бичихгүй.
   *
   * Сүлжээ удаашрахад Telegram ижил товшилтыг хоёр удаа илгээх боломжтой.
   * `paidAt`-ыг дарж бичвэл жинхэнэ төлсөн цаг алдагдана.
   */
  if (isPaid(order.payment)) {
    await answerCallback(query.id, 'Энэ захиалга аль хэдийн төлөгдсөн байна.');
    if (query.message)
      await editMessage(
        query.message.message_id,
        `${query.message.text ?? order.orderNumber}\n\n✅ <b>Төлсөн</b> (өмнө нь)`,
      );
    return ok();
  }

  const now = Date.now();
  const amount = order.payment?.amount ?? order.total;
  const payment: PaymentInfo = {
    ...(order.payment ?? { amount, method: null }),
    status: 'paid',
    method: order.payment?.method ?? 'manual',
    paidAt: now,
    note: `Telegram: ${who}`.slice(0, 200),
  };

  if (!(await store.update(ref, { payment }))) {
    await answerCallback(query.id, 'Хадгалж чадсангүй. Дахин оролдоно уу.');
    return ok();
  }

  await answerCallback(query.id, '✅ Төлсөн гэж тэмдэглэлээ. Зураг нээгдлээ.');

  /*
   * Анхны мэдэгдлийг шинэчилж товчийг нь авна — дараа нь чатаа гүйлгэхэд
   * «дарсан болов уу?» гэж эргэлзэхгүй.
   */
  if (query.message)
    await editMessage(
      query.message.message_id,
      `${query.message.text ?? order.orderNumber}\n\n` +
        `✅ <b>Төлсөн</b> — ${who}, ${timeIn(now)}`,
    );

  /*
   * Төлбөрийн стандарт мэдэгдлийг МӨН явуулна.
   *
   * Давхардал биш: дээрх нь ЗАХИАЛГЫН мессежийн засвар, энэ нь «хэвлэж
   * болно» гэсэн шинэ дохио. QPay-ээр төлөгдөхөд ирдэгтэй яг ижил хэлбэртэй
   * байх нь ажилтны нүдэнд нэг л дүрэм болно.
   */
  await notify(
    paidText({
      orderNumber: order.orderNumber,
      amount,
      photoCount: order.files.filter((file) => file.kind === 'print').length,
      customer: order.customer.name,
      phone: order.customer.phone,
      method: 'manual',
    }),
  );

  return ok();
}
