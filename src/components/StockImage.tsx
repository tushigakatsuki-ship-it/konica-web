import { useState } from 'react';
import { IconAward } from './icons';
import type { StockItem } from '../data/stock';

/**
 * Барааны зураг — файл дутуу байсан ч эвдрэхгүй.
 *
 * ⚠️ Хөтөч нь байхгүй зургийн оронд «эвдэрсэн зураг» дүрс харуулдаг
 * бөгөөд карт бүхэлдээ гэмтсэн мэт харагдана. Дүрс рүү буцах нь
 * хамаагүй дээр: бараа нь зурагтай болтол хуудас хэвийн ажиллана.
 *
 * Энэ нь ялангуяа `.webp` дээр чухал — macOS үсгийн том/жижгийг
 * ялгадаггүй тул локал дээр ажиллаад Vercel (Linux) дээр 404 өгч
 * болзошгүй.
 */
export default function StockImage({
  item,
  className = '',
}: {
  item: StockItem;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!item.image || failed) {
    return (
      <div className={`grid place-items-center bg-sunken ${className}`}>
        <IconAward className="size-1/3 max-h-16 text-muted" />
      </div>
    );
  }

  return (
    <img
      src={item.image}
      alt={item.name.mn}
      decoding="async"
      onError={() => setFailed(true)}
      className={`bg-sunken object-cover ${className}`}
    />
  );
}
