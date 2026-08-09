import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readReceipt, receiptPath, type OrderReceipt } from '../lib/lastOrder';
import { IconArrowRight } from './icons';

/**
 * «Сүүлийн захиалга» мөр.
 *
 * Захиалгын вэбүүдийн энгийн боловч чухал зуршил: хэрэглэгч линкээ хаячихсан
 * ч сайт руугаа орвол захиалгаа олох ёстой. Ялангуяа төлбөрөө дараа төлөх
 * тохиолдолд — линкгүй бол утсаар залгахаас өөр арга үлдэхгүй.
 *
 * Баримт нь `localStorage`-д, хувийн мэдээлэлгүй (дугаар, огноо, түлхүүр).
 */
export default function LastOrderBanner() {
  /*
   * Эхний зурагдалтад `null` — `localStorage` нь серверийн рендэрт байдаггүй
   * бөгөөд эхний зурагдалтыг саатуулах ч шаардлагагүй.
   */
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);

  useEffect(() => setReceipt(readReceipt()), []);

  if (!receipt) return null;

  return (
    <Link
      to={receiptPath(receipt)}
      className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-brand-50/60 px-4 py-3 text-sm transition-colors hover:bg-brand-50"
    >
      <span className="min-w-0">
        <span className="block text-xs text-muted">Сүүлийн захиалга</span>
        <span className="block truncate font-bold">{receipt.orderNumber}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-500">
        Төлөв харах <IconArrowRight className="size-4" />
      </span>
    </Link>
  );
}
