/**
 * Telegram мэдэгдэл.
 *
 * Дэлгүүрийн ажлын урсгалд хоёр агшин чухал:
 *   1. Шинэ захиалга ирсэн        → бэлтгэл эхлүүлнэ
 *   2. Төлбөр орж, зураг нээгдсэн → ХЭВЛЭЖ болно
 *
 * Хоёр дахийг нь мартвал ажилтан `/admin`-ыг байнга сэргээж хараад суух
 * хэрэгтэй болно — «төлбөр эхэлж» гэсэн дүрэм ажлын урсгалыг хугалж орхино.
 *
 * Мэдэгдэл нь ЗӨВХӨН нэмэлт тав тух: явуулж чадаагүй нь захиалгыг унагах
 * шалтгаан биш тул бүх алдааг залгична.
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

export const notifyEnabled = (): boolean => Boolean(BOT_TOKEN && CHAT_ID);

export async function notify(text: string): Promise<void> {
  if (!notifyEnabled()) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        // Линк урьдчилан харах хэсэг чатыг дүүргэдэг тул хаана.
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort
  }
}

/** `1000` → `1,000₮` */
const money = (value: number): string => `${Math.round(value).toLocaleString('en-US')}₮`;

/**
 * Төлбөр баталгаажсаны мэдэгдэл — ажилтны хамгийн чухал дохио.
 *
 * `method` нь QPay уу, гараар уу гэдгийг заана: QPay бол мөнгө аль хэдийн
 * дансанд орсон, гараар бол ажилтан өөрөө шалгасан гэсэн үг.
 */
export const paidText = (input: {
  orderNumber: string;
  amount: number;
  photoCount: number;
  customer: string;
  phone: string;
  method: 'qpay' | 'manual' | null;
}): string =>
  `✅ <b>Төлбөр орлоо!</b> ${input.orderNumber}\n` +
  `💰 ${money(input.amount)}` +
  `${input.method === 'qpay' ? ' · QPay' : input.method === 'manual' ? ' · гараар баталгаажуулсан' : ''}\n` +
  (input.photoCount > 0
    ? `🖼 ${input.photoCount} зураг татахад бэлэн — /admin\n`
    : '') +
  `👤 ${input.customer}\n📞 ${input.phone}`;
