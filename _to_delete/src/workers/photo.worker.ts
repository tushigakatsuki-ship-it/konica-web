/// <reference lib="webworker" />

/**
 * Цээж зураг боловсруулах Worker — нимгэн бүрхүүл.
 *
 * ── Яагаад Worker вэ ─────────────────────────────────────────────
 *
 * Нэг 12MP зураг задлаад дэвсгэр салгахад 300–800ms явдаг. Үндсэн урсгалд
 * хийвэл яг тэр хугацаанд интерфейс БҮРЭН царцана: товч дарагдахгүй,
 * гүйлгэлт зогсоно, явцын заалт ч шинэчлэгдэхгүй. 10 зурагт 8 секунд
 * царцана — ажилтан вэб унасан гэж бодно.
 *
 * ── Логик энд БАЙХГҮЙ ────────────────────────────────────────────
 *
 * Бүтэн дамжлага нь `lib/processPhoto.ts` дотор. Энэ файл зөвхөн мессеж
 * дамжуулна. Ингэснээр Worker дэмждэггүй хөтөч дээр үндсэн урсгалаас яг
 * ижил кодыг дуудна — хоёр зам хооронд зөрөх боломжгүй.
 */

import { processPhoto, type ProcessRequest, type ProcessResponse } from '../lib/processPhoto';

self.onmessage = async (event: MessageEvent<ProcessRequest>) => {
  const request = event.data;
  try {
    (self as unknown as Worker).postMessage(await processPhoto(request));
  } catch (error) {
    console.error('[worker] боловсруулалт амжилтгүй', error);
    (self as unknown as Worker).postMessage({
      id: request.id,
      ok: false,
      reason: 'Боловсруулж чадсангүй',
    } satisfies ProcessResponse);
  }
};
