import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * `/api/order` handler-ийг бүтэн замаар нь шалгана: хуурамч Firebase сервер
 * босгож, PATCH-ийн биеийг барьж аваад агуулгыг нь шалгана.
 */

interface Captured {
  method: string;
  url: string;
  body: Record<string, unknown>;
}

let captured: Captured[] = [];
let nextStatus = 200;
/** GET (өдрийн тоолол) хариултын бие. */
let countResponse: Record<string, unknown> = {};
/** `true` бол тоолох GET 500 өгнө. */
let countFails = false;
let server: http.Server;
let handler: (request: Request) => Promise<Response>;

/**
 * Хүсэлт бүр өөр IP-тэй.
 *
 * Handler-т IP-д суурилсан хязгаарлалт байгаа тул нэг хаягийг дахин ашиглавал
 * дараагийн тестүүд 429 иртэл л ажиллаад, шалгах гэсэн зүйлдээ хүрэхгүй.
 */
let ipCounter = 0;
const post = (body: unknown): Request =>
  new Request('https://printmn.mn/api/order', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `203.0.113.${++ipCounter % 250}`,
    },
    body: JSON.stringify(body),
  });

const validBody = {
  customer: { name: 'Батболд', phone: '99001234', email: '', note: 'Яаралтай' },
  lines: [{ id: 103, qty: 2 }],
  delivery: false,
  vat: false,
};

before(async () => {
  server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const method = req.method ?? '';
      captured.push({ method, url: req.url ?? '', body: raw ? JSON.parse(raw) : {} });

      if (method === 'GET') {
        res.writeHead(countFails ? 500 : 200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(countResponse));
        return;
      }

      res.writeHead(nextStatus, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  // Handler нь орчны хувьсагчийг модуль ачаалагдах үед уншдаг тул эхлээд тавина.
  process.env.RTDB_URL = `http://127.0.0.1:${port}/pmn`;
  process.env.RTDB_AUTH = 'test-secret';
  process.env.TELEGRAM_BOT_TOKEN = '';
  process.env.TELEGRAM_CHAT_ID = '';

  handler = (await import('../api/order')).default;
});

after(() => server.close());

test('POST биш аргыг татгалзана', async () => {
  const response = await handler(new Request('https://printmn.mn/api/order'));
  assert.equal(response.status, 405);
});

test('амжилттай захиалга 201 буцааж, дугаар өгнө', async () => {
  captured = [];
  nextStatus = 200;

  const response = await handler(post(validBody));
  const body = (await response.json()) as { orderNumber: string; total: number };

  assert.equal(response.status, 201);
  assert.match(body.orderNumber, /^PMN-\d{6}-\d{5}$/);
  assert.equal(body.total, 1000); // 500₮ × 2
});

test('Firebase рүү нэг атомик multi-path PATCH явна', async () => {
  captured = [];
  nextStatus = 200;
  await handler(post(validBody));

  const writes = captured.filter((r) => r.method === 'PATCH');
  assert.equal(writes.length, 1, 'хоёр тусдаа бичилт биш, нэг PATCH байх ёстой');
  assert.ok(writes[0]?.url.startsWith('/pmn/.json?auth='), writes[0]?.url);

  const paths = Object.keys(writes[0]?.body ?? {});
  assert.equal(paths.filter((p) => p.startsWith('orders/')).length, 1);
  assert.equal(paths.filter((p) => p.startsWith('worklogs/')).length, 1);
});

test('өдрийн дарааллыг индексжсэн асуултаар тоолно', async () => {
  captured = [];
  nextStatus = 200;
  await handler(post(validBody));

  const reads = captured.filter((r) => r.method === 'GET');
  assert.equal(reads.length, 1);
  // `date` талбар rules дээр `.indexOn`-той — индексгүй асуулт бол бүтэн
  // коллекцийг татаж, өдөр өнгөрөх тусам улам үнэтэй болно.
  assert.ok(reads[0]?.url.includes('orderBy=%22date%22'), reads[0]?.url);
  assert.ok(reads[0]?.url.includes('equalTo=%22'), reads[0]?.url);
});

test('token-ыг URL-д дамжуулах ба хариултад буцаахгүй', async () => {
  captured = [];
  nextStatus = 200;
  const response = await handler(post(validBody));
  const text = await response.text();
  assert.ok(!text.includes('test-secret'), 'нууц үг хариултад гарч болохгүй');
  assert.ok(captured[0]?.url.includes('auth=test-secret'));
});

test('буруу өгөгдөлд 400 буцааж, Firebase рүү огт хандахгүй', async () => {
  captured = [];
  const response = await handler(post({ ...validBody, lines: [] }));
  assert.equal(response.status, 400);
  // Уншилт ч бас хийгдэх ёсгүй — эс тэгвээс хог хүсэлт бүр нэмэлт ачаалал болно.
  assert.equal(captured.length, 0, 'баталгаажуулалт унасан үед хандалт хийгдэх ёсгүй');
});

test('өнөөдрийн тооллоос үргэлжилсэн no дугаар бичигдэнэ', async () => {
  captured = [];
  nextStatus = 200;
  countResponse = { a: {}, b: {}, c: {} }; // өнөөдөр 3 мөр бүртгэгдсэн

  await handler(
    post({ ...validBody, lines: [{ id: 103, qty: 1 }, { id: 104, qty: 1 }] }),
  );

  const write = captured.find((r) => r.method === 'PATCH');
  const logs = Object.entries(write?.body ?? {})
    .filter(([path]) => path.startsWith('worklogs/'))
    .map(([, value]) => (value as { no?: number }).no);

  assert.deepEqual(logs, [4, 5]);
  countResponse = {};
});

test('тоолол унавал захиалга нь бүтэн хэвээр хадгалагдана', async () => {
  captured = [];
  nextStatus = 200;
  countFails = true;

  const response = await handler(post(validBody));
  assert.equal(response.status, 201);

  const write = captured.find((r) => r.method === 'PATCH');
  const log = Object.entries(write?.body ?? {}).find(([p]) => p.startsWith('worklogs/'));
  assert.ok(log, 'worklog бичигдсэн байх ёстой');
  assert.equal((log?.[1] as { no?: number }).no, undefined);

  countFails = false;
});

test('JSON биш биед 400', async () => {
  const response = await handler(
    new Request('https://printmn.mn/api/order', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.9' },
      body: 'тийм ээ',
    }),
  );
  assert.equal(response.status, 400);
});

test('Firebase 401 өгвөл 500 буцааж, хэрэглэгчид утсаар холбогдохыг санал болгоно', async () => {
  captured = [];
  nextStatus = 401;
  const response = await handler(post(validBody));
  const body = (await response.json()) as { error: string };

  assert.equal(response.status, 500);
  assert.match(body.error, /Утсаар/);
  nextStatus = 200;
});

test('нэг IP-ээс хэт олон хүсэлт ирвэл 429', async () => {
  nextStatus = 200;
  const flood = new Request('https://printmn.mn/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '198.51.100.7' },
    body: JSON.stringify(validBody),
  });

  const statuses: number[] = [];
  // Хязгаар 15/минут (CGNAT-ыг тооцсон) тул түүнээс хол давсан тоо хэрэгтэй.
  for (let i = 0; i < 25; i++) statuses.push((await handler(flood.clone())).status);

  assert.ok(statuses.includes(429), `429 гарсангүй: ${statuses.join(',')}`);
});

/* ── Зургийн байршуулалт ─────────────────────────────────────────── */

const withUpload = (extra: Record<string, unknown>) => ({ ...validBody, ...extra });

test('буруу uploadId-тай захиалгыг 400-аар татгалзана', async () => {
  const response = await handler(
    post(
      withUpload({
        uploadId: 'богино',
        date: '2026-08-06',
        files: [],
      }),
    ),
  );
  assert.equal(response.status, 400);
});

test('өөр байршуулалтын түлхүүр агуулсан захиалгыг татгалзана', async () => {
  const response = await handler(
    post(
      withUpload({
        uploadId: 'abcdefghijkmnpqr',
        date: '2026-08-06',
        files: [
          {
            key: 'uploads/2026-08-06/zzzzzzzzzzzzzzzz/01-print.jpg',
            kind: 'print',
            name: '01_print.jpg',
            size: 100,
            serviceId: 103,
            sizeLabel: '10×15 см',
            qty: 1,
          },
        ],
      }),
    ),
  );
  assert.equal(response.status, 400);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /хаяг буруу/);
});

test('зургийн сан тохируулаагүй ч захиалга хэвийн үүсч, photos=unavailable ирнэ', async () => {
  captured = [];
  const response = await handler(
    post(
      withUpload({
        uploadId: 'abcdefghijkmnpqr',
        date: '2026-08-06',
        files: [
          {
            key: 'uploads/2026-08-06/abcdefghijkmnpqr/01-print.jpg',
            kind: 'print',
            name: '01_print.jpg',
            size: 100,
            serviceId: 103,
            sizeLabel: '10×15 см',
            qty: 1,
          },
        ],
      }),
    ),
  );

  /*
   * Хамгийн чухал шалгалт: R2/NAS хараахан холбогдоогүй байхад ч захиалга
   * ҮҮСЭХ ёстой. Эс тэгвээс сан асаах хүртэл вэбээр огт захиалга авах
   * боломжгүй болно.
   */
  assert.equal(response.status, 201);
  const body = (await response.json()) as {
    photos: string;
    payment: { tracking: unknown } | null;
  };
  assert.equal(body.photos, 'unavailable');
  // Manifest байхгүй тул төлбөрийн төлвийг автоматаар хянах боломжгүй.
  assert.equal(body.payment?.tracking, null);

  const patch = captured.find((c) => c.method === 'PATCH');
  const worklog = Object.entries(patch?.body ?? {}).find(([path]) =>
    path.startsWith('worklogs/'),
  );
  assert.match((worklog?.[1] as { note: string }).note, /1 зураг вэбээр ирсэн/);
});

test('зураггүй захиалга photos=none', async () => {
  const response = await handler(post(validBody));
  const body = (await response.json()) as { photos: string };
  assert.equal(body.photos, 'none');
});

test('дансны заавар нь зургийн сангаас хамаарахгүй үргэлж буцна', async () => {
  process.env.BANK_NAME = 'Хаан банк';
  process.env.BANK_ACCOUNT = '5001234567';

  const response = await handler(post(validBody));
  const body = (await response.json()) as {
    payment: { bank: { account: string; reference: string } | null; amount: number };
    orderNumber: string;
  };

  assert.equal(body.payment.bank?.account, '5001234567');
  // Гүйлгээний утга нь ЗААВАЛ захиалгын дугаар — эс тэгвээс аль захиалгынх
  // болохыг таних боломжгүй.
  assert.equal(body.payment.bank?.reference, body.orderNumber);

  delete process.env.BANK_NAME;
  delete process.env.BANK_ACCOUNT;
});

/* ── Давхар захиалгаас хамгаалах ──────────────────────────────────── */

test('ижил requestId-тай хоёр дахь хүсэлт ШИНЭ захиалга үүсгэхгүй', async () => {
  captured = [];
  const requestId = 'req-abc12345-double-submit';
  const body = { ...validBody, requestId };

  const first = (await (await handler(post(body))).json()) as { orderNumber: string };
  const patchesAfterFirst = captured.filter((c) => c.method === 'PATCH').length;

  const second = (await (await handler(post(body))).json()) as { orderNumber: string };
  const patchesAfterSecond = captured.filter((c) => c.method === 'PATCH').length;

  // Хамгийн чухал нь: Firebase рүү дахин бичээгүй байх. Эс тэгвээс өдрийн касс
  // болон ажлын самбар давхардаж, ажилтан хоёр удаа хэвлэх эрсдэлтэй.
  assert.equal(patchesAfterSecond, patchesAfterFirst);
  assert.equal(second.orderNumber, first.orderNumber);
});

test('өөр requestId бол тусдаа захиалга', async () => {
  const a = (await (
    await handler(post({ ...validBody, requestId: 'req-first-00000001' }))
  ).json()) as { orderNumber: string };
  const b = (await (
    await handler(post({ ...validBody, requestId: 'req-second-0000002' }))
  ).json()) as { orderNumber: string };

  assert.notEqual(a.orderNumber, b.orderNumber);
});

test('хэлбэр нь буруу requestId-г үл тоомсорлоно (захиалга хэвийн үүснэ)', async () => {
  const response = await handler(post({ ...validBody, requestId: 'x' }));
  assert.equal(response.status, 201);
});
