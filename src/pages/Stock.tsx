import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import StockImage from '../components/StockImage';
import { SERVICES } from '../data/catalog';
import { STOCK, type StockItem } from '../data/stock';
import { formatCurrency, parsePrice, serviceIdFor } from '../lib/price';
import { useLang } from '../state/lang';

/**
 * Бараа материал — тавиур дээр БАЙГАА бүтээгдэхүүн.
 *
 * ── Яагаад тусдаа хуудас вэ ──────────────────────────────────────
 *
 * `/hevlel` нь ҮЙЛЧИЛГЭЭ захиалах урсгал: хэмжээгээ сонгоод зургаа
 * оруулж, ажил хийгдэхийг хүлээнэ. Энэ хуудас нь эсрэгээрээ — хүлээх
 * зүйл байхгүй, зураг ч хэрэггүй, зүгээр л тоогоо хэлээд авна.
 *
 * Хоёрыг нэг торонд хольвол хэрэглэгч аль нь шууд бэлэн, аль нь
 * хүлээлгэтэйг ялгахаа болино.
 *
 * ── Хамгийн чухал дүрэм ──────────────────────────────────────────
 *
 * Үлдэгдлийн тоо бол АМЛАЛТ. Хэрэглэгч нөөцөөс ИЛҮҮ тоо захиалж
 * чадах ёсгүй: захиалаад дараа нь «үнэндээ байхгүй» гэж сонсох нь
 * тоо огт харуулаагүйгээс дор.
 */

const priceFor = (item: StockItem, qty: number) =>
  parsePrice(SERVICES.find((s) => s.id === serviceIdFor(item, qty))?.price);

function StockCard({ item }: { item: StockItem }) {
  const { lang } = useLang();

  const soldOut = item.stock <= 0;
  const from = priceFor(item, 1);

  return (
    <li className="card overflow-hidden">
      <div className="grid gap-4 p-4 sm:grid-cols-[120px_1fr] sm:gap-5 sm:p-5">
        <StockImage item={item} className="aspect-square w-full rounded-lg sm:w-[120px]" />

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-base font-bold">{item.name[lang]}</h2>

            {/*
              * Нөөцийн тэмдэглэгээ — гурван төлөв. «Цөөн үлдсэн» нь
              * яарах шалтгаан биш, ҮНЭН мэдээлэл: 3 ширхэг үлдсэн үед
              * 10 захиалах гэсэн хүн шууд мэдэх ёстой.
              */}
            {soldOut ? (
              <span className="rounded-md bg-muted/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-muted">
                Дууссан
              </span>
            ) : (
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  item.stock <= 5
                    ? 'bg-accent/15 text-accent-strong'
                    : 'bg-brand-50 text-brand-500'
                }`}
              >
                Нөөц: {item.stock} ш
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{item.blurb[lang]}</p>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xl font-black text-brand-500">
              {formatCurrency(from)}
              <span className="ml-1 text-xs font-semibold text-muted">/ ширхэг</span>
            </p>

            {/*
              * ⚠️ Товч БИШ, ХОЛБООС.
              *
              * Тоо ширхэг, авах хэлбэр, НӨАТ, тэмдэглэлийг картан дээр
              * багтаавал карт нь маягт болж хувирна — гурван бараа
              * үзэх гэсэн хүн гурван маягтыг гүйлгэнэ. Сонголтууд
              * дэлгэрэнгүй хуудсанд амьдарна.
              */}
            {soldOut ? (
              <span className="text-xs font-semibold text-muted">Нөөц дуусcан</span>
            ) : (
              <Link to={`/baraa/${item.id}`} className="btn-brand">
                Захиалах
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function Stock() {
  return (
    <>
      <PageHero
        eyebrow="Бараа материал"
        title="Бэлэн байгаа бараа"
        subtitle="Тавиур дээр байгаа бүтээгдэхүүн. Сийлбэр, хүлээлт байхгүй — тоогоо хэлээд авна."
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        <ul className="space-y-4">
          {STOCK.map((item) => (
            <StockCard key={item.id} item={item} />
          ))}
        </ul>

        {/*
          * ⚠️ Үлдэгдэл нь ГАРААР шинэчлэгддэг гэдгийг ил хэлнэ.
          *
          * Тоо харуулах нь амлалт. Хэдэн цагийн зөрүү гарч болохыг
          * урьдчилан хэлэх нь итгэл алдуулахаас хамаагүй дээр.
          */}
        <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
          Үлдэгдлийг өдөр бүр гараар шинэчилдэг тул бага зэрэг зөрж болно.
          Олон ширхэг хэрэгтэй бол урьдчилж залгаарай.
        </p>
      </div>
    </>
  );
}
