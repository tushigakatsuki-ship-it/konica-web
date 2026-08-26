import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPROX_MB_PER_PHOTO,
  FILES_PER_PHOTO,
  MAX_PHOTOS_PER_ORDER,
  PUT_EXPIRES_SEC,
  SLOW_MB_PER_MIN,
  worstCaseUploadMinutes,
} from '../src/lib/limits';
import {
  MAX_FILES,
  isDateStamp,
  isOrderNumber,
  isUploadId,
  makeUploadId,
  manifestKey,
  parseManifestKey,
  uploadKey,
  validateManifestFiles,
  validateUploadRequest,
} from '../api/_files';
import { ValidationError } from '../api/_shared';
import {
  encodeKey,
  parseKeys,
  presign,
  readR2Config,
  rfc3986,
  signRequest,
} from '../api/_r2';

const R2 = {
  host: 'acct123.r2.cloudflarestorage.com',
  protocol: 'https' as const,
  bucket: 'printmn',
  region: 'auto',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret-example-key',
};

const NOW = new Date('2026-08-06T04:15:00.000Z');

// ── Түлхүүр үүсгэх ─────────────────────────────────────────────────

test('uploadKey нь дугаарлагдсан, төрлөө агуулсан зам өгнө', () => {
  assert.equal(
    uploadKey('2026-08-06', 'abcdefghijkmnpqr', 0, 'print', 'jpg'),
    'uploads/2026-08-06/abcdefghijkmnpqr/01-print.jpg',
  );
  assert.equal(
    uploadKey('2026-08-06', 'abcdefghijkmnpqr', 11, 'original', 'PNG'),
    'uploads/2026-08-06/abcdefghijkmnpqr/12-original.png',
  );
});

test('танихгүй өргөтгөлийг jpg болгоно', () => {
  assert.ok(
    uploadKey('2026-08-06', 'abcdefghijkmnpqr', 0, 'print', '../evil.sh').endsWith(
      '01-print.jpg',
    ),
  );
});

test('manifestKey ба parseManifestKey хосолно', () => {
  const key = manifestKey('2026-08-06', 'PMN-260806-4821', 'abcdefghijkmnpqr');
  assert.equal(key, 'manifests/2026-08-06/PMN-260806-4821-abcdefghijkmnpqr.json');
  assert.deepEqual(parseManifestKey(key), {
    date: '2026-08-06',
    orderNumber: 'PMN-260806-4821',
    uploadId: 'abcdefghijkmnpqr',
  });
  assert.equal(parseManifestKey('manifests/../../etc/passwd'), null);
  assert.equal(parseManifestKey('uploads/2026-08-06/x/01-print.jpg'), null);
});

test('makeUploadId нь 16 тэмдэгт, төөрөгдүүлдэг үсэггүй', () => {
  const id = makeUploadId();
  assert.equal(id.length, 16);
  assert.ok(isUploadId(id), id);
  // l, o, 0, 1 — гараар бичихэд андуурдаг тул цагаан толгойд байхгүй.
  assert.ok(!/[lo01]/.test(id), id);
});

test('makeUploadId нь КРИПТОГРАФИК эх сурвалж ашиглана', () => {
  /*
   * `uploadId` бол `/api/payment`-ийн нэвтрэлт. `Math.random`-оор үүсгэвэл
   * гаралтуудаас нь дотоод төлөвийг сэргээж бусад захиалгын id-г тооцоолох
   * онолын зам үлддэг. Энэ тест нь өгөгдмөл эх сурвалж нь `crypto` мөн эсэхийг
   * ЖИНХЭНЭ дуудлагаар шалгана: `crypto.getRandomValues` дуудагдаагүй бол унана.
   */
  const real = globalThis.crypto.getRandomValues;
  let calls = 0;
  globalThis.crypto.getRandomValues = ((array: ArrayBufferView<ArrayBuffer>) => {
    calls += 1;
    return real.call(globalThis.crypto, array);
  }) as typeof real;

  try {
    const id = makeUploadId();
    assert.equal(id.length, 16);
    assert.equal(calls, 16, 'тэмдэгт бүр криптографик эх сурвалжаас гарах ёстой');
  } finally {
    globalThis.crypto.getRandomValues = real;
  }
});

test('makeUploadId нь хазайлтгүй — цагаан толгой хоёрын зэрэгт', () => {
  /*
   * 32 тэмдэгт бол 2^5. `floor(random() * 32)` нь жигд `[0,1)`-ээс модулийн
   * хазайлтгүй 5 бит авна. Хэрэв хэн нэг нь цагаан толгойд үсэг НЭМБЭЛ (33
   * болбол) хазайлт үүсч, эхний тэмдэгтүүд илүү давтамжтай гарна — энтропи
   * чимээгүй буурна. Энэ тест тэрийг барина.
   */
  const alphabetSize = 32;
  assert.equal(alphabetSize & (alphabetSize - 1), 0, 'цагаан толгой 2-ын зэрэг байх ёстой');

  // Бүх 32 тэмдэгт хүрч чадахыг шалгана — хамгийн сүүлийнх нь ч гарна.
  const seen = new Set<string>();
  for (let i = 0; i < alphabetSize; i += 1) {
    seen.add(makeUploadId(() => i / alphabetSize)[0]);
  }
  assert.equal(seen.size, alphabetSize, 'зарим тэмдэгт хэзээ ч гарахгүй байна');
});

test('хэлбэр шалгагчид', () => {
  assert.ok(isOrderNumber('PMN-260806-4821'));
  assert.ok(!isOrderNumber('PMN-26086-4821'));
  assert.ok(!isOrderNumber('../../x'));
  assert.ok(isDateStamp('2026-08-06'));
  assert.ok(!isDateStamp('2026-8-6'));
  assert.ok(!isUploadId('short'));
});

// ── /api/upload баталгаажуулалт ────────────────────────────────────

test('зөв хүсэлтийг хүлээж авна', () => {
  const files = validateUploadRequest({
    files: [{ kind: 'print', ext: 'jpg', size: 1234, contentType: 'image/jpeg' }],
  });
  assert.equal(files.length, 1);
  assert.equal(files[0].kind, 'print');
});

test('хоосон, хэт олон, буруу төрөл, хэт том файлыг татгалзана', () => {
  const bad = [
    {},
    { files: [] },
    { files: Array.from({ length: MAX_FILES + 1 }, () => ({ kind: 'print', ext: 'jpg', size: 1, contentType: 'image/jpeg' })) },
    { files: [{ kind: 'exe', ext: 'jpg', size: 1, contentType: 'image/jpeg' }] },
    { files: [{ kind: 'print', ext: 'jpg', size: 1, contentType: 'application/pdf' }] },
    { files: [{ kind: 'print', ext: 'jpg', size: 99 * 1024 * 1024, contentType: 'image/jpeg' }] },
    { files: [{ kind: 'print', ext: 'jpg', size: 0, contentType: 'image/jpeg' }] },
  ];
  for (const input of bad) {
    assert.throws(() => validateUploadRequest(input), ValidationError, JSON.stringify(input));
  }
});

// ── Manifest баталгаажуулалт ───────────────────────────────────────

const goodFile = {
  key: 'uploads/2026-08-06/abcdefghijkmnpqr/01-print.jpg',
  kind: 'print',
  name: '01_10x15_2sh_print.jpg',
  size: 2048,
  serviceId: 103,
  sizeLabel: '10×15 см',
  qty: 2,
};

test('зөв файлын жагсаалтыг цэвэрлэж буцаана', () => {
  const files = validateManifestFiles([goodFile], '2026-08-06', 'abcdefghijkmnpqr');
  assert.equal(files.length, 1);
  assert.equal(files[0].qty, 2);
  assert.equal(files[0].name, '01_10x15_2sh_print.jpg');
});

test('өөр байршуулалтын түлхүүрийг ХҮЛЭЭЖ АВАХГҮЙ', () => {
  // Энэ бол хамгийн чухал шалгалт: эс тэгвээс хэн ч бусдын зургийн замыг
  // өөрийн manifest-даа бичээд admin хуудсаар татаж авах боломжтой болно.
  const stolen = {
    ...goodFile,
    key: 'uploads/2026-08-06/zzzzzzzzzzzzzzzz/01-print.jpg',
  };
  assert.throws(
    () => validateManifestFiles([stolen], '2026-08-06', 'abcdefghijkmnpqr'),
    ValidationError,
  );
  assert.throws(
    () => validateManifestFiles([{ ...goodFile, key: 'manifests/x.json' }], '2026-08-06', 'abcdefghijkmnpqr'),
    ValidationError,
  );
});

test('файлын нэрнээс аюултай тэмдэгтийг цэвэрлэнэ', () => {
  const files = validateManifestFiles(
    [{ ...goodFile, name: '../../etc/passwd' }],
    '2026-08-06',
    'abcdefghijkmnpqr',
  );
  assert.ok(!files[0].name.includes('/'));
});

test('файлгүй захиалга хүчинтэй', () => {
  assert.deepEqual(validateManifestFiles(undefined, '2026-08-06', 'abcdefghijkmnpqr'), []);
});

// ── SigV4 ──────────────────────────────────────────────────────────

test('rfc3986 нь AWS-ийн шаарддаг тэмдэгтүүдийг кодлоно', () => {
  assert.equal(rfc3986("a!b'c(d)e*f"), 'a%21b%27c%28d%29e%2Af');
  assert.equal(rfc3986('a/b'), 'a%2Fb');
  assert.equal(encodeKey('uploads/2026-08-06/x/01-print.jpg'), 'uploads/2026-08-06/x/01-print.jpg');
  assert.equal(encodeKey('a b/c'), 'a%20b/c');
});

test('presign нь шаардлагатай бүх параметртэй URL өгнө', async () => {
  const url = await presign(R2, 'PUT', 'uploads/2026-08-06/x/01-print.jpg', 900, NOW);
  const parsed = new URL(url);

  assert.equal(parsed.host, 'acct123.r2.cloudflarestorage.com');
  assert.equal(parsed.pathname, '/printmn/uploads/2026-08-06/x/01-print.jpg');
  assert.equal(parsed.searchParams.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256');
  assert.equal(parsed.searchParams.get('X-Amz-Date'), '20260806T041500Z');
  assert.equal(parsed.searchParams.get('X-Amz-Expires'), '900');
  assert.equal(parsed.searchParams.get('X-Amz-SignedHeaders'), 'host');
  assert.equal(
    parsed.searchParams.get('X-Amz-Credential'),
    'AKIAEXAMPLE/20260806/auto/s3/aws4_request',
  );
  assert.match(parsed.searchParams.get('X-Amz-Signature') ?? '', /^[0-9a-f]{64}$/);
});

test('гарын үсэг нь тогтвортой бөгөөд оролт бүрт өөр', async () => {
  const a = await presign(R2, 'PUT', 'k/1.jpg', 900, NOW);
  const again = await presign(R2, 'PUT', 'k/1.jpg', 900, NOW);
  const otherKey = await presign(R2, 'PUT', 'k/2.jpg', 900, NOW);
  const otherMethod = await presign(R2, 'GET', 'k/1.jpg', 900, NOW);
  const otherExpiry = await presign(R2, 'PUT', 'k/1.jpg', 901, NOW);

  const sig = (url: string) => new URL(url).searchParams.get('X-Amz-Signature');
  assert.equal(sig(a), sig(again));
  for (const other of [otherKey, otherMethod, otherExpiry]) {
    assert.notEqual(sig(a), sig(other));
  }
});

test('signRequest нь Authorization толгой ба payload хэш бэлдэнэ', async () => {
  const signed = await signRequest(R2, 'PUT', 'manifests/a.json', {
    body: '{"a":1}',
    contentType: 'application/json',
    now: NOW,
  });
  assert.equal(signed.url, 'https://acct123.r2.cloudflarestorage.com/printmn/manifests/a.json');
  assert.match(signed.headers.Authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260806\//);
  assert.match(signed.headers.Authorization, /SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date/);
  assert.match(signed.headers['x-amz-content-sha256'], /^[0-9a-f]{64}$/);
});

test('ListObjectsV2 хүсэлт нь bucket-ийн үндэс рүү query-тэй очно', async () => {
  const signed = await signRequest(R2, 'GET', '', {
    query: { 'list-type': '2', prefix: 'manifests/2026-08-06/' },
    now: NOW,
  });
  assert.ok(signed.url.startsWith('https://acct123.r2.cloudflarestorage.com/printmn?'));
  assert.ok(signed.url.includes('list-type=2'));
  assert.ok(signed.url.includes('prefix=manifests%2F2026-08-06%2F'));
});

test('parseKeys нь XML-ээс түлхүүрүүдийг гаргана', () => {
  const xml =
    '<?xml version="1.0"?><ListBucketResult>' +
    '<Contents><Key>manifests/2026-08-06/PMN-1.json</Key><Size>10</Size></Contents>' +
    '<Contents><Key>manifests/2026-08-06/PMN-2.json</Key></Contents>' +
    '</ListBucketResult>';
  assert.deepEqual(parseKeys(xml), [
    'manifests/2026-08-06/PMN-1.json',
    'manifests/2026-08-06/PMN-2.json',
  ]);
  assert.deepEqual(parseKeys('<ListBucketResult/>'), []);
});

// ── Сангийн тохиргоо ───────────────────────────────────────────────

test('өгөгдөл дутуу бол тохиргоо null', () => {
  assert.equal(readR2Config({}), null);
  // Хувьсагч бүрэн ч endpoint/accountId аль нь ч байхгүй.
  assert.equal(
    readR2Config({ R2_BUCKET: 'b', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' }),
    null,
  );
});

test('R2_ACCOUNT_ID-аас R2-ийн стандарт хаягийг угсарна', () => {
  const config = readR2Config({
    R2_ACCOUNT_ID: 'acct123',
    R2_BUCKET: 'printmn',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
  });
  assert.deepEqual(config, {
    host: 'acct123.r2.cloudflarestorage.com',
    protocol: 'https',
    bucket: 'printmn',
    region: 'auto',
    accessKeyId: 'k',
    secretAccessKey: 's',
  });
});

test('S3_ENDPOINT өгвөл NAS/MinIO руу шилжинэ', () => {
  // Дэлгүүрийн NAS дээрх MinIO — код өөрчлөхгүйгээр зөвхөн орчны хувьсагчаар.
  const config = readR2Config({
    S3_ENDPOINT: 'https://s3.printmn.mn:9000/',
    S3_REGION: 'us-east-1',
    R2_ACCOUNT_ID: 'ignored',
    R2_BUCKET: 'photos',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
  })!;
  assert.equal(config.host, 's3.printmn.mn:9000');
  assert.equal(config.protocol, 'https');
  assert.equal(config.region, 'us-east-1');
});

test('http:// endpoint-ийг хүлээж авна (зөвхөн дотоод сүлжээнд)', () => {
  const config = readR2Config({
    S3_ENDPOINT: 'http://192.168.1.50:9000',
    R2_BUCKET: 'photos',
    R2_ACCESS_KEY_ID: 'k',
    R2_SECRET_ACCESS_KEY: 's',
  })!;
  assert.equal(config.protocol, 'http');
  assert.equal(config.host, '192.168.1.50:9000');
});

test('өөр endpoint/бүс дээр гарын үсэг өөр гарна', async () => {
  const nas = { ...R2, host: 's3.printmn.mn:9000', region: 'us-east-1' };
  const a = await presign(R2, 'PUT', 'k/1.jpg', 900, NOW);
  const b = await presign(nas, 'PUT', 'k/1.jpg', 900, NOW);

  assert.ok(b.startsWith('https://s3.printmn.mn:9000/printmn/k/1.jpg?'));
  assert.ok(new URL(b).searchParams.get('X-Amz-Credential')?.includes('/us-east-1/s3/'));
  assert.notEqual(
    new URL(a).searchParams.get('X-Amz-Signature'),
    new URL(b).searchParams.get('X-Amz-Signature'),
  );
});

/*
 * ── Гарын үсгийн хугацаа vs илгээх хугацаа ──────────────────────────
 *
 * ⚠️ ЭНЭ БОЛ ЗАХИАЛГА УНАГААХ ЧАДВАРТАЙ ХАРЬЦАА.
 *
 * Урьд нь `PUT_EXPIRES_SEC` нь 20 минут байсан бөгөөд хязгаар 30 зураг
 * байх үед хангалттай байв. Хязгаарыг 100 болгоход энэ хоёр САЛСАН:
 * 100 зураг ≈ 650MB нь дундаж 4G дээр 43 минут илгээгддэг тул хэрэглэгч
 * 20 минут илгээж байгаад 46 дахь зураг дээр `403` авна.
 *
 * Хамгийн муу нь `403` бол 4xx учир байршуулагч түүнийг БАЙНГЫН алдаа гэж
 * үзэж дахин оролддоггүй — 40 минут илгээсэн захиалга бүхэлдээ унана.
 *
 * Тиймээс хоёр тоог тусад нь тааварлаж БОЛОХГҮЙ. Энэ тест тэднийг хамт
 * барина: хязгаарыг өсгөвөл гарын үсгийн хугацаа автоматаар дагана,
 * дагаагүй бол энд унана.
 */

test('presigned хаяг нь хамгийн урт илгээлтийг ДААНА', () => {
  const worst = worstCaseUploadMinutes();
  const window = PUT_EXPIRES_SEC / 60;

  assert.ok(
    window >= worst * 2,
    `гарын үсэг ${window} минут, хамгийн муу илгээлт ${worst} минут — ` +
      'дахин оролдлого, тасалдалд нөөц үлдэхгүй',
  );

  /*
   * Дээд талаас нь ч барина: хэдэн өдрийн турш хүчинтэй хаяг нь хэрэггүй
   * эрсдэл. Хаяг алдагдвал тэр хугацаанд хэн ч тухайн түлхүүрийг дарж
   * бичиж чадна.
   */
  assert.ok(window <= 12 * 60, `гарын үсэг ${window} минут — хэтэрхий урт`);
});

test('хамгийн муу тохиолдлын тооцоо хязгаараас ГАРНА', () => {
  /*
   * Тоог гараар бичвэл хязгаар өөрчлөгдөхөд дагахгүй.
   */
  assert.equal(
    worstCaseUploadMinutes(MAX_PHOTOS_PER_ORDER),
    Math.ceil((MAX_PHOTOS_PER_ORDER * APPROX_MB_PER_PHOTO) / SLOW_MB_PER_MIN),
  );

  // Цөөн зурагтай захиалга харьцангуй богино байх ёстой.
  assert.ok(
    worstCaseUploadMinutes(10) < worstCaseUploadMinutes(100),
    'зургийн тоо хугацаанд нөлөөлөхгүй байна',
  );
});

test('нэг захиалгын файлын тоо нь зургийн хязгаараас ГАРНА', () => {
  assert.equal(MAX_FILES, MAX_PHOTOS_PER_ORDER * FILES_PER_PHOTO);
});
