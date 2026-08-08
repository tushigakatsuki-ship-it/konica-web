import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

/**
 * Хөгжүүлэлтийн орчны хуурамч back-end.
 *
 * `npm run dev` үед Vite нь `/api/*` замуудыг ОГТ ажиллуулдаггүй (тэдгээр нь
 * Vercel function бөгөөд зөвхөн deploy хийсний дараа амьдардаг). Тиймээс энэ
 * plugin байхгүй бол front-end-ийг локал дээр бүрэн туршиж боломгүй — захиалга
 * илгээх товч дарахад HTML буцаж ирээд JSON задлах алдаа гарна.
 *
 * Энэ plugin нь бодит API-тай ЯГ ижил хэлбэрийн хариу өгнө: presigned URL,
 * захиалгын дугаар, төлбөрийн заавар, admin жагсаалт. Бүх өгөгдөл санах ойд —
 * серверийг дахин асаахад цэвэрлэгдэнэ.
 *
 * `apply: 'serve'` учир үйлдвэрлэлийн build-д ОРОХГҮЙ.
 */

interface MockFile {
  key: string;
  kind: 'print' | 'original';
  name: string;
  size: number;
  serviceId: number;
  sizeLabel: string;
  qty: number;
}

interface MockOrder {
  manifestKey: string;
  orderNumber: string;
  uploadId: string;
  date: string;
  createdAt: number;
  customer: { name: string; phone: string; email: string; note: string };
  total: number;
  lines: { name: string; qty: number; total: number }[];
  files: MockFile[];
  payment: {
    status: 'pending' | 'paid';
    amount: number;
    method: 'qpay' | 'manual' | null;
    paidAt?: number;
  };
  printedAt?: number;
}

/** Байршуулсан зургийн бодит байт — admin дээр бяцхан зураг харагдуулахад. */
const blobs = new Map<string, { type: string; data: Buffer }>();
const orders = new Map<string, MockOrder>();
/** Давхар илгээлтийг бодит API-тай ижилхэн барина. */
const handled = new Map<string, unknown>();

/** Санах ойд хуримтлагдахаас сэргийлж нийт хэмжээг барина. */
const MAX_BLOB_BYTES = 300 * 1024 * 1024;
let storedBytes = 0;

/**
 * Хэдэн секундын дараа «төлбөр орсон» гэж өөрөө тэмдэглэх вэ.
 *
 * Хэрэглэгчийн талын урсгалыг (⏳ → ✅) ажилтны хуудас нээхгүйгээр харахад.
 * `0` тавибал зөвхөн `/admin` дээрээс гараар баталгаажуулна.
 */
const AUTOPAY_MS = Number(process.env.MOCK_AUTOPAY_MS ?? 20_000);

const pad = (value: number) => String(value).padStart(2, '0');

const mongolianToday = (now = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

const makeOrderNumber = (now = new Date()): string =>
  `PMN-${mongolianToday(now).slice(2).replaceAll('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;

const makeUploadId = (): string => {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: 16 }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('');
};

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const send = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
};

/** Төлбөр автоматаар орсон эсэхийг шалгаж, шаардлагатай бол тэмдэглэнэ. */
const settle = (order: MockOrder): MockOrder => {
  if (
    order.payment.status === 'pending' &&
    AUTOPAY_MS > 0 &&
    Date.now() - order.createdAt > AUTOPAY_MS
  ) {
    order.payment = {
      ...order.payment,
      status: 'paid',
      method: 'qpay',
      paidAt: Date.now(),
    };
  }
  return order;
};

/** Бодит API шиг — төлбөр баталгаажаагүй бол линк ОГТ буцаахгүй. */
const withUrls = (order: MockOrder, origin: string) => ({
  ...order,
  files: order.files.map((file) => ({
    ...file,
    url: order.payment.status === 'paid' ? `${origin}/__mock-blob/${file.key}` : null,
  })),
});

export function mockApi(): Plugin {
  return {
    name: 'printmn-mock-api',
    apply: 'serve',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '/').split('?')[0];
        if (!path.startsWith('/api/') && !path.startsWith('/__mock-blob/')) {
          next();
          return;
        }

        void handleMockRequest(req, res, next);
      });

      server.config.logger.info(
        `\n  🧪 Хуурамч back-end идэвхтэй — /api/* локал дээр ажиллана` +
          `\n     Төлбөр ${AUTOPAY_MS > 0 ? `${AUTOPAY_MS / 1000}с-ийн дараа автоматаар` : 'зөвхөн /admin дээрээс'} баталгаажна` +
          `\n     /admin — ямар ч нууц үг тохирно\n`,
      );
    },
  };
}

/** Vite-гүйгээр шалгах боломжтой байхын тулд тусад нь экспортлов. */
export async function handleMockRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: (error?: unknown) => void,
): Promise<void> {
  const origin = `http://${req.headers.host ?? 'localhost:5173'}`;
  const url = new URL(req.url ?? '/', origin);
  const method = req.method ?? 'GET';

  try {
    // ── Байршуулсан файлын орлуулга ──────────────────────────────
    if (url.pathname.startsWith('/__mock-blob/')) {
      const key = decodeURIComponent(url.pathname.slice('/__mock-blob/'.length));

      if (method === 'PUT') {
        const data = await readBody(req);
        if (storedBytes + data.length < MAX_BLOB_BYTES) {
          blobs.set(key, {
            type: String(req.headers['content-type'] ?? 'image/jpeg'),
            data,
          });
          storedBytes += data.length;
        }
        res.statusCode = 200;
        res.end();
        return;
      }

      const blob = blobs.get(key);
      if (!blob) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.setHeader('content-type', blob.type);
      res.end(blob.data);
      return;
    }

    // ── POST /api/upload ─────────────────────────────────────────
    if (url.pathname === '/api/upload' && method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as {
        files: { kind: 'print' | 'original'; ext: string }[];
      };
      const date = mongolianToday();
      const uploadId = makeUploadId();

      send(res, 200, {
        uploadId,
        date,
        expiresIn: 1200,
        urls: body.files.map((file, index) => {
          const key = `uploads/${date}/${uploadId}/${pad(index + 1)}-${file.kind}.${file.ext}`;
          return { key, url: `${origin}/__mock-blob/${encodeURIComponent(key)}` };
        }),
      });
      return;
    }

    // ── POST /api/order ──────────────────────────────────────────
    if (url.pathname === '/api/order' && method === 'POST') {
      const body = JSON.parse((await readBody(req)).toString('utf8')) as {
        requestId?: string;
        customer: { name: string; phone: string; email?: string; note?: string };
        lines: { id: number; qty: number }[];
        uploadId?: string;
        date?: string;
        files?: MockFile[];
      };

      // Давтагдсан хүсэлт — шинэ захиалга үүсгэхгүй, өмнөх хариугаа буцаана.
      if (body.requestId && handled.has(body.requestId)) {
        send(res, 201, handled.get(body.requestId));
        return;
      }

      const orderNumber = makeOrderNumber();
      const uploadId = body.uploadId ?? makeUploadId();
      const date = body.date ?? mongolianToday();
      const files = body.files ?? [];

      // Бодит серверийн адилаар үнийг клиентээс биш, мөрийн тооноос ойролцоолно.
      const total = files
        .filter((file) => file.kind === 'print')
        .reduce((sum, file) => sum + 500 * file.qty, 0);

      const order: MockOrder = {
        manifestKey: `manifests/${date}/${orderNumber}-${uploadId}.json`,
        orderNumber,
        uploadId,
        date,
        createdAt: Date.now(),
        customer: {
          name: body.customer.name,
          phone: body.customer.phone,
          email: body.customer.email ?? '',
          note: body.customer.note ?? '',
        },
        total,
        lines: files
          .filter((file) => file.kind === 'print')
          .map((file) => ({
            name: `Зураг угаалт ${file.sizeLabel}`,
            qty: file.qty,
            total: 500 * file.qty,
          })),
        files,
        payment: { status: 'pending', amount: total, method: null },
      };
      if (files.length > 0) orders.set(order.manifestKey, order);

      const result = {
        orderNumber,
        total,
        photos: files.length === 0 ? 'none' : 'saved',
        payment: {
          amount: total,
          qpay: null,
          bank: {
            bank: 'Хаан банк (хуурамч)',
            account: '5000000000',
            holder: 'Printmn dev',
            reference: orderNumber,
            amount: total,
          },
          tracking: files.length > 0 ? { date, uploadId } : null,
        },
      };

      if (body.requestId) {
        handled.set(body.requestId, result);
        if (handled.size > 500) handled.clear();
      }

      send(res, 201, result);
      return;
    }

    // ── GET /api/payment ─────────────────────────────────────────
    if (url.pathname === '/api/payment' && method === 'GET') {
      const key = `manifests/${url.searchParams.get('date')}/${url.searchParams.get('order')}-${url.searchParams.get('u')}.json`;
      const order = orders.get(key);
      if (!order) {
        send(res, 404, { error: 'Захиалга олдсонгүй.' });
        return;
      }
      settle(order);
      send(res, 200, {
        status: order.payment.status,
        paidAt: order.payment.paidAt ?? null,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        amount: order.payment.amount,
        photoCount: order.files.filter((file) => file.kind === 'print').length,
        lines: order.lines,
        printedAt: order.printedAt ?? null,
      });
      return;
    }

    // ── /api/admin ───────────────────────────────────────────────
    if (url.pathname === '/api/admin') {
      if (!req.headers['x-admin-token']) {
        send(res, 401, { error: 'Нууц үг буруу байна.' });
        return;
      }

      if (method === 'POST') {
        const body = JSON.parse((await readBody(req)).toString('utf8')) as {
          action: 'mark' | 'pay';
          manifestKey: string;
          printed?: boolean;
          paid?: boolean;
        };
        const order = orders.get(body.manifestKey);
        if (!order) {
          send(res, 404, { error: 'Захиалга олдсонгүй.' });
          return;
        }

        if (body.action === 'pay') {
          order.payment = body.paid
            ? { ...order.payment, status: 'paid', method: 'manual', paidAt: Date.now() }
            : { ...order.payment, status: 'pending', paidAt: undefined };
        } else if (body.printed) {
          order.printedAt = Date.now();
        } else {
          delete order.printedAt;
        }

        const shaped = withUrls(order, origin);
        send(res, 200, {
          printedAt: order.printedAt ?? null,
          payment: order.payment,
          files: shaped.files,
        });
        return;
      }

      const list = [...orders.values()]
        .map(settle)
        .map((order) => withUrls(order, origin))
        .sort((a, b) => b.createdAt - a.createdAt);
      send(res, 200, { orders: list });
      return;
    }

    send(res, 404, { error: 'Хуурамч back-end энэ замыг мэдэхгүй байна.' });
  } catch (error) {
    next(error);
  }
}
