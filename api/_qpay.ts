/**
 * QPay Merchant V2 клиент.
 *
 * Урсгал (QPay-ийн зөвлөмжит дараалал):
 *   1. `POST /v2/auth/token` — Basic auth-аар access token
 *   2. `POST /v2/invoice`    — нэхэмжлэл үүсгэж QR + банкны deeplink авах
 *   3. хэрэглэгч банкны аппаараа төлнө
 *   4. QPay бидний `callback_url` рүү мэдэгдэнэ
 *   5. `POST /v2/payment/check` — гүйлгээг БАТАЛГААЖУУЛНА
 *
 * ⚠️ 5 дугаар алхмыг алгасаж болохгүй: callback нь зүгээр л HTTP хүсэлт учир
 * хэн ч бидний endpoint рүү хуурамчаар дуудаж «төлөгдсөн» гэж бичүүлэх
 * боломжтой. Зөвхөн QPay-ээс өөрөөс нь асууж баталгаажуулсан үед л төлбөрийг
 * хүлээн зөвшөөрнө.
 *
 * QPay мөн «cron-оор байнга шалгаж болохгүй» гэж заасан тул бид зөвхөн
 * callback ирсний дараа болон хэрэглэгч хуудсаа нээлттэй байлгасан үед
 * ховорхон шалгана.
 */

export interface QPayConfig {
  baseUrl: string;
  username: string;
  password: string;
  invoiceCode: string;
}

export const readQPayConfig = (
  env: Record<string, string | undefined>,
): QPayConfig | null => {
  const username = env.QPAY_USERNAME ?? '';
  const password = env.QPAY_PASSWORD ?? '';
  const invoiceCode = env.QPAY_INVOICE_CODE ?? '';
  if (!username || !password || !invoiceCode) return null;
  return {
    // Туршилтын орчин: https://merchant-sandbox.qpay.mn
    baseUrl: (env.QPAY_BASE_URL ?? 'https://merchant.qpay.mn').replace(/\/$/, ''),
    username,
    password,
    invoiceCode,
  };
};

/**
 * Токеныг instance-ийн санах ойд хадгална.
 *
 * QPay «хугацаа дуусаагүй байхад дахин дахин токен авч болохгүй» гэж
 * анхааруулсан. Edge instance богино настай тул энэ нь төгс кэш биш ч, нэг
 * instance олон захиалга боловсруулах үед л давтагдахаас сэргийлнэ.
 */
let cached: { token: string; expiresAt: number } | null = null;

const base64 = (value: string): string => {
  if (typeof btoa === 'function') return btoa(value);
  return Buffer.from(value, 'utf8').toString('base64');
};

async function getToken(config: QPayConfig): Promise<string | null> {
  // 60 секундын нөөцтэй — сүлжээний саатал дунд хугацаа дуусахаас сэргийлнэ.
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  try {
    const response = await fetch(`${config.baseUrl}/v2/auth/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${base64(`${config.username}:${config.password}`)}`,
        'content-type': 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) return null;

    // `expires_in` нь заримдаа UNIX секунд, заримдаа үргэлжлэх хугацаа байдаг —
    // хоёуланг нь зөв тайлна.
    const raw = Number(body.expires_in) || 0;
    const expiresAt = raw > 1_600_000_000 ? raw * 1000 : Date.now() + (raw || 3600) * 1000;

    cached = { token: body.access_token, expiresAt };
    return cached.token;
  } catch {
    return null;
  }
}

export interface QPayInvoice {
  invoiceId: string;
  /** QR-ийн текст — клиент дээр зурахад. */
  qrText: string;
  /** base64 PNG (өмнөх `data:` угтваргүй). */
  qrImage: string;
  /** Банкны аппуудын deeplink. */
  urls: { name: string; description: string; logo: string; link: string }[];
}

export async function createInvoice(
  config: QPayConfig,
  input: {
    orderNumber: string;
    amount: number;
    description: string;
    receiver: string;
    callbackUrl: string;
  },
): Promise<QPayInvoice | null> {
  const token = await getToken(config);
  if (!token) return null;

  try {
    const response = await fetch(`${config.baseUrl}/v2/invoice`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        invoice_code: config.invoiceCode,
        // ЗААВАЛ давтагдашгүй байх ёстой — захиалгын дугаар бидэнд аль хэдийн
        // өдөр + санамсаргүй 4 оронтой тоог агуулдаг.
        sender_invoice_no: input.orderNumber,
        invoice_receiver_code: input.receiver || 'terminal',
        invoice_description: input.description,
        amount: input.amount,
        callback_url: input.callbackUrl,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      invoice_id?: string;
      qr_text?: string;
      qr_image?: string;
      urls?: QPayInvoice['urls'];
    };
    if (!body.invoice_id) return null;

    return {
      invoiceId: body.invoice_id,
      qrText: body.qr_text ?? '',
      qrImage: body.qr_image ?? '',
      urls: Array.isArray(body.urls) ? body.urls.slice(0, 20) : [],
    };
  } catch {
    return null;
  }
}

/**
 * Нэхэмжлэл бүрэн төлөгдсөн эсэхийг QPay-ЭЭС асууж баталгаажуулна.
 *
 * Хэсэгчилсэн төлөлтийг «төлөгдсөн» гэж үзэхгүй: `paid_amount` нь дүнгээс
 * багагүй байх ёстой.
 */
export async function isInvoicePaid(
  config: QPayConfig,
  invoiceId: string,
  amount: number,
): Promise<boolean> {
  const token = await getToken(config);
  if (!token) return false;

  try {
    const response = await fetch(`${config.baseUrl}/v2/payment/check`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        object_type: 'INVOICE',
        object_id: invoiceId,
        offset: { page_number: 1, page_limit: 100 },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return false;

    const body = (await response.json()) as {
      count?: number;
      paid_amount?: number;
      rows?: { payment_status?: string; payment_amount?: string | number }[];
    };

    const paid = Number(body.paid_amount) || 0;
    if (paid >= amount && amount > 0) return true;

    // Зарим хариунд `paid_amount` ирдэггүй — мөрүүдээс өөрсдөө нийлбэрлэнэ.
    const summed = (body.rows ?? [])
      .filter((row) => row.payment_status === 'PAID')
      .reduce((sum, row) => sum + (Number(row.payment_amount) || 0), 0);

    return amount > 0 && summed >= amount;
  } catch {
    return false;
  }
}
