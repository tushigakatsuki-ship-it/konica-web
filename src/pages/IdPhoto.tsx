import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import SectionTitle from '../components/SectionTitle';
import { byCategory } from '../data/catalog';
import { PRIMARY_PHONE } from '../data/site';
import { formatCurrency, parsePrice } from '../lib/price';
import { IconCheck, IconCrop, IconPhone } from '../components/icons';
import IdPhotoOrder from '../components/IdPhotoOrder';

const REQUIREMENTS = [
  'Цагаан эсвэл цайвар цэнхэр дэвсгэр',
  'Толгойн хувцас, нүдний шил тусгалтай бол авахыг зөвлөнө',
  'Царай бүтэн харагдах, үс нүүрийг халхлаагүй байх',
  'Энгийн, тод өнгийн хувцас — цагаан цамц дэвсгэртэй нийлдэг',
  'Иргэний үнэмлэх 3×4, гадаад паспорт 3.5×4.5 см',
] as const;

export default function IdPhoto() {
  const items = byCategory('Цээж зураг');

  return (
    <>
      <PageHero
        eyebrow="Цээж зураг"
        title="Албан ёсны бичиг баримтын зураг"
        subtitle="Иргэний үнэмлэх, гадаад паспорт, виз, самбарын зураг — стандартын дагуу тэр дороо."
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          <div>
            {/*
              * ── Дараалал: ҮЙЛДЭЛ эхэнд, лавлагаа дараа ──────────────
              *
              * Хүн энэ хуудсанд «цээж зураг хийлгэе» гэсэн зорилготой
              * ирдэг. Үнийн жагсаалтыг эхэнд тавьбал зорилгодоо хүрэхийн
              * тулд эхлээд гүйлгэх шаардлагатай болно.
              *
              * Үнэ нь ЛАВЛАГАА — хэрэгтэй, гэхдээ хоёрдугаарт. Захиалгын
              * хэсэгт сонгосон хэмжээний үнэ аль хэдийн харагддаг тул
              * дийлэнх хүн жагсаалт хүртэл огт хүрэхгүй.
              */}
            <IdPhotoOrder />

            <div className="mt-10">
              <h2 className="text-xl font-bold">Бүх хэмжээний үнэ</h2>
              <ul className="mt-4 divide-y divide-hairline rounded-lg border border-hairline">
                {items.map((service) => (
                  <li
                    key={service.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5 sm:py-4"
                  >
                    <span className="text-sm font-medium">{service.name}</span>
                    <span className="shrink-0 text-sm font-bold text-brand-500">
                      {formatCurrency(parsePrice(service.price))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-10 rounded-lg bg-brand-50 p-5">
              <p className="text-sm font-bold">Эсвэл салбар дээр ирж авахуулна</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                Цаг захиалахгүйгээр ажлын цагт шууд ирээд 5–10 минутад
                авахуулна. Мэргэжлийн гэрэлтүүлэг, дэвсгэртэй.
              </p>
              <a href={PRIMARY_PHONE.href} className="btn-accent mt-4 w-full sm:w-auto">
                <IconPhone className="size-4" /> {PRIMARY_PHONE.label} — залгах
              </a>
            </div>

            {/*
              * Ажилтны хэрэгсэл рүү холбоос.
              *
              * Үйлчлүүлэгчид хэрэггүй ч энэ хуудас нь цээж зурагтай холбоотой
              * цорын ганц газар тул ажилтан эндээс олох нь хамгийн энгийн.
              * Цэсэнд ороогүй, хайлтын системд индексэлдэггүй.
              */}
            <Link
              to="/tseej-zurag/avtomat"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-brand-500"
            >
              <IconCrop className="size-3.5" /> Ажилтны хэрэгсэл — автомат бэлтгэл
            </Link>
          </div>

          <aside className="card h-fit p-5 sm:p-6">
            <h2 className="text-lg font-bold">Шаардлага</h2>
            <ul className="mt-4 space-y-3">
              {REQUIREMENTS.map((req) => (
                <li key={req} className="flex gap-3 text-sm text-ink-soft">
                  <IconCheck className="mt-0.5 size-4 shrink-0 text-ok-strong" />
                  {req}
                </li>
              ))}
            </ul>

            <div className="mt-6 rounded-md bg-brand-50 p-4 text-sm">
              <p className="font-semibold">Цаг захиалгагүй</p>
              <p className="mt-1 text-muted">
                Ажлын цагт шууд ирээд авахуулж болно. 5–10 минутад бэлэн.
              </p>
            </div>
          </aside>
        </div>

        <section className="mt-16 sm:mt-24">
          <SectionTitle title="Хэрхэн явагдах вэ" rule />
          <ol className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
            {[
              { step: '1', title: 'Ирэх', text: 'Цаг захиалахгүйгээр салбар дээр ирнэ.' },
              { step: '2', title: 'Зураг авах', text: 'Мэргэжлийн гэрэлтүүлэг, дэвсгэр.' },
              { step: '3', title: 'Засвар', text: 'Стандарт хэмжээнд тохируулж боловсруулна.' },
              { step: '4', title: 'Хэвлэх', text: 'Konica Minolta дээр хэвлээд гардуулна.' },
            ].map((s) => (
              <li key={s.step} className="rounded-lg bg-brand-50/60 p-6">
                <span className="grid size-9 place-items-center rounded-sm bg-brand-500 text-sm font-black text-white">
                  {s.step}
                </span>
                <h3 className="mt-4 text-base font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
