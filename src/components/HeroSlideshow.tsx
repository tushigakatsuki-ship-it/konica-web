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

/**
 * Хэдэн секунд тутам солих вэ.
 *
 * 6 секунд нь дэлгүүрийн ажлыг харуулах гэсэн зорилгод удаан байв: ихэнх
 * хүн нүүр хуудсан дээр 10-15 секунд л байдаг тул гурван зургийн НЭГИЙГ л
 * хараад явна. 3.5 секунд нь бүгдийг харах боломж өгнө, гэхдээ анивчсан
 * мэдрэмж төрүүлэхээргүй.
 */
const INTERVAL_MS = 3500;

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
        className="absolute inset-0 bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700"
      />
    );
  }

  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-brand-600">
      {HERO_IMAGES.map((image, i) => (
        <img
          key={image.src}
          src={image.src}
          alt=""
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'low'}
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-opacity duration-700"
          style={{ opacity: i === index ? 1 : 0 }}
        />
      ))}

      {/*
       * Цэнхэр халхавч — цагаан текстийг ЯМАР Ч зураг дээр уншигдахуйц
       * байлгана. Үүнгүйгээр цайвар зураг дээр гарчиг алга болно.
       *
       * ⚠️ Өмнө нь `brand-900/85` байсан нь бараг тунгалаг бус бараан хөх
       * болж, доорх зургийг бүрэн дардаг байв — «ямар чанартай ажилладаг вэ»
       * гэдгийг харуулах гэсэн зорилго нь өөрөө устсан. Одоо ТОД цэнхэр
       * (`brand-600`) дээр илүү тунгалаг: зураг харагдана, текст ч уншигдана.
       *
       * Зүүн доод булан нь бага зэрэг гүнзгий — гарчиг, товч тэнд сууна.
       */}
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-700/85 via-brand-600/55 to-brand-500/35" />

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
