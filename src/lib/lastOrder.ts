/**
 * Сүүлийн захиалгын «баримт» — хөтөчид хадгална.
 *
 * Ихэнх захиалгын вэб дээр байдаг зан төлөв: хэрэглэгч хуудсаа хааж, дараа нь
 * буцаж ирээд төлбөрөө төлж чаддаг байх. Бидэнд захиалгын төлөв рүү хүрэх
 * гурван зүйл л хэрэгтэй: дугаар, огноо, `uploadId`.
 *
 * `localStorage` ашиглаж байгаа шалтгаан: төлбөрөө маргааш төлөх нь бүрэн
 * бодитой. Хувийн мэдээлэл хадгалахгүй — линк алдагдвал зөвхөн тухайн
 * захиалгын төлөв, дүн харагдана.
 */

const KEY = 'printmn-last-order';

export interface OrderReceipt {
  orderNumber: string;
  date: string;
  uploadId: string;
  savedAt: number;
}

/** Баримт хэр удаан хадгалагдах вэ — үүнээс хойш хамааралгүй болно. */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const saveReceipt = (receipt: Omit<OrderReceipt, 'savedAt'>): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...receipt, savedAt: Date.now() }));
  } catch {
    // Хувийн горим эсвэл сан дүүрсэн — баримтгүй ч урсгал ажиллана.
  }
};

export const readReceipt = (): OrderReceipt | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const receipt = JSON.parse(raw) as OrderReceipt;
    if (!receipt?.orderNumber || !receipt.uploadId || !receipt.date) return null;
    if (Date.now() - (receipt.savedAt ?? 0) > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return receipt;
  } catch {
    return null;
  }
};

export const clearReceipt = (): void => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // үл хамаарна
  }
};

/** `/zakhialga/PMN-260806-4821?d=2026-08-06&u=…` */
export const receiptPath = (receipt: Pick<OrderReceipt, 'orderNumber' | 'date' | 'uploadId'>): string =>
  `/zakhialga/${encodeURIComponent(receipt.orderNumber)}` +
  `?d=${encodeURIComponent(receipt.date)}&u=${encodeURIComponent(receipt.uploadId)}`;
