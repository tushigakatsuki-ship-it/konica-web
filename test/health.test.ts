import assert from 'node:assert/strict';
import test, { after, afterEach, before } from 'node:test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

/**
 * `/api/health` — тохиргоо бүрэн эсэхийг хэлдэг хуудас.
 *
 * Хамгийн чухал шалгалт нь «зөв хариулж байна уу» биш, **нууц утга гоожихгүй
 * байна уу** гэдэг. Энэ endpoint нь нэвтрэлтгүй тул токен, түлхүүрийн ямар нэг
 * хэсэг хариунд орвол интернэтэд ил гарна.
 */

const SECRETS = {
  ADMIN_TOKEN: 'super-secret-admin-token-999',
  R2_ACCESS_KEY_ID: 'AKIAsecretkeyid',
  R2_SECRET_ACCESS_KEY: 'secretaccesskeyvalue',
  TELEGRAM_BOT_TOKEN: '123456:telegram-secret',
  QPAY_PASSWORD: 'qpay-secret-pass',
};

let handler: (request: Request) => Promise<Response>;
let server: http.Server;
let storageStatus = 200;
const saved = { ...process.env };

before(async () => {
  server = http.createServer((_req, res) => res.writeHead(storageStatus).end('<ListBucketResult/>'));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  handler = (await import('../api/health')).default;
});

after(() => server?.close());
afterEach(() => {
  process.env = { ...saved };
});

const endpoint = (): string => `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

const configure = (extra: Record<string, string> = {}): void => {
  process.env.S3_ENDPOINT = endpoint();
  process.env.R2_BUCKET = 'printmn-photos';
  process.env.RTDB_AUTH = 'firebase-database-secret';
  Object.assign(process.env, SECRETS, extra);
};

const call = (query = '', token?: string): Promise<Response> =>
  handler(
    new Request(`https://printmn.mn/api/health${query}`, {
      headers: token ? { 'x-admin-token': token } : {},
    }),
  );

// ── Гоожилт ────────────────────────────────────────────────────────

test('НУУЦ УТГА хариунд огт орохгүй', async () => {
  configure();
  const text = await (await call()).text();

  for (const [name, value] of Object.entries(SECRETS)) {
    assert.ok(!text.includes(value), `${name}-ийн утга гоожсон!`);
    // Хэсэгчилсэн гоожилт ч болохгүй — эхний 8 тэмдэгт нь ч таах ажлыг хөнгөвчилнө.
    assert.ok(!text.includes(value.slice(0, 8)), `${name}-ийн эхлэл гоожсон!`);
  }
});

test('токены УРТЫГ ч хэлэхгүй', async () => {
  configure();
  const text = await (await call()).text();
  assert.ok(!text.includes(String(SECRETS.ADMIN_TOKEN.length)));
});

// ── Дутуу тохиргоог нэрлэнэ ────────────────────────────────────────

test('юу ч тохируулаагүй бол ЯГ юу дутууг жагсаана', async () => {
  process.env = {} as NodeJS.ProcessEnv;
  const response = await call();
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.ok, false);
  for (const name of ['R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'ADMIN_TOKEN', 'RTDB_AUTH']) {
    assert.ok(body.missing.includes(name), `${name} жагсаалтад алга`);
  }
});

test('R2_ACCOUNT_ID нь S3_ENDPOINT байвал шаардагдахгүй', async () => {
  process.env = { S3_ENDPOINT: endpoint(), R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' } as NodeJS.ProcessEnv;
  const body = await (await call()).json();
  assert.ok(!body.missing.includes('R2_ACCOUNT_ID'));
  assert.equal(body.checks.storage.ready, true);
});

test('зөвхөн зай агуулсан утгыг «бөглөсөн» гэж үзэхгүй', async () => {
  configure({ ADMIN_TOKEN: '   ' });
  const body = await (await call()).json();
  assert.equal(body.checks.admin.ready, false);
  assert.ok(body.missing.includes('ADMIN_TOKEN'));
});

test('бүх зайлшгүй зүйл бэлэн бол ok:true', async () => {
  configure({ BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567' });
  const response = await call();
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.checks.storage.detail.includes('printmn-photos'), true);
});

test('RTDB_AUTH байхгүй бол ok:false — зөвхөн R2 бүрэн байхад ч', async () => {
  /*
   * Бодит тохиолдол: `R2_*`, `ADMIN_TOKEN`, банк бүгд бөглөгдсөн байтал
   * `/api/health` нь `ok: true` гэж хэлж, хэрэглэгч захиалга илгээхэд
   * «Сервер тохируулагдаагүй байна» гэж гарсан. `/api/order` нь `RTDB_AUTH`
   * байхгүй бол ямар ч зүйл хийхээс өмнө 503 буцаадаг.
   */
  configure({ BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567' });
  delete process.env.RTDB_AUTH;

  const response = await call();
  const body = await response.json();

  assert.equal(body.checks.orders.ready, false);
  assert.equal(body.ok, false, 'R2 бүрэн ч захиалга үүсэхгүй бол ok байж болохгүй');
  assert.ok(body.missing.includes('RTDB_AUTH'));
  assert.equal(response.status, 503);
});

test('Telegram байхгүй нь ok-г унагахгүй (заавал биш)', async () => {
  configure({ BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567' });
  delete process.env.TELEGRAM_BOT_TOKEN;

  const body = await (await call()).json();
  assert.equal(body.checks.notify.ready, false);
  assert.equal(body.ok, true, 'мэдэгдэл унтарсан ч захиалга ажиллана');
});

test('төлбөрийн арга огт байхгүй бол ok:false', async () => {
  configure();
  for (const name of ['QPAY_USERNAME', 'QPAY_PASSWORD', 'QPAY_INVOICE_CODE', 'BANK_NAME', 'BANK_ACCOUNT'])
    delete process.env[name];

  const body = await (await call()).json();
  assert.equal(body.checks.payment.ready, false);
  assert.equal(body.ok, false);
});

// ── Гүн шалгалт ────────────────────────────────────────────────────

test('гүн шалгалт нь токенгүйгээр R2 руу хүсэлт явуулахгүй', async () => {
  configure();
  /*
   * Class A үйлдэл мөнгөтэй. Нээлттэй орхивол хэн ч давтан дуудаж
   * Cloudflare-ийн тооцоог өсгөж чадна.
   */
  assert.equal((await call('?deep=1')).status, 401);
  assert.equal((await call('?deep=1', 'wrong-token-value-here')).status, 401);
});

test('гүн шалгалт нь R2 руу ҮНЭХЭЭР холбогдоно', async () => {
  configure({ BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567' });

  storageStatus = 200;
  let body = await (await call('?deep=1', SECRETS.ADMIN_TOKEN)).json();
  assert.equal(body.checks.storage.ready, true);
  assert.match(body.checks.storage.detail, /түлхүүр зөв/);

  storageStatus = 403;
  body = await (await call('?deep=1', SECRETS.ADMIN_TOKEN)).json();
  assert.equal(body.checks.storage.ready, false);
  assert.match(body.checks.storage.detail, /Access Key/);

  storageStatus = 404;
  body = await (await call('?deep=1', SECRETS.ADMIN_TOKEN)).json();
  assert.equal(body.checks.storage.ready, false);
  assert.match(body.checks.storage.detail, /printmn-photos/);

  storageStatus = 200;
});

test('POST хүлээж авахгүй', async () => {
  configure();
  const response = await handler(
    new Request('https://printmn.mn/api/health', { method: 'POST' }),
  );
  assert.equal(response.status, 405);
});
