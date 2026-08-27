import { useEffect, useRef, useState } from 'react';
import { PROMO } from '../data/site';
import { IconArrowRight, IconFacebook, IconPlay } from './icons';

/**
 * Нүүр хуудасны жижиг бичлэг — ӨӨРӨӨ тоглоно.
 *
 * ── Яагаад Facebook-ийн тоглуулагч БИШ вэ ────────────────────────
 *
 * Хүсэлт нь «тэр хэсэгт нь бичлэг автоматаар тоглогдож байг» байсан.
 * Facebook-ийн шигтгэсэн тоглуулагчаар үүнийг хийх БОЛОМЖГҮЙ:
 *
 *   • Facebook-ийн iframe нь автоматаар эхлэхийг зөвшөөрдөггүй. Хэрэглэгч
 *     заавал дарах ёстой — өөрөөр хэлбэл яг одоогийн холбоостой ижил.
 *   • Зар хаагч өргөтгөл, мөшгөлт хаах тохиргоо түүнийг байнга хаадаг.
 *     Тэр үед хоосон дөрвөлжин үлдэнэ.
 *   • Хуудсанд ОРСОН ХҮН БҮРИЙГ Facebook мэдэх болно — товч дараагүй ч.
 *
 * Оронд нь бичлэгийг ӨӨРСДӨӨ байршуулна. Хөтөч дуугүй бичлэгийг автоматаар
 * тоглуулахыг ЗӨВШӨӨРДӨГ — дэлхийн бүх сайт дэвсгэр бичлэгээ ингэж тавьдаг.
 *
 * ── Хоёр төлөв ───────────────────────────────────────────────────
 *
 * `PROMO.videos` дотор файл байвал → бичлэг тоглоно.
 * Хоосон бол                       → одоогийн холбоос зурвас хэвээр.
 *
 * Ингэснээр файл ирэх хүртэл хуудас эвдрэхгүй, файл нэмэхэд өөрөө асна.
 *
 * ── Олон бичлэг ──────────────────────────────────────────────────
 *
 * Нэгээс олон байвал ЭЭЛЖЛЭН тоглоно — нэг нь дуусахад (`onEnded`) дараагийнх
 * нь эхэлнэ. Ганц байвал `loop`-оор тасралтгүй давтагдана.
 *
 * ⚠️ `loop`-ыг олон бичлэгтэй үед тавьж БОЛОХГҮЙ: тэр үед `onEnded` хэзээ ч
 * дуудагдахгүй тул эхний бичлэг мөнхөд давтагдаж, бусад нь гарахгүй.
 */

export default function PromoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  /** Одоо тоглож буй бичлэгийн дугаар. */
  const [current, setCurrent] = useState(0);

  /*
   * ⚠️ Хөдөлгөөн багасгах тохиргоог ХҮНДЭТГЭНЭ.
   *
   * Толгой эргэх, дотор муухайрах эмгэгтэй хүмүүс үйлдлийн систем дээрээ
   * «хөдөлгөөнийг багасга» гэж тохируулдаг. Автоматаар давтагдах бичлэг нь
   * тэдэнд шууд нөлөөлнө. Тэр үед бичлэг эхлэхгүй — хэрэглэгч өөрөө дарж
   * тоглуулна.
   */
  /*
   * ⚠️ `current`-ээс хамаарна. Бичлэг солигдоход `key` нь `<video>` зангилааг
   * СОЛЬДОГ тул `videoRef` шинэ элемент рүү заана — хамаарлыг хоосон (`[]`)
   * үлдээвэл энэ эффект зөвхөн ЭХНИЙ бичлэг дээр ажиллаж, «хөдөлгөөнийг
   * багасга» гэсэн хүнд 2 дахь бичлэгээс эхлэн автоматаар тоглож эхэлнэ.
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (quiet.matches) {
      video.autoplay = false;
      video.pause();
    }
  }, [current]);

  const clips = PROMO.videos.filter(Boolean);
  const hasVideo = clips.length > 0 && !failed;

  if (!PROMO.url && !hasVideo) return null;

  /* ── Бичлэгтэй хувилбар ──────────────────────────────────────── */
  if (hasVideo) {
    return (
      <a
        href={PROMO.url || undefined}
        target={PROMO.url ? '_blank' : undefined}
        rel="noreferrer"
        className="group mt-5 block w-full max-w-[320px] overflow-hidden rounded-xl border border-white/25 bg-black/20 backdrop-blur-sm sm:mt-6"
      >
        <span className="relative block">
          <video
            /*
             * ⚠️ `key` ЗААВАЛ. Үүнгүй бол React нь ижил `<video>` зангилааг
             * дахин ашиглаж, зөвхөн `src`-ыг сольдог — зарим хөтөч тэр үед
             * шинэ файлыг өөрөө эхлүүлдэггүй тул ээлж солигдоод зогсчихдог.
             * `key` нь зангилааг СОЛИУЛЖ, `autoPlay` дахин ажиллана.
             */
            key={clips[current]}
            ref={videoRef}
            src={clips[current]}
            poster={PROMO.poster || undefined}
            /*
             * Эхний гурав ЗААВАЛ хамт байна — аль нэг нь дутвал автоматаар
             * эхлэхгүй:
             *   muted       — дуутай бичлэгийг ямар ч хөтөч өөрөө эхлүүлдэггүй
             *   playsInline — iPhone дээр эс тэгвээс бүтэн дэлгэц рүү үсэрнэ
             *   autoPlay    — эхлүүлэх хүсэлт
             *
             * `loop` нь ЗӨВХӨН ганц бичлэгтэй үед. Олон байвал `onEnded`-ээр
             * дараагийнх руу шилжинэ — `loop` тавибал тэр хэзээ ч дуудагдахгүй.
             */
            muted
            playsInline
            autoPlay
            loop={clips.length === 1}
            onEnded={
              clips.length > 1
                ? () => setCurrent((i) => (i + 1) % clips.length)
                : undefined
            }
            /*
             * ⚠️ Зөвхөн ЭХНИЙ бичлэгийн мэдээллийг урьдчилж татна. Бусад нь
             * ээлж ирэхэд л татагдана — эс бөгөөс нүүр хуудас нээхэд дөрвүүлээ
             * зэрэг татагдаж, утасны сүлжээнд шууд цохилт болно.
             */
            preload={current === 0 ? 'metadata' : 'none'}
            onError={() => setFailed(true)}
            /*
             * ⚠️ `object-contain` — `object-cover` БИШ.
             *
             * Дэлгүүрийн бичлэгүүд утаснаас ирдэг тул зарим нь БОСОО (9:16),
             * зарим нь хэвтээ (16:9) байна. Зурвас нь 16:9 тул `object-cover`
             * үед босоо бичлэгээс зөвхөн дунд хэсгийн НИМГЭН зурвас үлдэж,
             * юу болж буй нь огт ойлгогдохгүй болно — хэмжсэн: өндрийн 32%.
             *
             * `contain` нь бичлэгийг БҮТНЭЭР харуулна: хэвтээ нь хайрцгийг
             * бүрэн дүүргэнэ, босоо нь голлон сууж хажуугаар нь зурвасын
             * өөрийн бүдэг дэвсгэр харагдана.
             */
            className="block aspect-video w-full object-contain"
          />

          {/* Доод талд нь бичиг — бичлэг дээр шууд тавьбал уншигдахгүй. */}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6">
            <IconFacebook className="size-4 shrink-0 text-white" />
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
              {PROMO.title}
            </span>
            {PROMO.url && <IconArrowRight className="size-3.5 shrink-0 text-white/80" />}
          </span>
        </span>
      </a>
    );
  }

  /* ── Бичлэггүй үед: холбоос зурвас ───────────────────────────── */
  return (
    <a
      href={PROMO.url}
      target="_blank"
      rel="noreferrer"
      className="mt-5 inline-flex max-w-full items-center gap-3 rounded-xl border border-white/25 bg-white/10 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/20 sm:mt-6"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-white/20">
        <IconFacebook className="size-5 text-white" />
        {PROMO.isVideo && (
          <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-accent">
            <IconPlay className="size-2 text-on-accent" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-white">{PROMO.title}</span>
        <span className="flex items-center gap-1 text-xs text-white/75">
          <span className="truncate">{PROMO.cta}</span>
          <IconArrowRight className="size-3.5 shrink-0" />
        </span>
      </span>
    </a>
  );
}
