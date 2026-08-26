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

/**
 * Тохиргоог ДУУДАГДАХ үед уншина, модуль ачаалагдах үед биш.
 *
 * ⚠️ Урьд нь `const BOT_TOKEN = process.env…` гэж дээд түвшинд уншдаг байсан.
 * Production дээр ажилладаг ч ХЭМЖИХ боломжгүй болгодог: тест орчны хувьсагчаа
 * тавихаас өмнө модуль ачаалагдчихсан байдаг тул `notifyEnabled()` үргэлж
 * худал буцаана. `api/_r2.ts` дэх `readR2Config(env)` ижил шалтгаанаар
 * параметр авдаг.
 */
const readConfig = (): { token: string; chatId: string } => ({
  token: (process.env.TELEGRAM_BOT_TOKEN ?? '').trim(),
  chatId: (process.env.TELEGRAM_CHAT_ID ?? '').trim(),
});

export const notifyEnabled = (): boolean => {
  const { token, chatId } = readConfig();
  return Boolean(token && chatId);
};

/** Мэдэгдэл явсан эсэх. Дуудагч тал үл тоомсорлож болно — заавал биш. */
export interface NotifyResult {
  ok: boolean;
  /** Хүнд ойлгомжтой шалтгаан. Амжилттай үед `undefined`. */
  error?: string;
}

/**
 * Telegram-ийн алдааг ХҮНИЙ хэлээр тайлбарлана.
 *
 * Telegram нь `description` талбарт англиар товч бичдэг («chat not found»).
 * Дэлгүүрийн эзэн үүнийг хараад юу засахаа мэдэхгүй — тиймээс хамгийн
 * түгээмэл гурван шалтгааныг нэрлэж хэлнэ.
 */
const explain = (status: number, description: string): string => {
  const raw = description || `HTTP ${status}`;

  if (/chat not found/i.test(description))
    return (
      `${raw} — TELEGRAM_CHAT_ID буруу байна. Группийн id нь СӨРӨГ тоо ` +
      '(-100…) бөгөөд хасах тэмдгийг нь хамт хуулах ёстой.'
    );

  if (/bot was blocked|bot can't initiate|user is deactivated/i.test(description))
    return (
      `${raw} — хэрэглэгч ботод эхлээд /start бичээгүй байна. Telegram нь ` +
      'ярианы эхлүүлээгүй хүн рүү бот бичихийг хориглодог.'
    );

  if (status === 401 || /unauthorized/i.test(description))
    return `${raw} — TELEGRAM_BOT_TOKEN буруу байна. @BotFather-аас дахин авна уу.`;

  if (/not enough rights|need administrator/i.test(description))
    return `${raw} — бот группэд байгаа ч бичих эрхгүй байна. Гишүүнээр нэмнэ үү.`;

  return raw;
};

/**
 * Мэдэгдэл илгээнэ.
 *
 * ⚠️ Урьд нь энэ функц `response.ok`-ийг ОГТ шалгадаггүй байв. Telegram
 * `400 Bad Request: chat not found` гэж буцаасан ч код амжилттай мэт үргэлжилж,
 * дэлгүүрийн эзэн «мэдэгдэл ирэхгүй байна» гэдгээс өөр юу ч мэдэхгүй байсан.
 * Одоо шалтгааныг буцаана — `/api/health?ping=1` түүнийг харуулна.
 *
 * Гэсэн хэдий ч ХЭЗЭЭ Ч алдаа шиднэ гэсэн үг биш: мэдэгдэл нь зөвхөн нэмэлт
 * тав тух, явуулж чадаагүй нь захиалгыг унагах шалтгаан биш.
 */
/**
 * Мессеж доорх товч.
 *
 * `data` нь Telegram-ийн `callback_data` — товшиход webhook руу яг энэ мөр
 * буцаж ирнэ. **64 БАЙТААС хэтэрч болохгүй**, эс тэгвээс Telegram мессежийг
 * бүхэлд нь татгалзана.
 */
export interface NotifyButton {
  text: string;
  data: string;
}

/** `callback_data`-гийн Telegram-ийн хатуу хязгаар. */
export const CALLBACK_DATA_MAX = 64;

/**
 * Дахин оролдох хугацааны НИЙТ төсөв, миллисекундээр.
 *
 * ⚠️ Энэ тоо яагаад ийм БАГА вэ:
 *
 * `notify` нь захиалга илгээх хариуг ХҮЛЭЭЛГЭЖ байгаад дуудагддаг. Өөрөөр
 * хэлбэл энд хүлээсэн секунд бүр нь хэрэглэгчийн дэлгэц дээрх «илгээж
 * байна…» дүрсийг уртасгана. Telegram-ийг найдвартай болгох гэж
 * үйлчлүүлэгчийг 40 секунд хүлээлгэх нь буруу солилцоо — тэр хүн табаа
 * хаачихвал захиалга нь ч алдагдана.
 *
 * Тиймээс зөвхөн ТҮР зуурын саатлыг (сүлжээний алдаа, богино 429) нөхнө.
 */
const RETRY_BUDGET_MS = 4_000;
const RETRY_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function notify(
  text: string,
  buttons: readonly NotifyButton[] = [],
): Promise<NotifyResult> {
  const { token, chatId } = readConfig();
  if (!token || !chatId)
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN эсвэл TELEGRAM_CHAT_ID алга.' };

  /*
   * Хэт урт `callback_data`-тай товчийг ЧИМЭЭГҮЙ хаяна.
   *
   * Telegram нь хязгаар хэтэрвэл БҮХ мессежийг татгалздаг. Товч ажиллахгүй нь
   * эвгүй ч, түүнээс болж «шинэ захиалга ирлээ» гэсэн мэдэгдэл огт ирэхгүй
   * болох нь хамаагүй дор.
   */
  const safe = buttons.filter(
    (button) => new TextEncoder().encode(button.data).length <= CALLBACK_DATA_MAX,
  );

  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    // Линк урьдчилан харах хэсэг чатыг дүүргэдэг тул хаана.
    disable_web_page_preview: true,
    ...(safe.length > 0
      ? {
          reply_markup: {
            inline_keyboard: safe.map((button) => [
              { text: button.text, callback_data: button.data },
            ]),
          },
        }
      : {}),
  });

  const deadline = Date.now() + RETRY_BUDGET_MS;
  let last: NotifyResult = { ok: false, error: 'Telegram руу огт хандсангүй.' };

  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(5_000),
      });

      if (response.ok) return { ok: true };

      const body = (await response.json().catch(() => null)) as {
        description?: string;
        parameters?: { retry_after?: number };
      } | null;

      last = { ok: false, error: explain(response.status, body?.description ?? '') };

      /*
       * 4xx нь 429-ээс бусад тохиолдолд БАЙНГЫН алдаа: мессеж буруу, токен
       * буруу, бот группээс хөөгдсөн. Давтаад ижил хариу ирнэ.
       */
      if (response.status !== 429 && response.status < 500) return last;

      /*
       * Telegram 429 дээр `retry_after` секундээр хэлдэг. Түүнийг ХҮНДЭТГЭНЭ —
       * өөрийн таамгаар эрт давтвал хязгаар нь улам уртасдаг.
       *
       * ⚠️ Гэхдээ багц ачаалалд `retry_after` нь 30–60 секунд байж болно.
       * Тэр нь бидний төсөвт багтахгүй — тэр үед дахин оролдохгүй ЗОРИУДААР
       * шууд буцна. Группд минутанд 20 мессежийн хязгаар байдаг тул 100
       * захиалга нэг дор ирвэл хүлээгээд ч нэмэргүй: шийдэл нь хүлээх биш,
       * Telegram-ээс өөр нөөц зам байх явдал.
       */
      const waitMs =
        response.status === 429 && typeof body?.parameters?.retry_after === 'number'
          ? body.parameters.retry_after * 1000
          : 500 * 2 ** attempt;

      if (Date.now() + waitMs > deadline) return last;
      await sleep(waitMs);
    } catch (error) {
      last = { ok: false, error: `Telegram руу холбогдож чадсангүй: ${String(error)}` };
      const waitMs = 500 * 2 ** attempt;
      if (Date.now() + waitMs > deadline) return last;
      await sleep(waitMs);
    }
  }

  return last;
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


// ── Товшилтод хариулах ─────────────────────────────────────────────

/**
 * Товшилтыг «хүлээж авлаа» гэж хариулна.
 *
 * ⚠️ Заавал дуудна. Үгүй бол Telegram нь товчийг эргэлдэж байгаа байдалтай
 * 30 секунд харуулаад «алдаа гарлаа» гэж дүгнэдэг — ажилтан дахин дахин
 * дарж, төлбөр хэд хэдэн удаа тэмдэглэгдэх эрсдэлтэй.
 */
export async function answerCallback(id: string, text: string): Promise<void> {
  const { token } = readConfig();
  if (!token) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ callback_query_id: id, text, show_alert: false }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort
  }
}

/**
 * Анхны мессежийг шинэчилж, товчийг нь авна.
 *
 * Товчийг үлдээвэл дараа нь хараад «дарсан болов уу?» гэж эргэлзэнэ. Мессеж
 * өөрөө «✅ Төлсөн — Батаа 14:21» болж хувирвал түүх нь чатанд шууд үлдэнэ.
 */
export async function editMessage(messageId: number, text: string): Promise<void> {
  const { token, chatId } = readConfig();
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [] },
      }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort
  }
}
