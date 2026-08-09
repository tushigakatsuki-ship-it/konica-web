import { useEffect, useState } from 'react';
import { HERO_IMAGES } from '../data/site';

/**
 * Нүүр хуудасны дэвсгэр зургууд — автоматаар солигдоно.
 *
 * Зураг угаалгах гэж буй хүнд «энэ газар ямар чанартай ажилладаг вэ» гэдгийг
 * градиент биш, бодит ажлын зураг л хэлж чадна.
 *
 * Гүйцэтгэлийн шийдлүүд:
 *   • ЗӨВХӨН эхний зураг `fetchPriority="high"`-тэй, бусад нь `lazy` —
 *     утасны сүлжээнд 4 зургийг зэрэг татвал анхны зурагдалт удаашрана.
 *   • Солих нь `opacity` шилжилт: layout дахин тооцоологддоггүй тул хямд.
 *   • Таб нуугдсан үед зогсоно — арын табанд таймер эргүүлэх нь батарей иддэг.
 *
 * Хүртээмж:
 *   • `prefers-reduced-motion` тохируулсан хүнд автомат солилт ажиллахгүй —
 *     хөдөлгөөнөөс толгой эргэдэг хүмүүс байдаг.
 *   • Зургууд бүгд `aria-hidden` — чимэглэл учир дэлгэц уншигчид хэрэггүй.
 */

/** Хэдэн секунд тутам солих вэ. Уншиж амжихуйц, гэхдээ уйдахааргүй. */
const INTERVAL_MS = 6000;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (HERO_IMAGES.length < 2 || prefersReducedMotion()) return;

    const timer = setInterval(() => {
      if (document.hidden) return;
      setIndex((current) => (current + 1) % HERO_IMAGES.length);
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  /*
   * Зураг байхгүй бол градиент руу буцна.
   *
   * `public/hero/` хоосон байхад хуудас эвдрэх ёсгүй — шинэ deploy дээр зураг
   * оруулж амжаагүй байх нь бодитой.
   */
  if (HERO_IMAGES.length === 0) {
    return (
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900"
      />
    );
  }

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-brand-900">
      {HERO_IMAGES.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      {/*
       * Харанхуй давхарга — цагаан текстийг ЯМАР Ч зураг дээр уншигдахуйц
       * байлгана. Үүнгүйгээр цайвар зураг дээр гарчиг алга болно.
       */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/85 via-brand-900/70 to-brand-700/60" />

      {HERO_IMAGES.length > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2 sm:bottom-6">
          {HERO_IMAGES.map((image, i) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1} дэх зураг`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
