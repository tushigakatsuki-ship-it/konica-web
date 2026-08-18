import type { ReactElement } from 'react';
import type { ServiceCategory } from '../data/catalog';
import type { StringKey } from '../data/i18n';
import { useLang } from '../state/lang';
import {
  IconAward,
  IconCrop,
  IconImage,
  IconPalette,
  IconPrinter,
  IconRuler,
  type IconProps,
} from './icons';

/**
 * Ангиллын нэг цонх.
 *
 * `hint` нь орчуулгын түлхүүр — ангиллын НЭР нь `data/i18n.ts` доторх
 * `CATEGORY_EN`-ээс гардаг тул энд давхардуулахгүй.
 */
interface Tile {
  key: ServiceCategory;
  hint: StringKey;
  Icon: (props: IconProps) => ReactElement;
  /** Тухайн ангилалд хэдэн үйлчилгээ байгаа — картан дээр харагдана. */
  count: number;
}

/**
 * Дараалал нь ЗОРИУД каталогийн дараалал биш.
 *
 * Хамгийн их захиалагддаг зүйл эхэндээ байх ёстой: утсан дээр эхний
 * дөрвөн цонх л нэг дэлгэцэнд багтана. Зураг угаалт нь вэбийн гол
 * зорилго тул эхнийх, дараа нь цээж зураг — хоёулаа зурагтай ажилладаг
 * тул зэрэгцээ байх нь логиктой.
 */
export const CATEGORY_TILES: readonly Omit<Tile, 'count'>[] = [
  { key: 'Угаалт', hint: 'cat.wash', Icon: IconImage },
  { key: 'Цээж зураг', hint: 'cat.idPhoto', Icon: IconAward },
  { key: 'Засвар', hint: 'cat.retouch', Icon: IconPalette },
  { key: 'Хэвлэл', hint: 'cat.paper', Icon: IconPrinter },
  { key: 'Хувилах/Скан', hint: 'cat.scan', Icon: IconCrop },
  { key: 'Канон', hint: 'cat.copy', Icon: IconPrinter },
  { key: 'Өргөмжлөл', hint: 'cat.certificate', Icon: IconAward },
  { key: 'Медаль & Цом', hint: 'cat.medal', Icon: IconAward },
  { key: 'Хувцас хэвлэл', hint: 'cat.garment', Icon: IconRuler },
  { key: 'Тууз', hint: 'cat.ribbon', Icon: IconRuler },
  { key: 'Хулдаас хэвлэл', hint: 'cat.banner', Icon: IconPrinter },
  { key: 'Дурсгалын үг', hint: 'cat.memorial', Icon: IconPalette },
];

/**
 * Ангилал → тайлбарын түлхүүр.
 *
 * Ангилал сонгосны дараа хуудасны дээд талд ижил тайлбар харагдана.
 * `CATEGORY_TILES`-аас гаргаж авч байгаа тул хоёр газарт бичих
 * шаардлагагүй — шинэ ангилал нэмэхэд автоматаар дагана.
 */
export const CATEGORY_HINT = Object.fromEntries(
  CATEGORY_TILES.map((tile) => [tile.key, tile.hint]),
) as Record<ServiceCategory, StringKey>;

interface Props {
  counts: Record<string, number>;
  onPick(category: ServiceCategory): void;
}

/**
 * 12 ангиллын шилэн цонх — цэнхэр дэвсгэр дээр.
 *
 * ── Яагаад таб биш вэ ────────────────────────────────────────────
 *
 * Өмнө нь дөрвөн таб байсан бөгөөд үлдсэн найман ангилал вэб дээр ОГТ
 * харагддаггүй байв — медаль, өргөмжлөл, фудболк хэвлэл захиалах гэсэн
 * хүн энд байгааг нь мэдэх аргагүй. Таб нь цөөн зүйлд тохирдог; 12
 * зүйлийг таб болгож хэвтээ гүйлгэвэл сүүлийн хэдийг нь хэн ч олохгүй.
 *
 * Тор нь бүгдийг НЭГ дэлгэцэнд гаргана — дэлгүүр юу хийдгийг эхний
 * харцаар л ойлгуулна.
 */
export default function CategoryGrid({ counts, onPick }: Props) {
  const { t, tc } = useLang();

  return (
    /*
      * Дэвсгэр нь `category-sky` утилитаас — Tailwind-ийн скандалтаас
      * хамаарахгүй байлгах үүднээс (`src/index.css` доторх тайлбарыг үз).
      */
    <section className="category-sky relative overflow-hidden py-10 sm:py-14">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
          {t('print.categories')}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/80">
          {t('print.categoriesHint')}
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {CATEGORY_TILES.map((tile, index) => (
            <li
              key={tile.key}
              className="tile-in"
              /* Ээлжлэн гарах зөрүү — эхнийх нь шууд, сүүлийнх нь 440ms-д. */
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <button
                type="button"
                onClick={() => onPick(tile.key)}
                className="glass-tile flex size-full flex-col items-start p-4 text-left sm:p-5"
              >
                <span aria-hidden className="glass-tile-sheen" />

                <span className="relative grid size-10 place-items-center rounded-md bg-white/20 text-white">
                  <tile.Icon className="size-5" />
                </span>

                <span className="relative mt-3 block text-sm font-bold leading-snug text-white sm:text-base">
                  {tc(tile.key)}
                </span>
                <span className="relative mt-1 block text-[11px] leading-relaxed text-white/75 sm:text-xs">
                  {t(tile.hint)}
                </span>

                <span className="relative mt-auto block pt-3 text-[11px] font-bold text-white/90">
                  {counts[tile.key] ?? 0} {t('print.itemCount')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
