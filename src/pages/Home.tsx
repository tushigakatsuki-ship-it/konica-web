import { Link } from 'react-router-dom';
import { CONTACT, FAQ, PRIMARY_PHONE } from '../data/site';
import LastOrderBanner from '../components/LastOrderBanner';
import MapEmbed from '../components/MapEmbed';
import HeroSlideshow from '../components/HeroSlideshow';
import {
  IconArrowRight,
  IconAward,
  IconChevronDown,
  IconClock,
  IconMail,
  IconMapPin,
  IconPhone,
  IconPrinter,
} from '../components/icons';

function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-900">
      <HeroSlideshow />

      {/*
        * Текстийн хэсэг нь зурагны ДЭЭР — `relative` заавал хэрэгтэй.
        * Доод талд цэгүүд сууж байгаа тул `pb` нэмэгдсэн.
        */}
      <div className="relative mx-auto max-w-6xl px-4 py-16 pb-20 sm:px-6 sm:py-28 sm:pb-32">
        <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 sm:px-4 sm:py-2 sm:text-sm">
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
 * Түгээмэл асуултууд.
 *
 * Зургийн газарт ирдэг дуудлагын дийлэнх нь эдгээр асуулт. Урьдчилж
 * хариулснаар ажилтны утас чөлөөтэй болж, хэрэглэгч ч шууд шийднэ.
 * `<details>` учир JS-гүй ажиллаж, хайлтын систем ч уншина.
 */
function Faq() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-4 sm:px-6">
      <h2 className="text-2xl font-extrabold sm:text-3xl">Түгээмэл асуулт</h2>
      <div className="mt-5 divide-y divide-hairline rounded-lg border border-hairline">
        {FAQ.map((item) => (
          <details key={item.q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold">
              {item.q}
              <IconChevronDown className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
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
      <div className="pt-12 sm:pt-16">
        <Faq />
      </div>
      <Contact />
    </>
  );
}
