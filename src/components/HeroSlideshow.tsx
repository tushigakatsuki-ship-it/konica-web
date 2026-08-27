import { useEffect, useState } from 'react';
import { HERO_IMAGES } from '../data/site';

/**
 * Нүүр хуудасны дэвсгэр зургууд — автоматаар солигдоно.
 *
 * Зураг угаалгах гэж буй хүнд «энэ газар ямар чанартай ажилладаг вэ» гэдгийг
 * градиент биш, бодит ажлын зураг л хэлж чадна.
 *
 * Гүйцэтгэлийн шийдлүүд:
 *   • ЗӨВХӨН эхний зураг `fetchPriority="high"`-тэй.
 *   • ⚠️ Бусад зургийг эхний зураг ГАРЧ ИРТЭЛ огт үүсгэхгүй. `loading="lazy"`
 *     нь энд ТУСЛАХГҮЙ: дөрвүүлээ дэлгэцийн харагдах хэсэгт (`absolute
 *     inset-0`) байрладаг тул хөтөч бүгдийг нь ШУУД татна. Үр дүнд нь нүүр
 *     хуудас нээхэд дөрвөн зураг зэрэг татагдаж, эхнийх нь удаашрана.
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
 * 2 секунд нь хэт хурдан байв — зураг тогтож амжаагүй байхад дараагийнх нь
 * ирж, дэвсгэр анивчсан мэдрэмж төрүүлдэг. 5 секунд нь зураг бүрийг үнэхээр
 * ХАРАХ зав өгнө.
 *
 * ⚠️ Шилжилтийн хугацаа (700ms) нь мөчлөгийн 14% — зураг тогтох зай элбэг.
 */
const INTERVAL_MS = 5000;

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function HeroSlideshow() {
  const [index, setIndex] = useState(0);

  /**
   * Эхний зураг гарсны дараа л үлдсэнийг DOM-д нэмнэ.
   *
   * Ингэснээр анхны зурагдалт нь ЗӨВХӨН нэг зургийн татахыг хүлээнэ.
   * Үлдсэн нь араас чимээгүй ирнэ — эхний солилт 5 секундын дараа тул
   * амжина.
   */
  const [ready, setReady] = useState(false);

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
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-brand-500">
      {HERO_IMAGES.map((image, i) =>
        i > 0 && !ready ? null : (
          <img
            key={image.src}
            src={image.src}
            alt=""
            onLoad={i === 0 ? () => setReady(true) : undefined}
            /*
             * ⚠️ Алдаа гарсан ч үлдсэнийг нээнэ. Эс тэгвээс эхний зураг
             * ирэхгүй бол дэвсгэр мөнхөд ганц өнгө хэвээр үлдэнэ.
             */
            onError={i === 0 ? () => setReady(true) : undefined}
            fetchPriority={i === 0 ? 'high' : 'low'}
            decoding="async"
            /*
             * ⚠️ Нарийн дэлгэцэнд байрлалыг БАРУУН тийш шилжүүлнэ.
             *
             * Эх зураг 1376×768 (харьцаа 1.79) бөгөөд хэвлэгч нь голоос
             * баруун тийш байрладаг. Утсан дээр хүрээний харьцаа ~0.75 болох
             * тул `object-cover` нь өргөний зөвхөн 42%-ийг үлдээж, ГОЛООС нь
             * тасалдаг — үр дүнд нь хэвлэгчийн зөвхөн зүүн ирмэг харагдаж,
             * зураг нь юуны тухай болох нь ойлгогдохгүй болно.
             *
             * 72% нь тэр цонхыг субъект дээр буулгана. `sm:`-ээс дээш хүрээ
             * өргөн болж бүх зураг багтдаг тул голд нь буцаана.
             */
            className="absolute inset-0 size-full object-cover object-[72%_center] transition-opacity duration-700 sm:object-center"
            style={{ opacity: i === index ? 1 : 0 }}
          />
        ),
      )}

      {/*
       * Цэнхэр халхавч — цагаан текстийг ЯМАР Ч зураг дээр уншигдахуйц
       * байлгана. Үүнгүйгээр цайвар зураг дээр гарчиг алга болно.
       *
       * ⚠️ Өнгө нь ЛОГОНЫ өнгө (`brand-500` = #1a56db) — гурван өөр цэнхрийн
       * холимог БИШ. Өмнө нь `brand-700 → brand-600 → brand-500` гэсэн
       * градиент байсан тул халхавч нь логоноос бага зэрэг өөр, бүдэг хөх
       * рүү хазайдаг байв. Одоо нэг л цэнхэр, зөвхөн тунгалаг нь өөрчлөгдөнө:
       * логоны толгой дээрх дөрвөлжин, дэвсгэр хоёр ЯГ ижил өнгөтэй.
       *
       * Зүүн доод булан нь гүнзгий (85%) — гарчиг, товч тэнд сууна.
       * Баруун дээд нь тунгалаг (35%) — доорх зураг тэндээс харагдана.
       */}
      <div className="absolute inset-0 bg-gradient-to-tr from-brand-500/85 via-brand-500/55 to-brand-500/35" />

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
