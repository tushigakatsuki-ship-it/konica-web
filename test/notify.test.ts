import assert from 'node:assert/strict';
import test from 'node:test';
import { notify, paidText } from '../api/_notify';

/**
 * Төлбөр орсны мэдэгдэл бол ажлын урсгалын гол дохио — ажилтан үүнийг хараад
 * хэвлэж эхэлдэг. Тиймээс захиалгын дугаар, дүн, зургийн тоо ЗААВАЛ багтана.
 */

const base = {
  orderNumber: 'PMN-260806-4821',
  amount: 12_000,
  photoCount: 3,
  customer: 'Батболд',
  phone: '99001234',
} as const;

test('QPay төлбөрийн мэдэгдэлд шаардлагатай бүх зүйл байна', () => {
  const text = paidText({ ...base, method: 'qpay' });

  assert.ok(text.includes('PMN-260806-4821'));
  assert.ok(text.includes('12,000₮'));
  assert.ok(text.includes('QPay'));
  assert.ok(text.includes('3 зураг татахад бэлэн'));
  assert.ok(text.includes('99001234'));
});

test('гараар баталгаажуулсныг ялгаж бичнэ', () => {
  const text = paidText({ ...base, method: 'manual' });
  assert.ok(text.includes('гараар баталгаажуулсан'));
  assert.ok(!text.includes('QPay'));
});

test('зураггүй захиалганд зургийн мөр гарахгүй', () => {
  const text = paidText({ ...base, photoCount: 0, method: null });
  assert.ok(!text.includes('зураг'));
  assert.ok(text.includes('PMN-260806-4821'));
});

/* ── Telegram-ийн урсгалын хязгаар (429) ─────────────────────────── */

/*
 * Telegram нэг группд минутанд 20 мессеж л зөвшөөрдөг. Захиалга багцаар
 * ирэхэд түүнээс хойшхи мэдэгдлүүд `429` авна — тэр захиалгыг хэн ч
 * «төлсөн» гэж тэмдэглэхгүй тул зураг нь хэзээ ч татагдахгүй.
 *
 * Доорх тестүүд `notify`-ийн дахин оролдлого ЯГ хаана тусалж, хаана
 * зориудаар БУУЖ ӨГДӨГ болохыг тогтооно.
 */

const withTelegram = async (
  responses: readonly { status: number; body: unknown }[],
  run: (send: typeof notify) => Promise<void>,
) => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_CHAT_ID = '-100123';

  const realFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    const step = responses[Math.min(call, responses.length - 1)]!;
    call += 1;
    return new Response(JSON.stringify(step.body), { status: step.status });
  }) as typeof fetch;

  try {
    // `readConfig` нь дуудагдах бүрд орчноос уншдаг тул дахин импорт хэрэггүй.
    await run(notify);
    return call;
  } finally {
    globalThis.fetch = realFetch;
    process.env.TELEGRAM_BOT_TOKEN = '';
    process.env.TELEGRAM_CHAT_ID = '';
  }
};

test('429-ийн дараа БОГИНО retry_after бол дахин оролдоно', async () => {
  const calls = await withTelegram(
    [
      { status: 429, body: { parameters: { retry_after: 1 } } },
      { status: 200, body: { ok: true } },
    ],
    async (send) => {
      const result = await send('туршилт');
      assert.equal(result.ok, true, 'дахин оролдоод амжилттай болох ёстой');
    },
  );
  assert.equal(calls, 2, 'яг нэг удаа дахин оролдох ёстой');
});

test('УРТ retry_after бол хүлээхгүй — хэрэглэгчийг барихгүй', async () => {
  /*
   * ⚠️ Энэ бол зориудын БУУЛТ. `notify` нь захиалгын хариуг хүлээлгэж
   * байгаад дуудагддаг тул 40 секунд хүлээвэл хэрэглэгчийн дэлгэц тэр
   * хугацаанд царцана. Багц ачаалалд хүлээгээд ч нэмэргүй — группийн
   * минутын хязгаар хүлээхээр арилдаггүй.
   */
  const started = Date.now();
  const calls = await withTelegram(
    [{ status: 429, body: { parameters: { retry_after: 45 } } }],
    async (send) => {
      const result = await send('туршилт');
      assert.equal(result.ok, false);
    },
  );
  assert.equal(calls, 1, '45 секунд хүлээхийг оролдсон байна');
  assert.ok(Date.now() - started < 2_000, 'хэрэглэгчийг удаан хүлээлгэсэн');
});

test('429 БИШ 4xx бол дахин оролдохгүй — байнгын алдаа', async () => {
  /*
   * Токен буруу, бот группээс хөөгдсөн, мессеж хэт урт — эдгээрийг давтаад
   * ижил хариу ирнэ. Дахин оролдох нь зөвхөн хэрэглэгчийг хүлээлгэнэ.
   */
  const calls = await withTelegram(
    [{ status: 400, body: { description: 'Bad Request: message is too long' } }],
    async (send) => {
      const result = await send('туршилт');
      assert.equal(result.ok, false);
    },
  );
  assert.equal(calls, 1, 'байнгын алдаанд дахин оролдож байна');
});
