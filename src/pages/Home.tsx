import { Link } from 'react-router-dom';
import { CONTACT, HERO_IMAGES, PRIMARY_PHONE } from '../data/site';
import LastOrderBanner from '../components/LastOrderBanner';
import MapEmbed from '../components/MapEmbed';
import HeroSlideshow from '../components/HeroSlideshow';
import {
  IconArrowRight,
  IconAward,
  IconImage,
  IconClock,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPrinter,
} from '../components/icons';

function Hero() {
  return (
    <section className="aurora relative overflow-hidden bg-brand-900">
      <HeroSlideshow />

      {/*
        * Текстийн хэсэг нь зурагны ДЭЭР — `relative` заавал хэрэгтэй.
        * Доод талд цэгүүд сууж байгаа тул `pb` нэмэгдсэн.
        */}
      <div className="relative mx-auto max-w-6xl px-4 py-16 pb-20 sm:px-6 sm:py-28 sm:pb-32">
        <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 backdrop-blur-sm sm:px-4 sm:py-2 sm:text-sm">
          <IconAward className="size-4 text-accent" /> Konica Minolta · Мэргэжлийн зураг угаалт
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.08] text-white sm:mt-8 sm:text-6xl lg:text-7xl">
          Чанартай хэвлэл,
          <br />
          <span className="text-accent">хурдан үйлчилгээ</span>
        </h1>

        <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:mt-6 sm:text-lg">
          Хэмжээгээ сонгоод зургаа шууд оруулаарай — үнэ нь тэр дороо харагдана.
        </p>

        <div className="mt-8 sm:mt-10">
          <Link
            to="/hevlel"
            className="btn-accent w-full !py-4 !text-base sm:w-auto sm:!px-10"
          >
            <IconPrinter className="size-5" /> Хэвлэл
          </Link>
        </div>

      </div>
    </section>
  );
}

/**
 * Холбоо барих — очих, залгах, бичих гурвыг нэг дор.
 *
 * Хаяг нь Google Maps руу шууд ордог: «энэ хаяг хаана байдаг юм бэ» гэж
 * залгах дуудлагыг үүнээс өөр юу ч бууруулдаггүй.
 */
function Contact() {
  return (
    <section
      id="kholboo"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 sm:py-20"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">
            Бидэнтэй
            <br />
            холбоо барих
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:mt-6">
            Асуулт, санал хүсэлт байвал шууд залгаарай. Ажлын цагт хурдан хариулна.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
            <a href={PRIMARY_PHONE.href} className="btn-accent">
              <IconPhone className="size-4" /> {PRIMARY_PHONE.label}
            </a>
            <Link to="/hevlel" className="btn-outline">
              Хэвлэл захиалах <IconArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <dl className="space-y-5">
          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-500">
              <IconMapPin className="size-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                Хаяг
              </dt>
              <dd className="text-sm leading-relaxed">
                <span className="block font-bold">{CONTACT.address.place}</span>
                <span className="block text-muted">{CONTACT.address.full}</span>
              </dd>
            </div>
          </div>

          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-500">
              <IconPhone className="size-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                Утас
              </dt>
              <dd className="flex flex-wrap gap-x-4 gap-y-1">
                {CONTACT.phones.map((phone) => (
                  <a
                    key={phone.href}
                    href={phone.href}
                    className="text-base font-bold text-accent hover:underline"
                  >
                    {phone.label}
                  </a>
                ))}
              </dd>
            </div>
          </div>

          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-500">
              <IconClock className="size-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                Ажлын цаг
              </dt>
              <dd className="mt-0.5 space-y-0.5 text-sm">
                {CONTACT.hours.map((row) => (
                  <p key={row.days} className="flex gap-2">
                    <span className="w-32 shrink-0 text-muted">{row.days}</span>
                    <span className="font-semibold">{row.time}</span>
                  </p>
                ))}
              </dd>
            </div>
          </div>

          <div className="flex gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-500">
              <IconMail className="size-5" />
            </span>
            <div className="min-w-0">
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                И-мэйл
              </dt>
              <dd className="flex flex-wrap gap-x-4">
                {CONTACT.emails.map((email) => (
                  <a
                    key={email}
                    href={`mailto:${email}`}
                    className="text-sm font-bold text-accent hover:underline"
                  >
                    {email}
                  </a>
                ))}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Газрын зураг — заавал доор, учир нь дарж нээх хүртлээ хөнгөн. */}
      <div className="mt-10">
        <MapEmbed />
      </div>
    </section>
  );
}

/**
 * Bento сүлжээ — үйлчилгээний тойм.
 *
 * ── Яагаад тэнцүү картны эгнээ биш вэ ────────────────────────────
 *
 * Дөрвөн ижил карт нь бүх зүйлийг адил чухал гэж хэлдэг — өөрөөр
 * хэлбэл юу ч чухал биш. Bento нь хэмжээгээр нь эрэмбэ тогтооно:
 * хамгийн том нүд нь вэбийн гол зорилго (зураг хэвлүүлэх), жижгүүд нь
 * туслах.
 *
 * Утсан дээр нэг багана болж эвхэгдэнэ — тэнд хэмжээний эрэмбэ ажиллахгүй
 * тул ДАРААЛАЛ нь эрэмбийг үүрнэ.
 */
function Bento() {
  /*
   * Эхний дэвсгэр зургийг том нүдний хавтас болгож ашиглана. Тусад нь
   * зураг нэмэхгүй байгаа шалтгаан: нэг зургийг хоёр удаа татахгүй,
   * дэлгүүр нэг л газарт зургаа солино.
   */
  const cover = HERO_IMAGES[0]?.src;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
        Юу хэвлүүлэх вэ,{' '}
        <span className="text-muted">та л сонго</span>
      </h2>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        Гэр бүлийн дурсамжаас албан ёсны бичиг баримт хүртэл — нэг лабораторын
        чанартай өнгө.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
        {/* Гол нүд — хоёр мөр эзэлнэ. */}
        <Link
          to="/hevlel"
          className="tilt group lg:col-span-2 lg:row-span-2"
          aria-label="Зураг хэвлүүлэх"
        >
          <span className="tilt-face card-lift relative flex h-full min-h-64 flex-col justify-end overflow-hidden p-6 sm:min-h-72 sm:p-8">
            {/*
              * Дэлгүүрийн бодит ажил — зураг өөрөө хамгийн сайн зар.
              *
              * `HERO_IMAGES` хоосон байвал зураггүй, ердийн картаар
              * харагдана: хоосон `<img>` нь эвдэрсэн дүрс үлдээдэг.
              */}
            {cover && (
              <>
                <img
                  src={cover}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/*
                  * Налуу халхавч — ЗААВАЛ. Зураг нь цайвар ч бараан ч байж
                  * болох тул текстийн ялгаралтыг зөвхөн халхавч л баталгаажуулна.
                  * `from-brand-900` нь брэндийн бараан хөх — саарлаас илүү дулаан.
                  */}
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/70 to-brand-900/10"
                />
              </>
            )}

            <span className={`relative ${cover ? 'text-white' : ''}`}>
              <span className={cover ? 'eyebrow !text-accent' : 'eyebrow'}>
                Зураг угаалт · Хэвлэл
              </span>
              <span className="mt-3 block text-2xl font-black tracking-tight sm:text-3xl">
                Зургаа хэвлүүл
              </span>
              <span
                className={`mt-2 block max-w-sm text-sm leading-relaxed ${
                  cover ? 'text-white/85' : 'text-muted'
                }`}
              >
                6×9-өөс 50×100 см хүртэл 12 хэмжээ. Хэмжээ сонгоод зургаа
                оруулахад үнэ тэр дороо.
              </span>

              <span
                className={`mt-6 inline-flex items-center gap-1.5 text-sm font-bold ${
                  cover ? 'text-accent' : 'text-brand-500'
                }`}
              >
                Захиалах
                <IconArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </span>
            </span>
          </span>
        </Link>

        <Link to="/tseej-zurag" className="tilt group" aria-label="Цээж зураг">
          <span className="tilt-face card-lift flex h-full flex-col justify-between p-5 sm:p-6">
            <span>
              <span className="grid size-10 place-items-center rounded-md bg-brand-50 text-brand-500">
                <IconAward className="size-5" />
              </span>
              <span className="mt-3 block text-base font-bold">Бичиг баримтын зураг</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">
                Иргэний үнэмлэх, паспорт, виз
              </span>
            </span>
            <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-brand-500">
              Дэлгэрэнгүй
              <IconArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
            </span>
          </span>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          <div className="card flex flex-col p-4">
            <span className="grid size-9 place-items-center rounded-md bg-brand-50 text-brand-500">
              <IconPrinter className="size-4.5" />
            </span>
            <span className="mt-2.5 block text-sm font-bold">Засвартай</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
              Мэргэжлийн боловсруулалт
            </span>
          </div>
          <div className="card flex flex-col p-4">
            <span className="grid size-9 place-items-center rounded-md bg-accent/15 text-accent-strong">
              <IconImage className="size-4.5" />
            </span>
            <span className="mt-2.5 block text-sm font-bold">Фото цаас</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
              Гялгар ба матт
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10">
        <LastOrderBanner />
      </div>
      <div className="pt-12 sm:pt-20">
        <Bento />
      </div>
      <Contact />
    </>
  );
}
