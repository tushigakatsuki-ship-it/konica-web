import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * `/api/admin`-ыг бүтэн замаар нь шалгана — NAS энэ endpoint дээр л түшиглэдэг
 * тул энд гарсан алдаа шууд «зураг дэлгүүрт ирэхгүй» болж хувирна.
 *
 * Хуурамч S3 сервер босгож, `S3_ENDPOINT`-ыг тийш нь чиглүүлнэ. Ингэснээр
 * presigned линк үүсгэх, manifest унших/бичих бүх урсгал жинхэнэ кодоор явна.
 */

const TOKEN = 'admin-token-for-tests';

interface Manifest {
  orderNumber: string;
  uploadId: string;
  date: string;
  createdAt: number;
  customer: { name: string; phone: string; email: string; note: string };
  total: number;
  lines: { name: string; qty: number; total: number }[];
  files: { key: string; kind: string; name: string; size: number }[];
  payment?: { status: string; amount: number; method: string | null; paidAt?: number };
  printedAt?: number;
  syncedAt?: number;
}

/** Түлхүүр → manifest. Тест бүр өөрчилдөг тул `before` дотор дахин бөглөнө. */
let objects = new Map<string, string>();
let server: http.Server;
let handler: (request: Request) => Promise<Response>;

const key = (n: string) => `manifests/2026-08-19/${n}-abcdefghijkmnpqr.json`;

const makeOrder = (
  orderNumber: string,
  extra: Partial<Manifest> = {},
): Manifest => ({
  orderNumber,
  uploadId: 'abcdefghijkmnpqr',
  date: '2026-08-19',
  createdAt: 1_760_000_000_000,
  customer: { name: 'Батбаяр', phone: '99112233', email: '', note: '' },
  total: 24_000,
  lines: [{ name: '10x15 зураг', qty: 12, total: 24_000 }],
  files: [
    { key: 'uploads/2026-08-19/abcdefghijkmnpqr/01-print.jpg', kind: 'print', name: '01-print.jpg', size: 100 },
    { key: 'uploads/2026-08-19/abcdefghijkmnpqr/01-original.jpg', kind: 'original', name: '01-original.jpg', size: 200 },
  ],
  ...extra,
});

const paid = { status: 'paid', amount: 24_000, method: 'qpay', paidAt: 1_760_000_100_000 };
const unpaid = { status: 'pending', amount: 24_000, method: null };

const seed = (): void => {
  objects = new Map(
    [
      makeOrder('PMN-260819-0001', { payment: paid }),
      makeOrder('PMN-260819-0002', { payment: unpaid }),
      makeOrder('PMN-260819-0003', { payment: paid, syncedAt: 1_760_000_300_000 }),
    ].map((order) => [key(order.orderNumber), JSON.stringify(order)]),
  );
};

before(async () => {
  seed();

  server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // ListObjectsV2 — зам нь `/<bucket>`, түлхүүргүй.
    if (url.searchParams.get('list-type') === '2') {
      const prefix = url.searchParams.get('prefix') ?? '';
      const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
      res.writeHead(200, { 'content-type': 'application/xml' });
      res.end(
        `<?xml version="1.0"?><ListBucketResult>${keys
          .map((k) => `<Contents><Key>${k}</Key></Contents>`)
          .join('')}</ListBucketResult>`,
      );
      return;
    }

    // `/<bucket>/<key>` → эхний хэсгийг нь хасна.
    const objectKey = decodeURIComponent(url.pathname.replace(/^\/[^/]+\//, ''));

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        objects.set(objectKey, body);
        res.writeHead(200).end();
      });
      return;
    }

    const stored = objects.get(objectKey);
    if (stored === undefined) return void res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(stored);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  process.env.ADMIN_TOKEN = TOKEN;
  process.env.S3_ENDPOINT = `http://127.0.0.1:${port}`;
  process.env.R2_BUCKET = 'printmn';
  process.env.R2_ACCESS_KEY_ID = 'k';
  process.env.R2_SECRET_ACCESS_KEY = 's';

  handler = (await import('../api/admin')).default;
});

after(() => server?.close());

const get = (query: string, token: string = TOKEN): Promise<Response> =>
  handler(new Request(`https://printmn.mn/api/admin${query}`, { headers: { 'x-admin-token': token } }));

const post = (body: unknown, token: string = TOKEN): Promise<Response> =>
  handler(
    new Request('https://printmn.mn/api/admin', {
      method: 'POST',
      headers: { 'x-admin-token': token, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

// ── Нэвтрэлт ───────────────────────────────────────────────────────

test('токенгүй бол юу ч гарахгүй', async () => {
  // Кирилл токен HTTP толгойд огт багтдаггүй (ByteString) — тестэд ч, NAS дээр ч.
  // Тиймээс `nas-sync.py` нь тэрийг урьдчилан барьж, ойлгомжтой алдаа өгдөг.
  assert.equal((await get('?days=7', 'wrong-token-abcdefg')).status, 401);
  assert.equal((await get('?days=7', '')).status, 401);
});

// ── Жагсаалт ба шүүлтүүр ───────────────────────────────────────────

test('өгөгдмөл жагсаалт нь ТӨЛӨГДӨӨГҮЙг ч харуулна (ажилтны апп)', async () => {
  const body = await (await get('?days=1')).json();
  assert.equal(body.orders.length, 3);
  assert.equal(body.state, 'all');
});

test('state=pending-sync нь NAS-д хэрэгтэйг л өгнө', async () => {
  seed();
  const body = await (await get('?days=1&state=pending-sync')).json();

  const numbers = body.orders.map((o: Manifest) => o.orderNumber);
  // 0001 — төлөгдсөн, татагдаагүй → орно
  // 0002 — төлөгдөөгүй            → орохгүй
  // 0003 — аль хэдийн татагдсан   → орохгүй
  assert.deepEqual(numbers, ['PMN-260819-0001']);
  assert.equal(body.total, 3, 'нийт тоог хэвээр хэлнэ');
});

test('төлөгдөөгүй захиалганд татах линк ОГТ үүсэхгүй', async () => {
  seed();
  const body = await (await get('?days=1')).json();
  const pending = body.orders.find((o: Manifest) => o.orderNumber === 'PMN-260819-0002');

  assert.ok(pending.files.length > 0, 'файлын жагсаалт нь харагдана');
  assert.ok(
    pending.files.every((f: { url: string | null }) => f.url === null),
    'гэхдээ линк нь бүгд null — DevTools нээсэн ч татах юм алга',
  );
});

test('төлөгдсөн захиалганд presigned линк ирнэ', async () => {
  seed();
  const body = await (await get('?days=1&state=paid')).json();
  const order = body.orders[0];

  const url = new URL(order.files[0].url);
  assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
  assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/);
});

test('?ref= нь ганц захиалга буцаана', async () => {
  seed();
  const body = await (await get(`?ref=${encodeURIComponent(key('PMN-260819-0001'))}`)).json();
  assert.equal(body.orders.length, 1);
  assert.equal(body.orders[0].orderNumber, 'PMN-260819-0001');

  assert.equal((await get('?ref=manifests/2026-08-19/PMN-YOK-abcdefghijkmnpqr.json')).status, 404);
});

// ── NAS-ын тэмдэглэгээ ─────────────────────────────────────────────

test('NAS татсанаа тэмдэглэхэд syncedAt бичигдэнэ', async () => {
  seed();
  const response = await post({
    action: 'synced',
    ref: key('PMN-260819-0001'),
    synced: true,
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(typeof body.syncedAt === 'number' && body.syncedAt > 0);

  // Дараагийн pending-sync-д тэр захиалга гарахаа болино.
  const list = await (await get('?days=1&state=pending-sync')).json();
  assert.deepEqual(list.orders, []);
});

test('«татсан» хариунд presigned линк дэмий үүсэхгүй', async () => {
  seed();
  const body = await (await post({ action: 'synced', ref: key('PMN-260819-0001') })).json();
  assert.equal(body.files, undefined, '60 ширхэг линк буцаах шаардлагагүй');
});

test('ТӨЛӨГДӨӨГҮЙ захиалгыг «татсан» гэж тэмдэглүүлэхгүй', async () => {
  seed();
  /*
   * Энэ бол зүгээр нэг цэвэрлэгээ биш. Хэрэв төлөгдөөгүй захиалга «татсан»
   * болж тэмдэглэгдвэл, төлбөр нь маргааш орох үед `pending-sync` шүүлтүүр
   * түүнийг мөнхөд алгасна — үйлчлүүлэгч төлчихөөд зурагтайгаа үлдэнэ.
   */
  const response = await post({ action: 'synced', ref: key('PMN-260819-0002') });
  assert.equal(response.status, 409);

  const stored = JSON.parse(objects.get(key('PMN-260819-0002'))!);
  assert.equal(stored.syncedAt, undefined, 'манифест хөндөгдөөгүй');
});

test('synced:false нь дахин татуулна', async () => {
  seed();
  await post({ action: 'synced', ref: key('PMN-260819-0003'), synced: false });

  const list = await (await get('?days=1&state=pending-sync')).json();
  assert.deepEqual(
    list.orders.map((o: Manifest) => o.orderNumber),
    ['PMN-260819-0001', 'PMN-260819-0003'],
  );
});

test('танихгүй үйлдлийг татгалзана', async () => {
  const response = await post({ action: 'delete', ref: key('PMN-260819-0001') });
  assert.equal(response.status, 400);
});

test('хэвлэсэн тэмдэглэгээ NAS-ын тэмдэглэгээг устгахгүй', async () => {
  seed();
  await post({ action: 'mark', ref: key('PMN-260819-0003'), printed: true });

  const stored = JSON.parse(objects.get(key('PMN-260819-0003'))!);
  assert.equal(stored.syncedAt, 1_760_000_300_000, 'syncedAt хэвээр');
  assert.ok(stored.printedAt > 0, 'printedAt нэмэгдсэн');
});
