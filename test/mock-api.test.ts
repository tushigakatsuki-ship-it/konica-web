import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleMockRequest } from '../dev/mock-api';

/**
 * Хөгжүүлэлтийн хуурамч back-end нь бодит API-тай ижил ГЭРЭЭ баримтлах ёстой.
 *
 * Эс тэгвээс локал дээр ажилладаг front-end deploy хийсний дараа унана —
 * ялангуяа төлбөрийн түгжээ (төлөөгүй үед линк буцаахгүй) дээр.
 */

let base = '';
let server: http.Server;

before(async () => {
  server = http.createServer((req, res) => {
    void handleMockRequest(req, res, () => {
      res.statusCode = 500;
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => server.close());

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

test('бүтэн урсгал: upload → PUT → order → payment → admin', async () => {
  const up = (await (
    await post('/api/upload', {
      files: [
        { kind: 'print', ext: 'jpg', size: 10, contentType: 'image/jpeg' },
        { kind: 'original', ext: 'jpg', size: 10, contentType: 'image/jpeg' },
      ],
    })
  ).json()) as { uploadId: string; date: string; urls: { key: string; url: string }[] };

  assert.equal(up.urls.length, 2);
  assert.match(up.urls[0].key, /^uploads\/\d{4}-\d{2}-\d{2}\/[a-z0-9]{16}\/01-print\.jpg$/);

  assert.equal((await fetch(up.urls[0].url, { method: 'PUT', body: 'JPEGBYTES' })).status, 200);

  const order = (await (
    await post('/api/order', {
      customer: { name: 'Бат', phone: '99001234' },
      lines: [{ id: 103, qty: 2 }],
      uploadId: up.uploadId,
      date: up.date,
      files: [
        {
          key: up.urls[0].key,
          kind: 'print',
          name: '01_print.jpg',
          size: 10,
          serviceId: 103,
          sizeLabel: '10×15 см',
          qty: 2,
        },
      ],
    })
  ).json()) as {
    orderNumber: string;
    photos: string;
    payment: { bank: { reference: string }; tracking: { date: string; uploadId: string } };
  };

  assert.match(order.orderNumber, /^PMN-\d{6}-\d{4}$/);
  assert.equal(order.photos, 'saved');
  assert.equal(order.payment.bank.reference, order.orderNumber);
  assert.deepEqual(order.payment.tracking, { date: up.date, uploadId: up.uploadId });

  const statusUrl =
    `${base}/api/payment?order=${order.orderNumber}&date=${up.date}&u=${up.uploadId}`;
  assert.equal(((await (await fetch(statusUrl)).json()) as { status: string }).status, 'pending');

  // Токенгүй хандалт хаалттай.
  assert.equal((await fetch(`${base}/api/admin`)).status, 401);

  // ⚠️ Төлөөгүй үед татах линк ОГТ ирэхгүй — бодит API-тай ижил.
  const before = (await (
    await fetch(`${base}/api/admin`, { headers: { 'x-admin-token': 'dev' } })
  ).json()) as { orders: { manifestKey: string; files: { url: string | null }[] }[] };

  assert.equal(before.orders.length, 1);
  assert.equal(before.orders[0].files[0].url, null);

  const paid = (await (
    await post(
      '/api/admin',
      { action: 'pay', paid: true, manifestKey: before.orders[0].manifestKey },
      { 'x-admin-token': 'dev' },
    )
  ).json()) as { payment: { status: string }; files: { url: string }[] };

  assert.equal(paid.payment.status, 'paid');
  assert.ok(paid.files[0].url, 'төлбөр орсны дараа линк гарах ёстой');

  // Хэрэглэгчийн тал ч шинэчлэгдэнэ.
  assert.equal(((await (await fetch(statusUrl)).json()) as { status: string }).status, 'paid');

  // Байршуулсан зураг буцаж уншигдана.
  const blob = await fetch(paid.files[0].url);
  assert.equal(blob.status, 200);
  assert.equal(await blob.text(), 'JPEGBYTES');
});

test('зураггүй захиалга photos=none, хянах түлхүүргүй', async () => {
  const order = (await (
    await post('/api/order', {
      customer: { name: 'Бат', phone: '99001234' },
      lines: [{ id: 103, qty: 1 }],
    })
  ).json()) as { photos: string; payment: { tracking: unknown } };

  assert.equal(order.photos, 'none');
  assert.equal(order.payment.tracking, null);
});
