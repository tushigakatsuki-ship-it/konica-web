import { Link } from 'react-router-dom';
import { CONTACT } from '../data/site';
import LastOrderBanner from '../components/LastOrderBanner';

function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-700">
      {/* Дэвсгэрийн зөөлөн градиент — screenshot дээрх хөх давхарга */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-brand-500 via-brand-700 to-brand-900"
      />
      <div
        aria-hidden
        className="absolute -right-24 top-1/2 size-[520px] -translate-y-1/2 rounded-full bg-brand-400/25 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-28">
        <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/20 sm:px-4 sm:py-2 sm:text-sm">
          <span aria-hidden>🏆</span> Konica Minolta · Мэргэжлийн зураг угаалт
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
            <span aria-hidden>🖨️</span> Хэвлэл
          </Link>
        </div>
      </div>
    </section>
  );
}

const CONTACT_ROWS = [
  { icon: '📍', label: 'Хаяг', value: CONTACT.address, href: null },
  { icon: '📞', label: 'Утас', value: CONTACT.phone, href: CONTACT.phoneHref },
  { icon: '🕐', label: 'Цагийн хуваарь', value: CONTACT.hours, href: null },
  {
    icon: '✉️',
    label: 'И-мэйл',
    value: CONTACT.email,
    href: `mailto:${CONTACT.email}`,
  },
] as const;

function Contact() {
  return (
    <section
      id="kholboo"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
    >
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-3xl font-extrabold leading-tight sm:text-5xl">
            Бидэнтэй
            <br />
            холбоо барих
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-muted sm:mt-6">
            Асуулт, санал хүсэлт байвал бидэнтэй шууд холбоо барина уу. Ажлын цагт
            хурдан хариулна.
          </p>
          <Link to="/hevlel" className="btn-brand mt-6 w-full sm:mt-8 sm:w-auto">
            Хэвлэл захиалах →
          </Link>
        </div>

        <dl className="space-y-4">
          {CONTACT_ROWS.map((row) => (
            <div key={row.label} className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-brand-50 text-xl">
                <span aria-hidden>{row.icon}</span>
              </span>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {row.label}
                </dt>
                <dd className="truncate text-base font-bold">
                  {row.href ? (
                    <a href={row.href} className="text-accent hover:underline">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            </div>
          ))}
        </dl>
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
      <Contact />
    </>
  );
}
