import type { CustomerInfo, OrderLine } from './order';
import { isCustomPrice } from './order';
import type { UploadResult } from './upload';

export interface OrderResult {
  orderNumber: string;
  total: number;
  /** Зураг R2 руу бүртгэгдсэн эсэх. Зураггүй захиалгад үргэлж `true`. */
  filesSaved: boolean;
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
  options: { delivery: boolean; vat: boolean; upload?: UploadResult | null },
): Promise<OrderResult> {
  const response = await fetch('/api/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
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
    filesSaved: body.filesSaved !== false,
  };
}
