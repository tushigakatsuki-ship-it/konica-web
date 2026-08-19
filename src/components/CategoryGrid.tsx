import type { ReactElement } from 'react';
import type { ServiceCategory } from '../data/catalog';
import type { StringKey } from '../data/i18n';
import { useTilt } from '../lib/useTilt';
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
 * Каталогийн 12 ангилал БҮРИЙН тайлбар, дүрс.
 *
 * Тор дээр бүгд харагдахгүй (доорх `CATEGORY_TILES`-ыг үз) ч ангилал
 * сонгосны дараа хуудасны дээд талд тайлбар нь гарах тул бүгдийг эндээс
 * авна.
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

/**
 * Зураг угаалтын доор НЭГТГЭГДСЭН ангиллууд.
 *
 * Эдгээр нь тусдаа цонх БОЛОХГҮЙ: гурвуулаа зурагтай ажилладаг, хэрэглэгч
 * хооронд нь байнга үсэрдэг («10×15 угаалгах уу, засвартай нь уу», «энэ
 * зураг цээж зурагт тохирох уу»). Тусдаа цонх болгосон нь торыг гурав
 * дахин уншуулаад, дараа нь дотор нь ижил табууд гардаг байсан.
 *
 * Одоо тор дээр НЭГ л цонх — «Зураг угаалт». Дарахад дотор нь гурван таб
 * гарна (`QUICK_TABS` — `pages/Print.tsx`).
 */
const MERGED_INTO_WASH: readonly ServiceCategory[] = ['Засвар', 'Цээж зураг'];

/**
 * Одоогоор ОНЛАЙНААР бэлэн ангилал.
 *
 * Бусад нь дэлгүүр дээр материал, хэмжээ, загварыг биечлэн тохирдог тул
 * вэб урсгал нь бэлэн биш. Нуухын оронд «Удахгүй» гэж ил харуулна —
 * үйлчлүүлэгч тэр үйлчилгээ энд БАЙХ эсэхийг мэдэх нь дэлгүүр рүү залгах
 * эсэхээ шийдэхэд хэрэгтэй.
 */
const READY: readonly ServiceCategory[] = ['Угаалт'];

/** Тор дээр харагдах цонхнууд — нэгтгэгдсэн хоёрыг хассан. */
const GRID_TILES = CATEGORY_TILES.filter(
  (tile) => !MERGED_INTO_WASH.includes(tile.key),
);

/**
 * Нэг хавтан.
 *
 * Тусдаа компонент болгосон ЦОРЫН ГАНЦ шалтгаан: `useTilt` нь элемент
 * тус бүрт өөрийн `ref` шаарддаг hook. React-ийн дүрмээр давталт дотор
 * hook дуудаж болохгүй тул хавтан бүр өөрийн компоненттой байх ёстой.
 */
function Tile({
  tile,
  ready,
  count,
  onPick,
}: {
  tile: Omit<Tile, 'count'>;
  ready: boolean;
  count: number;
  onPick(category: ServiceCategory): void;
}) {
  const { t, tc } = useLang();

  /*
   * Хазайлт нь зөвхөн ДАРАГДАХ хавтан дээр. Бэлэн бус хавтан хөдөлбөл
   * «энэ ажиллана» гэсэн худал дохио өгнө.
   *
   * Hook нь дотроо `hover: hover` болон `prefers-reduced-motion`-ыг
   * шалгадаг тул утсан дээр ямар ч сонсогч хавсрахгүй — үнэ төлбөргүй.
   */
  const ref = useTilt<HTMLButtonElement>();

  const inner = (
    <>
      <span aria-hidden className="glass-tile-sheen" />

      <span
        className={`relative grid size-10 place-items-center rounded-md ${
          ready ? 'bg-brand-500/10 text-brand-500' : 'bg-brand-500/5 text-muted'
        }`}
      >
        <tile.Icon className="size-5" />
      </span>

      <span
        className={`relative mt-3 block text-sm font-bold leading-snug sm:text-base ${
          ready ? 'text-ink' : 'text-ink-soft'
        }`}
      >
        {tc(tile.key)}
      </span>
      <span
        className={`relative mt-1 block text-[11px] leading-relaxed sm:text-xs ${
          ready ? 'text-muted' : 'text-muted/80'
        }`}
      >
        {t(tile.hint)}
      </span>

      <span className="relative mt-auto block pt-3 text-[11px] font-bold">
        {ready ? (
          <span className="text-brand-500">
            {count} {t('print.itemCount')}
          </span>
        ) : (
          <span className="rounded-md bg-accent/15 px-2 py-0.5 uppercase tracking-wider text-accent-strong">
            {t('home.comingSoon')}
          </span>
        )}
      </span>
    </>
  );

  const shared = 'glass-tile flex size-full flex-col items-start p-4 text-left sm:p-5';

  /*
   * Бэлэн бол `<button>`, эс бөгөөс `<span>`.
   *
   * `disabled` товч биш `<span>` ашиглаж байгаа шалтгаан: идэвхгүй товч нь
   * гар, дэлгэц уншигчид «энд товч байна, гэхдээ ажиллахгүй» гэж мэдэгддэг
   * бөгөөд табаар дамжихад саад болно. Мэдээллийн хавтан бол товч биш.
   */
  return ready ? (
    <button ref={ref} type="button" onClick={() => onPick(tile.key)} className={shared}>
      {inner}
    </button>
  ) : (
    <span aria-disabled="true" className={`${shared} cursor-default opacity-70`}>
      {inner}
    </span>
  );
}

interface Props {
  counts: Record<string, number>;
  onPick(category: ServiceCategory): void;
}

/**
 * Ангиллын шилэн цонхнууд — цэнхэр дэвсгэр дээр.
 *
 * ── Яагаад таб биш вэ ────────────────────────────────────────────
 *
 * Өмнө нь дөрвөн таб байсан бөгөөд үлдсэн найман ангилал вэб дээр ОГТ
 * харагддаггүй байв — медаль, өргөмжлөл, фудболк хэвлэл захиалах гэсэн
 * хүн энд байгааг нь мэдэх аргагүй. Тор нь бүгдийг НЭГ дэлгэцэнд гаргана.
 *
 * ── Хоёр төлөв ───────────────────────────────────────────────────
 *
 * **Бэлэн** (`READY`) — дарагдана, тод харагдана.
 * **Удахгүй** — дарагдахгүй, бүдэг, «Удахгүй» шошготой.
 *
 * Бэлэн бишийг НУУХГҮЙ байгаа шалтгаан: үйлчлүүлэгч тэр үйлчилгээ энд
 * байх эсэхийг мэдэх нь дэлгүүр рүү залгах эсэхээ шийдэхэд хэрэгтэй.
 * Гэхдээ дарагдвал хоосон урсгалд унах тул `<span>`-аар зурна.
 */
export default function CategoryGrid({ counts, onPick }: Props) {
  const { t } = useLang();

  return (
    /*
      * Дэвсгэр нь `category-sky` утилитаас — Tailwind-ийн скандалтаас
      * хамаарахгүй байлгах үүднээс (`src/index.css` доторх тайлбарыг үз).
      */
    <section className="category-sky relative overflow-hidden py-10 sm:py-14">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* Дэвсгэр цагаан болсон тул текст нь ердийн бэхний өнгөтэй. */}
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
          {t('print.categories')}
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
          {t('print.categoriesHint')}
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {GRID_TILES.map((tile, index) => (
            <li
              key={tile.key}
              className="tile-3d tile-in"
              /* Ээлжлэн гарах зөрүү — эхнийх нь шууд, сүүлийнх нь 360ms-д. */
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <Tile
                tile={tile}
                ready={READY.includes(tile.key)}
                count={counts[tile.key] ?? 0}
                onPick={onPick}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
