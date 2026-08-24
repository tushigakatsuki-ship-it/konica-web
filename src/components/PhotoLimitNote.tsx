import { IconAlert, IconImage } from './icons';
import {
  APPROX_MB_PER_PHOTO,
  FAST_MB_PER_MIN,
  MAX_PHOTOS_PER_ORDER,
  SLOW_MB_PER_MIN,
  SLOW_UPLOAD_THRESHOLD,
} from '../lib/limits';
import { useLang } from '../state/lang';

/**
 * Захиалгын хязгаар, илгээх хугацааг ТОДОРХОЙ хэлнэ.
 *
 * ── Яагаад хэрэгтэй вэ ───────────────────────────────────────────
 *
 * Хязгаар нь урьд нь ЗӨВХӨН серверт байсан: хэрэглэгч 40 зураг сонгож,
 * бүгдийг нь бэлдэж (хэдэн арван секунд), дараа нь «60-аас олон файл байж
 * болохгүй» гэсэн алдаа хардаг байв. Тэр мессежийг харсан хүн 60 гэсэн тоо
 * хаанаас гарсныг ойлгох ямар ч арга байхгүй — зураг бүрээс ХОЁР файл
 * гардгийг зөвхөн код л мэднэ.
 *
 * ── Хугацаа яагаад орсон бэ ──────────────────────────────────────
 *
 * 100 зураг ≈ 650MB. Дундаж 4G дээр 40–60 минут. Хэрэглэгч үүнийг УРЬДЧИЛЖ
 * мэдэхгүй бол «гацчихлаа» гэж бодоод табаа хаана — тэр үед аль хэдийн
 * илгээгдсэн 30 зураг ч дэмий болно. Тоо нь зөвшөөрөгдөж байгаа нь тэр нь
 * ухаалаг гэсэн үг биш.
 */

/**
 * Илгээх хугацааны ТӨСӨӨЛӨЛ, минутаар.
 *
 * Хурдны таамаглал нь `limits.ts`-д — тэндээс `PUT_EXPIRES_SEC` ч
 * тооцогддог тул хоёр газар тусад нь тааварлавал гарын үсэг нь илгээлт
 * дуусахаас өмнө хүчингүй болох эрсдэлтэй.
 */
export const uploadMinutes = (photos: number) => {
  const mb = Math.round(photos * APPROX_MB_PER_PHOTO);
  return {
    mb,
    fast: Math.max(1, Math.round(mb / FAST_MB_PER_MIN)),
    slow: Math.max(1, Math.round(mb / SLOW_MB_PER_MIN)),
  };
};

export default function PhotoLimitNote({ photos }: { photos: number }) {
  const { t } = useLang();
  const { mb, fast, slow } = uploadMinutes(photos);
  const heavy = photos >= SLOW_UPLOAD_THRESHOLD;

  return (
    <div className="mt-4 rounded-md border border-hairline bg-sunken p-3">
      <p className="flex items-start gap-2 text-xs font-semibold text-ink-soft">
        <IconImage className="mt-px size-4 shrink-0 text-brand-500" />
        {t('limit.title', { max: MAX_PHOTOS_PER_ORDER })}
      </p>

      {photos > 0 && (
        <p className="mt-1.5 pl-6 text-[11px] leading-relaxed text-muted">
          {t('limit.count', { n: photos, max: MAX_PHOTOS_PER_ORDER, mb })}
        </p>
      )}

      {/*
        Хугацааны анхааруулга нь зөвхөн ХЭРЭГТЭЙ үед гарна. Гурван зурагтай
        захиалгад «40 минут болж магадгүй» гэж бичвэл анхааруулга нь утгаа
        алдаж, хэрэглэгч цаашид уншихаа болино.
      */}
      {heavy && (
        <p className="mt-2 flex items-start gap-2 rounded-sm bg-accent/10 px-2 py-1.5 text-[11px] leading-relaxed text-accent-strong">
          <IconAlert className="mt-px size-3.5 shrink-0" />
          {t('limit.time', { fast, slow })}
        </p>
      )}
    </div>
  );
}
