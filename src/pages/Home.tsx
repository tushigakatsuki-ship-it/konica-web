import { Link } from 'react-router-dom';
import { useLang } from '../state/lang';
import LastOrderBanner from '../components/LastOrderBanner';
import HeroSlideshow from '../components/HeroSlideshow';
import { IconAward, IconPrinter } from '../components/icons';

/**
 * Нүүр хуудас — эхний дэлгэц ба хоёр гарц.
 *
 * ── Яагаад доор нь юу ч байхгүй вэ ───────────────────────────────
 *
 * Өмнө нь энд «Юу хийлгэх вэ?» гэсэн гарчигтай хоёр карт байсан бөгөөд
 * тэдгээр нь эхний дэлгэц дээрх товчтой ЯГ ижил хоёр газар руу заадаг
 * байв. Хэрэглэгч нэг зүйлийг хоёр удаа хараад аль нь «жинхэнэ» нь вэ
 * гэж эргэлздэг — сонголт нэмэгдээгүй, зөвхөн гүйлт нэмэгдсэн.
 *
 * Одоо шийдвэр эхний дэлгэц дээрээ дуусна: Хэвлэл эсвэл Бичиг хэрэг.
 * Холбоо барих мэдээлэл хөлд бүтнээрээ байгаа тул давхардуулаагүй.
 */
function Hero() {
  const { t } = useLang();

  return (
    <section className="aurora relative overflow-hidden bg-brand-600">
      <HeroSlideshow />

      {/*
        * Текстийн хэсэг нь зурагны ДЭЭР — `relative` заавал хэрэгтэй.
        * Доод талд цэгүүд сууж байгаа тул `pb` нэмэгдсэн.
        */}
      <div className="relative mx-auto max-w-6xl px-4 py-16 pb-20 sm:px-6 sm:py-28 sm:pb-32">
        <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-sm">
          <IconAward className="size-4 text-accent" /> {t('hero.badge')}
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.08] text-white sm:mt-8 sm:text-6xl lg:text-7xl">
          {t('hero.titleTop')}
          <br />
          <span className="text-accent">{t('hero.titleAccent')}</span>
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:mt-6 sm:text-lg">
          {t('hero.subtitle')}
        </p>

        {/*
          * Хоёр гарц зэрэгцэнэ. Утсан дээр босоо эвхэгдэнэ — 320px өргөнд
          * хоёр товч зэрэгцвэл аль аль нь хуруунд жижиг болно.
          */}
        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center">
          <Link
            to="/hevlel"
            className="btn-accent w-full !py-4 !text-base sm:w-auto sm:!px-10"
          >
            <IconPrinter className="size-5" /> {t('nav.print')}
          </Link>

          {/*
            * «Бичиг хэрэг» нь бэлэн БИШ.
            *
            * `<Link>` биш `<span>`: дарагдвал хэрэглэгч хоосон хуудсанд
            * унана. Нуухын оронд ил харуулж байгаа шалтгаан — үйлчлүүлэгч
            * тэр бараа энд БАЙХ эсэхийг мэдэх нь дэлгүүр рүү залгах эсэхээ
            * шийдэхэд хэрэгтэй.
            *
            * Өнгө нь зориуд бүдэг: хажуугийнхаа амбер товчтой өрсөлдвөл
            * хэрэглэгч эхлээд бэлэн БИШ зүйл рүү гараа сунгана.
            */}
          <span
            aria-disabled="true"
            className="inline-flex w-full cursor-default items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-4 text-base font-bold text-white/75 backdrop-blur-sm sm:w-auto sm:px-8"
          >
            {t('nav.stationery')}
            <span className="rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/90">
              {t('home.comingSoon')}
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      {/*
        * `empty:hidden` — ЗААВАЛ.
        *
        * `LastOrderBanner` нь сүүлийн захиалга байхгүй үед `null` буцаадаг
        * ч энэ тавцан нь дээд зайгаа эзэлсээр байдаг. Доор нь өөр хэсэг
        * байхад мэдэгддэггүй байсан, гэвч нүүр зөвхөн hero болсноор
        * hero-оос хөл хүртэл ~100px хоосон зурвас үлдэж, хуудас дуусаагүй
        * мэт харагдана.
        */}
      <div className="mx-auto max-w-6xl px-4 pt-8 empty:hidden sm:px-6 sm:pt-10">
        <LastOrderBanner />
      </div>
    </>
  );
}
