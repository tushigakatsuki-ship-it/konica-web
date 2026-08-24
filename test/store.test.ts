import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { R2Store, createR2Store } from '../api/_store/r2Store';
import type { WebOrderStore } from '../api/_store/types';

/**
 * Хадгалалтын порт нь Postgres руу шилжихэд гэрээ нь тогтвортой байх ёстой.
 * Энд R2 хэрэгжүүлэлтийн ГЭРЭЭг (интерфейс, тохиргоо) шалгана — сүлжээний
 * дуудлагыг `test/handler.test.ts` хуурамч сервер дээр шалгадаг.
 */

const env = {
  R2_ACCOUNT_ID: 'acct123',
  R2_BUCKET: 'printmn',
  R2_ACCESS_KEY_ID: 'k',
  R2_SECRET_ACCESS_KEY: 's',
};

test('тохиргоо дутуу бол хадгалалт үүсэхгүй', () => {
  assert.equal(createR2Store({}), null);
  assert.equal(createR2Store({ R2_BUCKET: 'b' }), null);
});

test('тохиргоо бүрэн бол R2 хадгалалт үүснэ', () => {
  const store = createR2Store(env);
  assert.ok(store instanceof R2Store);
  assert.equal(store?.ready, true);
});

test('порт нь шаардлагатай бүх үйлдлийг тодорхойлсон', () => {
  const store = createR2Store(env) as WebOrderStore;
  for (const method of [
    'save',
    'get',
    'getByRef',
    'list',
    'update',
    'fileUrl',
    'usedOrderNumbers',
  ] as const) {
    assert.equal(typeof store[method], 'function', method);
  }
});

test('getByRef нь дурын түлхүүрээр объект уншихгүй', async () => {
  const store = createR2Store(env)!;
  // Хэлбэр нь manifest-ийнх биш бол сүлжээ рүү огт гардаггүй — эс тэгвээс
  // ажилтны токен алдагдсан үед bucket доторх ямар ч объектыг уншиж болно.
  assert.equal(await store.getByRef('uploads/2026-08-06/x/01-print.jpg'), null);
  assert.equal(await store.getByRef('../../secret'), null);
});

test('fileUrl нь хугацаатай presigned линк өгнө', async () => {
  const store = createR2Store(env)!;
  const url = new URL(await store.fileUrl('uploads/2026-08-06/abcdefghijkmnpqr/01-print.jpg'));

  assert.equal(url.host, 'acct123.r2.cloudflarestorage.com');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '3600');
  assert.match(url.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/);
});


// ── Захиалгын дугаарын давхцлаас сэргийлэх ─────────────────────────

let listServer: http.Server;
let listedPrefix = '';

before(async () => {
  listServer = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    listedPrefix = url.searchParams.get('prefix') ?? '';

    /*
     * Гурав дахь түлхүүр нь ЗАХИАЛГЫН биш — R2 дотор өөр объект байж болно
     * (жишээ нь гараар оруулсан файл). Хэлбэр таарахгүй бол алгасах ёстой.
     */
    const keys = [
      'manifests/2026-08-06/PMN-260806-1000-abcdefghijkmnpqr.json',
      'manifests/2026-08-06/PMN-260806-2000-zyxwvutsrqponmlk.json',
      'manifests/2026-08-06/README.txt',
    ];
    res.writeHead(200, { 'content-type': 'application/xml' });
    res.end(
      `<?xml version="1.0"?><ListBucketResult>${keys
        .map((key) => `<Contents><Key>${key}</Key></Contents>`)
        .join('')}</ListBucketResult>`,
    );
  });
  await new Promise<void>((resolve) => listServer.listen(0, '127.0.0.1', resolve));
});

after(() => listServer?.close());

const localStore = () =>
  createR2Store({
    S3_ENDPOINT: `http://127.0.0.1:${(listServer.address() as AddressInfo).port}`,
    R2_BUCKET: 'printmn',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
  })!;

test('usedOrderNumbers нь тухайн ӨДРИЙН дугаарыг гаргана', async () => {
  /*
   * ⚠️ Энэ нь захиалгын дугаарын давхцлаас хамгаалах цорын ганц эх сурвалж.
   * Дугаар нь банкны гүйлгээний утга болдог тул давхцвал хоёр үйлчлүүлэгчийн
   * төлбөрийг ялгах арга байхгүй болно.
   */
  const numbers = await localStore().usedOrderNumbers('2026-08-06');

  assert.deepEqual([...numbers].sort(), ['PMN-260806-1000', 'PMN-260806-2000']);
  assert.equal(listedPrefix, 'manifests/2026-08-06/', 'буруу өдрийг хайлаа');
});

test('хэлбэр таарахгүй түлхүүрийг алгасна', async () => {
  const numbers = await localStore().usedOrderNumbers('2026-08-06');
  assert.ok(![...numbers].some((n) => n.includes('README')), 'хог утга орлоо');
  for (const number of numbers) assert.match(number, /^PMN-\d{6}-\d{4}$/);
});
