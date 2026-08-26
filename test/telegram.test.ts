import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { payCallback, printCallback, refFromCallback } from '../api/_callback';
import { makeOrderNumber } from '../api/_shared';
import { makeUploadId } from '../api/_files';

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
  assert.deepEqual(refFromCallback(payCallback(TODAY, ORDER, UPLOAD)), {
    action: 'pay',
    ref: REF,
  });
  assert.deepEqual(refFromCallback(printCallback(TODAY, ORDER, UPLOAD)), {
    action: 'print',
    ref: REF,
  });

  assert.equal(refFromCallback('pay:a:b:c'), null);
  assert.equal(refFromCallback('pay:'), null);
  assert.equal(refFromCallback('other:x:y:z'), null);

  // Хэсэг илүү орвол ч татгалзана — тасалж авбал зам гажина.
  assert.equal(refFromCallback(`pay:${TODAY}:${ORDER}:${UPLOAD}:extra`), null);
});

// ── «🖨 Хэвлэж дууслаа» ────────────────────────────────────────────

test('хэвлэсэн товч printedAt тавьж, захиалагчийн мөшгөгчийг гүйцээнэ', async () => {
  /*
   * `/zakhialga/<дугаар>` хуудсанд «Хүлээн авсан → Төлбөр → Хэвлэсэн» гэсэн
   * мөшгөгч байдаг. Гурав дахь алхам нь ЗӨВХӨН `printedAt`-аас хамаарна —
   * урьд нь тэрийг `curl`-ээр л тавьж болдог тул практикт хэзээ ч тавигддаггүй,
   * мөшгөгч мөнхөд хоёр алхам дээр зогсдог байв.
   */
  seed(true);
  await press(printCallback(TODAY, ORDER, UPLOAD));

  const after = stored();
  assert.ok(after.printedAt > 0, 'printedAt тавигдаагүй');
  assert.equal(after.payment.status, 'paid', 'төлбөрийн төлөв хөндөгдсөн');

  const edit = telegramCalls.find((call) => call.method === 'editMessageText');
  assert.match(String(edit?.body.text), /🖨 <b>Хэвлэсэн<\/b> — Батаа/);
});

test('хоёр дахь «хэвлэсэн» товшилт цагийг ДАРЖ БИЧИХГҮЙ', async () => {
  seed(true);
  await press(printCallback(TODAY, ORDER, UPLOAD));
  const first = stored().printedAt;

  telegramCalls = [];
  await press(printCallback(TODAY, ORDER, UPLOAD));

  assert.equal(stored().printedAt, first, 'хэвлэсэн цаг дарагдлаа');
  assert.match(
    String(telegramCalls.find((c) => c.method === 'answerCallbackQuery')?.body.text),
    /аль хэдийн хэвлэсэн/i,
  );
});

test('төлбөрийн мэдэгдэл дээр ХЭВЛЭХ товч гарна', async () => {
  seed();
  await press(payCallback(TODAY, ORDER, UPLOAD));

  const sent = telegramCalls.find((call) => call.method === 'sendMessage');
  const keyboard = (sent?.body.reply_markup as
    | { inline_keyboard: { text: string; callback_data: string }[][] }
    | undefined)?.inline_keyboard;

  assert.ok(keyboard, 'товч огт алга');
  assert.match(keyboard![0]![0]!.text, /Хэвлэж дууслаа/);
  assert.ok(keyboard![0]![0]!.callback_data.startsWith('prn:'), 'буруу үйлдэл');
});

test('хэвлэх товчны өгөгдөл ч 64 байтад багтана', () => {
  const bytes = new TextEncoder().encode(
    printCallback('2026-12-31', 'PMN-261231-9999', 'zyxwvutsrqponmlk'),
  ).length;
  assert.ok(bytes <= 64, `${bytes} байт`);
});

/* ── Товчны өгөгдөл: ҮҮСГЭГЧ ба ЗАДЛАГЧ хоёр заавал таарна ─────── */

/*
 * ⚠️ ЭНЭ ХЭСЭГ БОДИТ АЛДААНААС ТӨРСӨН.
 *
 * Захиалгын дугаарыг 4 → 5 орон болгоход `_files.ts` дэх шалгагчийг зассан
 * ч `_callback.ts` дотор ТУСДАА хуулбар байсныг олж хараагүй. Үр дүнд нь
 * шинэ дугаартай захиалгын «✅ Төлсөн» товч «Товчны өгөгдөл танигдсангүй»
 * гэж хариулж, ажилтан төлбөрөө тэмдэглэж чадахгүй болсон — зураг нь
 * хэзээ ч татагдахгүй гэсэн үг.
 *
 * Хуучин тестүүд зөвхөн `makeOrderNumber`-ийн ГАРАЛТЫГ шалгадаг байсан тул
 * задлагч талын хуулбар өөрчлөгдөөгүйг хэн ч мэдээгүй. Доорх тестүүд
 * үүсгэгч → задлагч гинжийг БҮТНЭЭР нь холбоно.
 */

test('үүсгэсэн товчны өгөгдөл БУЦААЖ задарна — 5 оронтой дугаар', () => {
  const date = '2026-08-26';
  const orderNumber = 'PMN-260826-48213';
  const uploadId = 'abcdefghijkmnpqr';

  const parsed = refFromCallback(payCallback(date, orderNumber, uploadId));
  assert.ok(parsed, '5 оронтой дугаартай товч танигдсангүй');
  assert.equal(parsed.action, 'pay');
  assert.equal(parsed.ref, `manifests/${date}/${orderNumber}-${uploadId}.json`);
});

test('ХУУЧИН 4 оронтой дугаартай товч ажилласаар байна', () => {
  /*
   * Telegram дэх хуучин мессежүүд дээрх товч устдаггүй. Зөвхөн 5 оронг
   * зөвшөөрвөл өнгөрсөн долоо хоногийн бүх мэдэгдэл ажиллахаа болино.
   */
  const parsed = refFromCallback(payCallback('2026-08-20', 'PMN-260820-0001', 'abcdefghijkmnpqr'));
  assert.ok(parsed, 'хуучин дугаартай товч эвдэрсэн');
  assert.equal(parsed.ref, 'manifests/2026-08-20/PMN-260820-0001-abcdefghijkmnpqr.json');
});

test('ЖИНХЭНЭ үүсгэсэн дугаар задлагчийг ДАВНА', () => {
  /*
   * Дээрх хоёр тест гараар бичсэн мөр ашигладаг. Энэ нь `makeOrderNumber`,
   * `makeUploadId` хоёрын ЖИНХЭНЭ гаралтыг задлагч руу оруулна — хэлбэр нь
   * ирээдүйд өөрчлөгдвөл гараар бичсэн жишээ биш, БОДИТ гаралт унана.
   */
  const now = new Date('2026-08-26T06:05:00Z');
  for (let i = 0; i < 40; i += 1) {
    const orderNumber = makeOrderNumber(now, Math.random);
    const uploadId = makeUploadId();
    const data = payCallback('2026-08-26', orderNumber, uploadId);

    assert.ok(refFromCallback(data), `задарсангүй: ${data}`);

    /*
     * Telegram-ийн 64 БАЙТЫН хязгаар. Хэтэрвэл товч ажиллахгүй биш,
     * МЭДЭГДЭЛ БҮХЭЛДЭЭ илгээгдэхгүй болно.
     */
    const bytes = new TextEncoder().encode(data).length;
    assert.ok(bytes <= 64, `callback_data ${bytes} байт болжээ: ${data}`);
  }
});

test('хог өгөгдлийг татгалзсаар байна', () => {
  assert.equal(refFromCallback('pay:2026-08-26:PMN-260826-482:abcdefghijkmnpqr'), null);
  assert.equal(refFromCallback('pay:2026-08-26:PMN-260826-482134:abcdefghijkmnpqr'), null);
  assert.equal(refFromCallback('pay:2026-8-26:PMN-260826-48213:abcdefghijkmnpqr'), null);
  assert.equal(refFromCallback('pay:2026-08-26:PMN-260826-48213:богино'), null);
  assert.equal(refFromCallback('pay:2026-08-26:../../etc/passwd:abcdefghijkmnpqr'), null);
  assert.equal(refFromCallback('xxx:2026-08-26:PMN-260826-48213:abcdefghijkmnpqr'), null);
});
