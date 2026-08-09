import assert from 'node:assert/strict';
import test from 'node:test';
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
  for (const method of ['save', 'get', 'getByRef', 'list', 'update', 'fileUrl'] as const) {
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
