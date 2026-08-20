import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { payCallback, refFromCallback } from '../api/_callback';

/**
 * `/api/telegram` — мэдэгдэл дээрх «✅ Төлбөр орсон» товч.
 *
 * Энэ endpoint нь интернэтэд НЭЭЛТТЭЙ бөгөөд мөнгөний төлөв өөрчилдөг тул
 * аюулгүй байдлын шалгалт нь функциональ шалгалтаас чухал.
 */

const SECRET = 'webhook-secret-value';
const CHAT_ID = '5850657251';
const TODAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ulaanbaatar',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

const ORDER = 'PMN-260820-0001';
const UPLOAD = 'abcdefghijkmnpqr';
const REF = `manifests/${TODAY}/${ORDER}-${UPLOAD}.json`;

let objects = new Map<string, string>();
let telegramCalls: { method: string; body: Record<string, unknown> }[] = [];
let server: http.Server;
let handler: (request: Request) => Promise<Response>;

const manifest = (paid: boolean) =>
  JSON.stringify({
    orderNumber: ORDER,
    uploadId: UPLOAD,
    date: TODAY,
    createdAt: 1_760_000_000_000,
    customer: { name: 'Батбаяр', phone: '99112233', email: '', note: '' },
    total: 24_000,
    lines: [{ name: '10x15', qty: 12, total: 24_000 }],
    files: [{ key: `uploads/${TODAY}/${UPLOAD}/01-print.jpg`, kind: 'print', name: 'a.jpg', size: 1, serviceId: 103, sizeLabel: '10×15 см', qty: 1 }],
    ...(paid
      ? { payment: { status: 'paid', amount: 24_000, method: 'qpay', paidAt: 1_700_000_000_000 } }
      : { payment: { status: 'pending', amount: 24_000, method: null } }),
  });

const seed = (paid = false) => {
  objects = new Map([[REF, manifest(paid)]]);
  telegramCalls = [];
};

before(async () => {
  seed();

  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    // Telegram-ийн API-г дуурайна.
    if (url.pathname.includes('/bot')) {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        telegramCalls.push({
          method: url.pathname.split('/').pop() ?? '',
          body: JSON.parse(body || '{}'),
        });
        res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      });
      return;
    }

    // S3-г дуурайна.
    const key = decodeURIComponent(url.pathname.replace(/^\/[^/]+\//, ''));
    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        objects.set(key, body);
        res.writeHead(200).end();
      });
      return;
    }
    const stored = objects.get(key);
    if (stored === undefined) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(stored);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  process.env.TELEGRAM_CHAT_ID = CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = '123:abc';
  process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.R2_BUCKET = 'printmn';
  process.env.R2_ACCESS_KEY_ID = 'k';
  process.env.R2_SECRET_ACCESS_KEY = 's';

  /*
   * Telegram руу явах хүсэлтийг хуурамч сервер рүү чиглүүлнэ. `_notify.ts` нь
   * хаягийг хатуу бичдэг тул `fetch`-ийг л таслан авна.
   */
  const real = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const target = String(input);
    if (target.startsWith('https://api.telegram.org'))
      return real(target.replace('https://api.telegram.org', `http://127.0.0.1:${port}`), init);
    return real(input as RequestInfo, init);
  }) as typeof fetch;

  handler = (await import('../api/telegram')).default;
});

after(() => server?.close());

const press = (
  data: string,
  options: { secret?: string; chatId?: number } = {},
): Promise<Response> =>
  handler(
    new Request('https://printmn.mn/api/telegram', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': options.secret ?? SECRET,
      },
      body: JSON.stringify({
        callback_query: {
          id: 'cb-1',
          data,
          from: { first_name: 'Батаа' },
          message: {
            message_id: 42,
            text: '🌐 Вэбээс шинэ захиалга! ' + ORDER,
            chat: { id: options.chatId ?? Number(CHAT_ID) },
          },
        },
      }),
    }),
  );

const stored = () => JSON.parse(objects.get(REF)!);

// ── Аюулгүй байдал ─────────────────────────────────────────────────

test('нууц толгойгүй хүсэлтийг 403-аар хаана', async () => {
  seed();
  const response = await press(payCallback(TODAY, ORDER, UPLOAD), { secret: 'wrong' });

  assert.equal(response.status, 403);
  assert.equal(stored().payment.status, 'pending', 'төлбөр өөрчлөгдсөн!');
  assert.equal(telegramCalls.length, 0, 'Telegram руу хүсэлт явчихлаа');
});

test('ӨӨР чатаас ирсэн товшилтыг үл тоомсорлоно', async () => {
  /*
   * Ботыг хэн ч Telegram-аас хайж олоод яриа эхлүүлж чадна. Тэдний илгээсэн
   * товшилт нь зөв нууц толгойтой ирнэ (Telegram өөрөө нэмдэг) тул чатын
   * id-г ЗААВАЛ шалгах ёстой.
   */
  seed();
  await press(payCallback(TODAY, ORDER, UPLOAD), { chatId: 999_999 });

  assert.equal(stored().payment.status, 'pending', 'танихгүй хүн төлбөр тэмдэглэчихлээ!');
  assert.match(
    String(telegramCalls[0]?.body.text ?? ''),
    /танд зориулагдаагүй/,
    'хариу өгөөгүй',
  );
});

test('гажсан callback_data-г татгалзана', async () => {
  seed();
  for (const bad of [
    'pay:2026-08-20:PMN-260820-0001:../../secret',
    'pay:not-a-date:PMN-260820-0001:abcdefghijkmnpqr',
    'pay:2026-08-20:HACK-260820-0001:abcdefghijkmnpqr',
    'pay:2026-08-20:PMN-260820-0001:SHORT',
    'delete:everything',
    '',
  ]) {
    telegramCalls = [];
    await press(bad);
    assert.equal(stored().payment.status, 'pending', `«${bad}» дээр төлбөр өөрчлөгдлөө`);
  }
});

test('Telegram-д ҮРГЭЛЖ 200 буцаана', async () => {
  /*
   * Алдааны статус буцаавал Telegram ижил товшилтыг дахин дахин илгээж,
   * эцэст нь webhook-ыг унтраадаг.
   */
  seed();
  assert.equal((await press('таарахгүй өгөгдөл')).status, 200);
  assert.equal((await press(payCallback(TODAY, 'PMN-260820-9999', UPLOAD))).status, 200);
});

// ── Гол урсгал ─────────────────────────────────────────────────────

test('товч дархад төлбөр тэмдэглэгдэж, зураг нээгдэнэ', async () => {
  seed();
  const response = await press(payCallback(TODAY, ORDER, UPLOAD));
  assert.equal(response.status, 200);

  const after = stored();
  assert.equal(after.payment.status, 'paid');
  assert.equal(after.payment.method, 'manual');
  assert.ok(after.payment.paidAt > 0);
  assert.match(after.payment.note, /Telegram: Батаа/, 'хэн баталгаажуулсныг бичээгүй');

  const methods = telegramCalls.map((call) => call.method);
  assert.ok(methods.includes('answerCallbackQuery'), 'товшилтод хариулаагүй');
  assert.ok(methods.includes('editMessageText'), 'анхны мессежийг шинэчлээгүй');
  assert.ok(methods.includes('sendMessage'), '«хэвлэж болно» дохио явуулаагүй');

  const edit = telegramCalls.find((call) => call.method === 'editMessageText');
  assert.match(String(edit?.body.text), /✅ <b>Төлсөн<\/b> — Батаа/, 'хэн, хэзээ нь алга');
  assert.deepEqual(
    (edit?.body.reply_markup as { inline_keyboard: unknown[] }).inline_keyboard,
    [],
    'товч хэвээр үлдсэн — дахин дарж болохоор байна',
  );
});

test('ХОЁР дахь товшилт төлсөн цагийг ДАРЖ БИЧИХГҮЙ', async () => {
  /*
   * Сүлжээ удаашрахад Telegram ижил товшилтыг давхар илгээх боломжтой.
   * `paidAt`-ыг дарж бичвэл жинхэнэ төлсөн цаг алдагдана.
   */
  seed(true);
  const before = stored().payment.paidAt;

  await press(payCallback(TODAY, ORDER, UPLOAD));

  assert.equal(stored().payment.paidAt, before, 'төлсөн цаг дарагдлаа');
  assert.match(
    String(telegramCalls.find((c) => c.method === 'answerCallbackQuery')?.body.text),
    /аль хэдийн төлөгдсөн/,
  );
});

test('POST биш аргыг татгалзана', async () => {
  const response = await handler(
    new Request('https://printmn.mn/api/telegram', { method: 'GET' }),
  );
  assert.equal(response.status, 405);
});

// ── callback_data-гийн хэлбэр ──────────────────────────────────────

test('callback_data нь Telegram-ийн 64 БАЙТЫН хязгаарт багтана', () => {
  /*
   * ⚠️ Хэтэрвэл Telegram МЕССЕЖИЙГ БҮХЭЛД НЬ татгалздаг — товч ажиллахгүй
   * биш, «шинэ захиалга ирлээ» гэсэн мэдэгдэл огт ирэхгүй болно.
   */
  const data = payCallback('2026-12-31', 'PMN-261231-9999', 'zyxwvutsrqponmlk');
  const bytes = new TextEncoder().encode(data).length;

  assert.ok(bytes <= 64, `${bytes} байт — хязгаар хэтэрлээ`);
  assert.equal(bytes, 47, 'хэлбэр өөрчлөгдсөн бол хязгаарыг дахин бод');
});

test('угсрах ба задлах нь хосолно', () => {
  assert.equal(refFromCallback(payCallback(TODAY, ORDER, UPLOAD)), REF);
  assert.equal(refFromCallback('pay:a:b:c'), null);
  assert.equal(refFromCallback('pay:'), null);
  assert.equal(refFromCallback('other:x:y:z'), null);

  // Хэсэг илүү орвол ч татгалзана — тасалж авбал зам гажина.
  assert.equal(refFromCallback(`pay:${TODAY}:${ORDER}:${UPLOAD}:extra`), null);
});
