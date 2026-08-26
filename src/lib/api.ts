import type { CustomerInfo, OrderLine } from './order';
import { isCustomPrice } from './order';
import type { UploadResult } from './upload';

/**
 * Сервер дээр тухайн боломж хараахан тохируулагдаагүй байна (HTTP 503).
 *
 * Жинхэнэ алдаанаас (сүлжээ, 500) ялгах нь чухал: зургийн сан холбогдоогүй
 * байгаа нь хэрэглэгчийн буруу биш бөгөөд захиалгыг зогсоох шалтгаан ч биш.
 * Ийм үед зураггүйгээр үргэлжлүүлж, дэлгэц дээр тайлбарлана.
 */
export class ServiceUnavailableError extends Error {
  constructor(message = 'Энэ боломж түр ажиллахгүй байна.') {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

export interface QPayOption {
  invoiceId: string;
  qrText: string;
  /** base64 PNG — `data:` угтваргүй. */
  qrImage: string;
  urls: { name: string; description: string; logo: string; link: string }[];
}

export interface BankOption {
  bank: string;
  account: string;
  holder: string;
  /** Хоосон байж болно — тэр үед интерфейст мөр нь гарахгүй. */
  iban: string;
  reference: string;
  amount: number;
}

export interface PaymentDetails {
  amount: number;
  qpay: QPayOption | null;
  bank: BankOption | null;
  /** `null` бол төлбөрийн төлвийг автоматаар хянах боломжгүй. */
  tracking: { date: string; uploadId: string } | null;
}

/** Зургийн төлөв — дэлгэц дээр юу харуулахыг шийднэ. */
export type PhotoStatus = 'none' | 'saved' | 'unavailable';

/** Илгээх оролдлого бүрийн давтагдашгүй түлхүүр. */
export const makeRequestId = (): string =>
  typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export interface OrderStatus {
  status: 'pending' | 'paid';
  paidAt: number | null;
  orderNumber: string;
  createdAt: number;
  amount: number;
  photoCount: number;
  lines: { name: string; qty: number; total: number }[];
  printedAt: number | null;
}

/**
 * Захиалгын төлвийг асууна.
 *
 * Нэвтрэлт нь `uploadId` — 16 тэмдэгт санамсаргүй мөр. Захиалгын дугаарыг
 * таасан ч түүнгүйгээр өөр хүний захиалгыг харах боломжгүй.
 */
export async function fetchOrderStatus(
  orderNumber: string,
  date: string,
  uploadId: string,
): Promise<OrderStatus> {
  const response = await fetch(
    `/api/payment?order=${encodeURIComponent(orderNumber)}` +
      `&date=${encodeURIComponent(date)}&u=${encodeURIComponent(uploadId)}`,
  );

  const body = (await response.json().catch(() => null)) as
    | (Partial<OrderStatus> & { error?: string })
    | null;

  if (!response.ok || !body?.status) {
    throw new Error(body?.error ?? 'Захиалгын мэдээлэл уншигдсангүй.');
  }
  return body as OrderStatus;
}

export interface OrderResult {
  orderNumber: string;
  total: number;
  photos: PhotoStatus;
  payment: PaymentDetails | null;
}

/**
 * Захиалгыг `/api/order` руу илгээнэ.
 *
 * `unitPrice`-ыг зөвхөн тохиролцооны мөрөнд явуулж байгаа шалтгаан: сервер
 * бусад бүх үнийг каталогоос дахин хайж тооцдог тул илгээгээд ч ач холбогдолгүй.
 *
 * `upload` нь `/api/upload` + шууд PUT дууссаны дараах үр дүн — зөвхөн
 * түлхүүрүүд явна, зураг өөрөө энэ хүсэлтэд ОРОХГҮЙ.
 */
export async function submitOrder(
  customer: CustomerInfo,
  lines: readonly OrderLine[],
  options: {
    delivery: boolean;
    vat: boolean;
    upload?: UploadResult | null;
    /**
     * Давхар захиалгаас хамгаалах түлхүүр.
     *
     * Илгээх оролдлого бүрт нэг утга — сүлжээ унаж дахин илгээвэл ИЖИЛ утга
     * явна. Сервер үүнийг санаж, хоёр дахь удаагаа шинэ захиалга үүсгэхийн
     * оронд өмнөх хариугаа буцаана.
     */
    requestId?: string;
  },
): Promise<OrderResult> {
  const response = await fetch('/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...(options.requestId ? { requestId: options.requestId } : {}),
      customer,
      lines: lines.map((line) => ({
        id: line.id,
        qty: line.qty,
        ...(isCustomPrice(line.category) ? { unitPrice: line.unitPrice } : {}),
      })),
      delivery: options.delivery,
      vat: options.vat,
      ...(options.upload
        ? {
            uploadId: options.upload.uploadId,
            date: options.upload.date,
            files: options.upload.files,
          }
        : {}),
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | (Partial<OrderResult> & { error?: string })
    | null;

  if (!response.ok || !body?.orderNumber) {
    throw new Error(body?.error ?? 'Захиалга илгээхэд алдаа гарлаа.');
  }

  return {
    orderNumber: body.orderNumber,
    total: body.total ?? 0,
    photos: body.photos ?? 'none',
    payment: body.payment ?? null,
  };
}
