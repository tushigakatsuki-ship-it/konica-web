import { useState, type ReactElement } from 'react';
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
  IconSparkle,
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
  /**
   * Картан дээр гарах зураг — `public/` доторх зам.
   *
   * Байхгүй бол зөвхөн дүрс (`Icon`) харагдана. Файл нь дутуу байсан ч
   * карт ЭВДРЭХГҮЙ: `onError` дээр дүрс рүү буцна.
   */
  image?: string;
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

/**
 * Тор дээр харагдах БЭЛЭН цонхнууд.
 *
 * Нэгтгэгдсэн хоёр (`MERGED_INTO_WASH`) болон бэлэн бус бүхнийг хассан —
 * сүүлийнх нь доорх `MoreTile` дотор НЭГ хавтан болж нийлнэ.
 */
const GRID_TILES = CATEGORY_TILES.filter(
  (tile) => !MERGED_INTO_WASH.includes(tile.key) && READY.includes(tile.key),
);

/** Нэг хавтан дотор нийлсэн, хараахан бэлэн бус ангиллууд. */
/**
 * «Нэмэлт үйлчилгээ» хавтанг тор дээр харуулах эсэх.
 *
 * `false` — бэлэн бус ангиллуудыг нэгтгэсэн хавтан гарахгүй. Тэдгээр
 * үйлчилгээ бэлэн болоход `true` болгоход л хангалттай.
 */
const SHOW_MORE_TILE = false;

const SOON_TILES = CATEGORY_TILES.filter(
  (tile) => !MERGED_INTO_WASH.includes(tile.key) && !READY.includes(tile.key),
);

const TILE_CLASS =
  'glass-tile flex size-full flex-col items-start p-4 text-left sm:p-5';

/**
 * Нэг хавтан.
 *
 * Тусдаа компонент болгосон ЦОРЫН ГАНЦ шалтгаан: `useTilt` нь элемент
 * тус бүрт өөрийн `ref` шаарддаг hook. React-ийн дүрмээр давталт дотор
 * hook дуудаж болохгүй тул хавтан бүр өөрийн компоненттой байх ёстой.
 */
function Tile({
  tile,
  count,
  onPick,
}: {
  tile: Omit<Tile, 'count'>;
  count: number;
  onPick(category: ServiceCategory): void;
}) {
  const { t, tc } = useLang();

  /*
   * Hook нь дотроо `hover: hover` болон `prefers-reduced-motion`-ыг
   * шалгадаг тул утсан дээр ямар ч сонсогч хавсрахгүй — үнэ төлбөргүй.
   */
  const ref = useTilt<HTMLButtonElement>();

  /*
   * Зураг ирээгүй үед дүрс рүү буцна.
   *
   * ⚠️ Файл байхгүй үед хөтөч эвдэрсэн зургийн дүрс харуулдаг бөгөөд карт
   * гэмтсэн мэт харагдана. Тэрнээс дүрстэй хэвээр байх нь хамаагүй дээр —
   * шинэ ангилал нэмэхэд зургаа хожим тавих нь бодитой.
   */
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button ref={ref} type="button" onClick={() => onPick(tile.key)} className={TILE_CLASS}>
      <span aria-hidden className="glass-tile-sheen" />

      {tile.image && !imageFailed ? (
        /*
          Зурагтай хувилбар — дүрсийг ОРЛОНО.

          `aspect-[4/3]` нь эх зургийн харьцаанд (≈1.2) ойр тул `object-cover`
          бага зэрэг л тайрна. `object-top` нь дээд талын гарчгийг («Digital
          Photo Express») үлдээнэ — тайрагдвал зураг юуны тухай нь ойлгогдохоо
          болино.
        */
        <span className="relative block w-full overflow-hidden rounded-md">
          <img
            src={tile.image}
            alt=""
            /*
             * ⚠️ `loading="lazy"` НЭ. Тор нь хуудасны эхэнд байдаг тул
             * хойшлуулах ашиггүй, харин файл дутуу үед `onError` нь бас
             * хойшилно — карт дээр хоосон дөрвөлжин удаан үлдэнэ.
             */
            decoding="async"
            onError={() => setImageFailed(true)}
            className="block aspect-[4/3] w-full object-cover object-top"
          />
        </span>
      ) : (
        <span className="relative grid size-10 place-items-center rounded-md bg-brand-500/10 text-brand-500">
          <tile.Icon className="size-5" />
        </span>
      )}

      <span className="relative mt-3 block text-sm font-bold leading-snug text-ink sm:text-base">
        {tc(tile.key)}
      </span>
      <span className="relative mt-1 block text-[11px] leading-relaxed text-muted sm:text-xs">
        {t(tile.hint)}
      </span>

      <span className="relative mt-auto block pt-3 text-[11px] font-bold text-brand-500">
        {count} {t('print.itemCount')}
      </span>
    </button>
  );
}

/**
 * Бэлэн бус БҮХ ангиллыг нэгтгэсэн ганц хавтан.
 *
 * ⚠️ Урьд нь ангилал бүр өөрийн «Удахгүй» хавтантай байсан тул тор дээр
 * 10 хавтангийн 9 нь ажиллахгүй байв. Үр дүн нь эсрэгээрээ: цорын ганц
 * БЭЛЭН үйлчилгээ (зураг угаалт) тэдгээрийн дунд төөрч, хуудас «одоохондоо
 * юу ч хийж чадахгүй газар» мэт харагддаг байв.
 *
 * Одоо нэг хавтан, нэрс нь дотор нь жагсаалт болж багтана. Мэдээлэл
 * алдагдахгүй — үйлчлүүлэгч тэр үйлчилгээ энд БАЙХ эсэхийг мэдсэн хэвээр,
 * гэхдээ бэлэн зүйл нь тодрох болов.
 *
 * `<span>` ашиглаж байгаа шалтгаан: идэвхгүй товч нь гар, дэлгэц уншигчид
 * «энд товч байна, гэхдээ ажиллахгүй» гэж мэдэгддэг бөгөөд табаар дамжихад
 * саад болно. Мэдээллийн хавтан бол товч биш.
 */
function MoreTile() {
  const { t, tc } = useLang();

  return (
    <span aria-disabled="true" className={`${TILE_CLASS} cursor-default`}>
      <span aria-hidden className="glass-tile-sheen" />

      <span className="relative grid size-10 place-items-center rounded-md bg-accent/10 text-accent-strong">
        <IconSparkle className="size-5" />
      </span>

      <span className="relative mt-3 block text-sm font-bold leading-snug text-ink-soft sm:text-base">
        {t('print.moreServices')}
      </span>
      <span className="relative mt-1 block text-[11px] leading-relaxed text-muted/80 sm:text-xs">
        {SOON_TILES.map((tile) => tc(tile.key)).join(' · ')}
      </span>

      <span className="relative mt-auto block pt-3 text-[11px] font-bold">
        <span className="rounded-md bg-accent/15 px-2 py-0.5 uppercase tracking-wider text-accent-strong">
          {t('print.veryComingSoon')}
        </span>
      </span>
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
 * **Бэлэн** (`READY`) — ангилал бүр өөрийн хавтантай, дарагдана.
 * **Удахгүй** — БҮГД нэг хавтанд нийлнэ (`MoreTile`), дарагдахгүй.
 *
 * ⚠️ Урьд нь бэлэн бус ангилал бүр өөрийн хавтантай байсан тул тор дээрх
 * 10 хавтангийн 9 нь ажиллахгүй байв. Цорын ганц БЭЛЭН үйлчилгээ нь
 * тэдгээрийн дунд төөрч, хуудас «одоохондоо юу ч хийж чадахгүй газар» мэт
 * харагддаг байсан.
 *
 * Бэлэн бишийг бүрмөсөн НУУХГҮЙ байгаа шалтгаан: үйлчлүүлэгч тэр үйлчилгээ
 * энд байх эсэхийг мэдэх нь дэлгүүр рүү залгах эсэхээ шийдэхэд хэрэгтэй.
 * Тиймээс нэрс нь нэгтгэсэн хавтан дотор жагсаалт болж үлдэнэ.
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
              <Tile tile={tile} count={counts[tile.key] ?? 0} onPick={onPick} />
            </li>
          ))}

          {/*
            ⚠️ «Нэмэлт үйлчилгээ» хавтан НУУГДСАН.

            Бэлэн бус 9 ангиллыг нэг хавтанд нийлүүлж харуулдаг байсныг
            хассан — тор дээр одоо ЗӨВХӨН бэлэн үйлчилгээ үлдэнэ.

            ⚠️ Код нь ХЭВЭЭР үлдэж байна (`MoreTile`, `SOON_TILES`,
            `SHOW_MORE_TILE`). Устгаагүй шалтгаан: эдгээр ангилал бэлэн
            болоход буцааж асаах нь нэг мөр — `SHOW_MORE_TILE`-ыг `true`
            болгоно. Устгачихвал бүтэн хавтан, орчуулга, тайлбарыг дахин
            бичих хэрэгтэй болно.

            Ангиллын үнийн жагсаалт нь `/hevlel?t=<ангилал>` хаягаар
            ХҮРЭЛЦЭЭТЭЙ хэвээр — зөвхөн торны хавтан алга болсон.
          */}
          {SHOW_MORE_TILE && SOON_TILES.length > 0 && (
            <li
              className="tile-3d tile-in"
              style={{ animationDelay: `${GRID_TILES.length * 40}ms` }}
            >
              <MoreTile />
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
