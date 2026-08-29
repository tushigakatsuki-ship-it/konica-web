import { Suspense, lazy, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHero from '../components/PageHero';
import PhotoEditor, { type EditorValue } from '../components/PhotoEditor';
import PhotoLimitNote from '../components/PhotoLimitNote';
import LastOrderBanner from '../components/LastOrderBanner';
import { SERVICES, byCategory, type ServiceCategory, type ServiceItem } from '../data/catalog';
import CategoryGrid, { CATEGORY_HINT } from '../components/CategoryGrid';
import { useLang } from '../state/lang';
import { parsePhotoSize } from '../lib/photoSize';
import { formatCurrency, parsePrice } from '../lib/price';
import { useBasket } from '../state/basket';

import {
  IconAlert,
  IconArrowRight,
  IconChevronDown,
  IconClose,
  IconCrop,
  IconImage,
  IconPalette,
  IconRuler,
} from '../components/icons';
/*
 * Захиалгын цонх нь ЗӨВХӨН сагсанд нэмсний дараа хэрэгтэй тул тусдаа chunk-д
 * үлдээв. Нүүр болон хэвлэлийн хуудас нээхэд татагдахгүй — маягт, төлбөрийн
 * панель, огнооны сонгогч бүгд түүнтэй хамт явдаг тул хэмжээ багагүй.
 */
const Order = lazy(() => import('./Order'));

/**
 * Ангилал сонгосны дараа дээр гарах ХУРДАН табууд.
 *
 * ── Яагаад бүх 12 биш вэ ─────────────────────────────────────────
 *
 * Захиалгын дийлэнх нь эдгээр гурав дээр төвлөрдөг бөгөөд хоорондоо
 * ойрхон сонголтууд юм: «10×15 угаалгах уу, эсвэл засвартай нь уу»,
 * «энэ зураг цээж зурагт тохирох уу». Хүн эдгээрийн хооронд байнга
 * үсэрдэг тул тор руу буцаад дахин сонгуулах нь илүүц алхам.
 *
 * Бусад ангилал (медаль, өргөмжлөл, хулдаас) нь хоорондоо харьцуулагддаггүй
 * тул тэдгээрт орсон хүн «Бүх төрөл» дээр дарж буцна.
 */
const QUICK_TABS: readonly ServiceCategory[] = ['Угаалт', 'Засвар', 'Цээж зураг'];

/**
 * Хэмжээний картан дээр ЖИШЭЭ ЗУРАГ харуулах ангиллууд.
 *
 * Гурвуулаа зурагтай ажилладаг тул «энэ хэмжээнд зураг яаж багтах вэ»
 * гэдэг нь утга учиртай. Медаль, өргөмжлөл, тууз зэрэгт зураг байхгүй
 * тул тэдгээрт цагаан цаас нь илүү зөв — тэнд жишээ зураг тавибал
 * тухайн ажил зурагтай холбоотой мэт төөрөгдүүлнэ.
 */
const PHOTO_TABS: readonly ServiceCategory[] = ['Угаалт', 'Засвар', 'Цээж зураг'];

/**
 * Онлайнаар захиалах БОЛОМЖГҮЙ үйлчилгээ.
 *
 * «Файлаар зураг авах» гэдэг нь дэлгүүрт ирж зураг АВАХУУЛАХ ажил — хэрэглэгч
 * гэрээсээ файл илгээх зүйл байхгүй. Жагсаалтад үлдээвэл сагсанд нэмээд
 * төлбөр төлчихөөд, ажилтан юу хэвлэхээ мэдэхгүй байх болно. Үнийн жагсаалтад
 * нь `/tseej-zurag` хуудсанд хэвээр харагдана.
 */
const IN_BRANCH_ONLY: readonly number[] = [405];

/**
 * Ангилал бүрт хэдэн үйлчилгээ байгаа — цонхон дээр харагдана.
 *
 * Каталог нь build үед тогтмол тул нэг л удаа тоолно.
 */
/**
 * Хүчинтэй ангиллын нэрс — хаягийн параметрийг шалгахад.
 *
 * `?t=` нь хэрэглэгчийн гараас ирж болно. Шалгаагүй утгыг `tab` болгон
 * хүлээж авбал `byCategory` хоосон жагсаалт буцааж, хуудас хоосон харагдана.
 */
/**
 * Ангилал бүрийн «өөр хэмжээ» мөрийн id — `data/catalog.ts` дахьтай ижил.
 *
 * Эдгээр мөр нь ердийн хэмжээний тортой хамт харагдах ЁСГҮЙ: тэдэнд хэмжээ
 * байхгүй тул `parsePhotoSize` `null` буцааж, картан дээр нэр нь бүтнээрээ
 * гарч, үнэ нь `0₮` гэж худал харагдана. Оронд нь тусдаа карт болгож,
 * дарахад хэмжээ асуух самбар нээнэ.
 *
 * ⚠️ Ангилал бүр ӨӨРИЙН мөртэй. Угаалтын 199-ийг засварт дахин ашиглавал
 * ажилтны ажлын мөрөнд «зураг угаалт» гэж очих бөгөөд тэр нь өөр ажил,
 * өөр үнэтэй — хэвлэх гэж бэлдээд зураг засах ажил байсныг хожуу мэдэх нь
 * цаг, цаас хоёуланг алдагдуулна.
 */
const CUSTOM_SIZE_ID: Partial<Record<ServiceCategory, number>> = {
  Угаалт: 199,
  Засвар: 299,
};

const CUSTOM_IDS: readonly number[] = Object.values(CUSTOM_SIZE_ID);

/** Хэвлэх боломжтой хэмжээний хязгаар, сантиметрээр. */
const CUSTOM_MIN_CM = 5;
const CUSTOM_MAX_CM = 120;

const CATEGORY_ORDER: readonly ServiceCategory[] = [
  ...new Set(SERVICES.map((service) => service.category)),
];

const COUNTS: Record<string, number> = SERVICES.reduce<Record<string, number>>(
  (acc, service) => {
    acc[service.category] = (acc[service.category] ?? 0) + 1;
    return acc;
  },
  {},
);

/**
 * Энэ хуудсаас ШУУД захиалдаггүй категориуд.
 *
 * ⚠️ Энэ жагсаалт нь 12 ангиллын тор нэмэгдсэний дараа ЗААВАЛ өргөжсөн.
 *
 * Өмнө нь вэб дээр зөвхөн дөрвөн таб харагддаг байсан (Угаалт, Засвар,
 * Фото цаас, Цээж зураг) тул үлдсэн найман ангилалд хэн ч хүрдэггүй байв.
 * Одоо бүгд ил гарсан бөгөөд шалгахад тэдгээрийн ихэнх нь зургийн
 * урсгалд ОГТ тохирохгүй нь илэрлээ:
 *
 *   • Медаль, Цом, Өргөмжлөл, Тууз — материал, сийлбэрийн эх, хэмжээг
 *     биечлэн тохирдог. «Зураг оруулаад сагсанд нэмэх» нь ажилтанд
 *     хэвлэх юмгүй захиалга үүсгэнэ.
 *   • Хувилах/Скан — үйлчлүүлэгч ХЭВЛЭМЭЛ зургаа авчирдаг. Дижитал файл
 *     байгаа бол скан хийх шаардлагагүй.
 *   • Канон — бичиг баримт хувилах. Эх хувь нь гар дээр байх ёстой.
 *   • Хувцас, Хулдаас — хэмжээ, материалыг тохирно.
 *
 * Эдгээрт үнийг нь ХАРУУЛНА (хүн үнэ мэдэхийг хүсдэг) ч захиалгын товч
 * нээхгүй, оронд нь утсаар холбогдох гарц өгнө.
 */
const WALK_IN: readonly ServiceCategory[] = [
  /*
   * ⚠️ «Цээж зураг» ЭНД БАЙСАН — одоо гарсан.
   *
   * `WALK_IN` дотор байх нь картуудыг `disabled` болгодог: тухайн ангиллыг
   * зөвхөн дэлгүүрт ирж захиална гэсэн үг. Цээж зураг өмнө нь тэнд байсан
   * учир нь өөрийн тусгай (автомат бэлтгэлтэй) урсгалтай байсан.
   *
   * Автомат бэлтгэлийг хассан тул одоо бусад зурагтай ижил: хэрэглэгч файлаа
   * илгээнэ, ажилтан серверээс татаж аваад бэлтгэнэ. Тиймээс картууд
   * идэвхтэй байх ёстой.
   */
  'Хувилах/Скан',
  'Канон',
  'Медаль & Цом',
  'Өргөмжлөл',
  'Дурсгалын үг',
  'Хувцас хэвлэл',
  'Тууз',
  'Хулдаас хэвлэл',
];

/**
 * Эхлээд харуулах хэмжээнүүд — бусдыг «Бүх хэмжээ» товчны цаана нууна.
 *
 * ── Яагаад ХООСОН вэ ────────────────────────────────────────────
 *
 * Анх Угаалт (12 хэмжээ), дараа нь Засвар (7 хэмжээ) энд байсан: бүгдийг
 * зэрэг харуулбал утсан дээр урт жагсаалт болж, хэрэглэгч алийг нь
 * сонгохоо мэдэхгүй зогсоно гэж үзсэн.
 *
 * Практикт ХОЁУЛАНД нь эсрэгээр болсон: зураг угаалгах, засуулах гэж буй
 * хүн ЯГ ямар хэмжээ хэрэгтэйгээ мэдэж ирдэг бөгөөд түүнийгээ жагсаалтаас
 * олохгүй бол «энд байхгүй юм байна» гэж бодоод гардаг. Товч дарж нээх
 * нэмэлт алхам нь тэр эргэлзээг арилгахаас илүү удаан.
 *
 * ⚠️ Тиймээс энэ бүтэц ХООСОН. Ирээдүйд ямар нэг ангилалд 20+ мөр цугларч,
 * жагсаалт үнэхээр уншигдахгүй болвол л дахин бөглөнө — тэр үед ч эхлээд
 * хэмжээгээр нь бүлэглэх нь эрэмбэлэхээс дээр байх магадлалтай.
 */
const POPULAR_IDS: Partial<Record<ServiceCategory, readonly number[]>> = {};

export default function Print() {
  const basket = useBasket();

  const { t, tc, ts } = useLang();

  /*
   * Сонгосон ангилал нь ХАЯГанд амьдарна: `/hevlel?t=Угаалт`.
   *
   * ── Яагаад дотоод төлөв биш вэ ──────────────────────────────────
   *
   * Эхэндээ `useState` байсан. Тэр үед ангилал сонгоход хаяг өөрчлөгддөггүй
   * тул хөтчийн ТҮҮХЭНД цэг үүсэхгүй байв — утасны «буцах» зангаа эсвэл
   * товч дарахад хэрэглэгч торны сонголт руу биш, САЙТААС БҮРМӨСӨН гарч
   * байлаа. Утсан дээр буцах зангаа бол үндсэн навигаци тул энэ нь
   * жирийн эвгүйдэл биш, урсгал таслах алдаа юм.
   *
   * `?t=` параметр нь мөн: хуудсыг сэргээхэд сонголт хэвээр үлдэнэ, ангилал
   * руу шууд линк илгээж болно.
   *
   * ⚠️ Сагсанд `File` объект байдаг ч энэ нь аюулгүй: `BasketProvider` нь
   * `Routes`-оос ГАДНА байрладаг тул хайлтын параметр солигдоход дахин
   * үүсэхгүй — сонгосон зураг хэвээр үлдэнэ.
   */
  const [params, setParams] = useSearchParams();
  const raw = params.get('t');
  const tab: ServiceCategory | null =
    raw && (CATEGORY_ORDER as readonly string[]).includes(raw)
      ? (raw as ServiceCategory)
      : null;

  const setTab = (next: ServiceCategory | null) => {
    setShowAll(false);
    if (next === null) {
      /*
       * Торны сонголт руу буцах нь ШИНЭ цэг биш, өмнөх цэг рүү буцах явдал.
       * `replace` хийвэл товчоор буцахад хуудаснаас гарна — хэрэглэгчийн
       * оюун дахь «буцах» гэсэн үйлдэлтэй зөрчилдөнө.
       */
      setParams({}, { replace: false });
      return;
    }
    setParams({ t: next });
  };

  const [showAll, setShowAll] = useState(false);
  const [editorFor, setEditorFor] = useState<
    { service: ServiceItem; itemKey?: string } | null
  >(null);

  /**
   * Захиалгын цонх нээлттэй эсэх.
   *
   * Хаагаад буцаж болно — хэрэглэгч өөр хэмжээ нэмэхийг хүсвэл сагс нь
   * хэвээр үлдэнэ. Тиймээс хаах нь захиалгыг цуцлахгүй.
   */
  const [orderOpen, setOrderOpen] = useState(false);

  /** Жишээ зураг ирээгүй үед картан дээр цагаан цаас үлдээх. */
  const [washImageFailed, setWashImageFailed] = useState(false);

  /**
   * Зураг оруулах цонх нь ЗАХИАЛГЫН цонхны «Засах»-аас нээгдсэн эсэх.
   *
   * Хэрэглэгч тэндээс ирсэн бол хадгалсны дараа буцаж тэр цонх руугаа
   * ОРОХ ёстой. Үүнгүй бол засвараа хийгээд хоосон хуудсан дээр үлдэж,
   * «Дуусгах» товчийг дахин хайх болно — өөрөө үүсгээгүй алхам нэмэгдэнэ.
   */
  const [editCameFromOrder, setEditCameFromOrder] = useState(false);

  /* Өөрийн хэмжээний самбар — `null` бол хаалттай. */
  const [custom, setCustom] = useState<{ w: string; h: string; error: string } | null>(
    null,
  );

  const all = useMemo(
    () =>
      tab
        ? byCategory(tab).filter(
            (service) =>
              !CUSTOM_IDS.includes(service.id) && !IN_BRANCH_ONLY.includes(service.id),
          )
        : [],
    [tab],
  );
  const walkIn = tab !== null && WALK_IN.includes(tab);
  const idPhoto = tab === 'Цээж зураг';

  /** Түгээмэл хэмжээнүүд — жагсаалтын дарааллаар нь эрэмбэлнэ. */
  const popular = useMemo(() => {
    const ids = tab ? POPULAR_IDS[tab] : undefined;
    if (!ids) return all;
    const found = ids
      .map((id) => all.find((service) => service.id === id))
      .filter((service): service is ServiceItem => Boolean(service));
    return found.length > 0 ? found : all;
  }, [all, tab]);

  const services = showAll ? all : popular;
  const hiddenCount = all.length - popular.length;

  const editing = editorFor?.itemKey
    ? basket.items.find((item) => item.key === editorFor.itemKey)
    : undefined;

  /**
   * Өөрийн хэмжээгээр зураг сонгох цонхыг нээнэ.
   *
   * ── Синтетик үйлчилгээний мөр ─────────────────────────────────
   *
   * Каталогийн мөрийн НЭР дээр хэмжээг наана: `… өөр хэмжээ 25*35`.
   * Ингэснээр гурван зүйл ҮНЭГҮЙ ажиллана:
   *   • `sizeOf` нь нэрнээс хэмжээг таньж, урьдчилсан харагдац болон
   *     хэвлэх файлыг ЗӨВ харьцаагаар тайрна;
   *   • `lib/upload.ts` нь файлын нэр (`01_25x35_2sh_print.jpg`) болон
   *     manifest-ийн `sizeLabel`-д тэр хэмжээг бичнэ — ажилтанд ил гарна;
   *   • сагсан дахь мөр нь хэмжээгээ өөрөө харуулна.
   *
   * `id` нь каталогийнх ХЭВЭЭР (199) тул сервер мөрийг таньж, үнийг нь
   * 0 гэж тооцно. Үнэ нь тохиролцооны тул энэ нь зөв.
   */
  const openCustomEditor = () => {
    if (!custom) return;

    const w = Number(custom.w.replace(',', '.'));
    const h = Number(custom.h.replace(',', '.'));
    const inRange = (n: number) =>
      Number.isFinite(n) && n >= CUSTOM_MIN_CM && n <= CUSTOM_MAX_CM;

    if (!inRange(w) || !inRange(h)) {
      setCustom({
        ...custom,
        error: t('custom.invalid', { min: CUSTOM_MIN_CM, max: CUSTOM_MAX_CM }),
      });
      return;
    }

    const customId = tab ? CUSTOM_SIZE_ID[tab] : undefined;
    const base = SERVICES.find((service) => service.id === customId);
    if (!base) return;

    setCustom(null);
    setEditorFor({ service: { ...base, name: `${base.name} ${w}*${h}` } });
  };

  /**
   * Цонхноос ирсэн зургууд.
   *
   * Шинээр нэмэх үед олон байж болох бөгөөд зураг тус бүр ТУСДАА сагсны мөр
   * болно — ингэснээр хэрэглэгч дараа нь ширхэгийг нь тус тусад нь өөрчилж,
   * аль нэгийг нь ганцаар хасаж чадна. Засварлаж байгаа үед цонх үргэлж яг
   * нэг элемент буцаана.
   */
  const saveFromEditor = (values: EditorValue[]) => {
    if (!editorFor || values.length === 0) return;
    const wasEditing = Boolean(editorFor.itemKey);
    if (editorFor.itemKey) basket.update(editorFor.itemKey, values[0]);
    else for (const value of values) basket.add(editorFor.service, value);
    setEditorFor(null);

    /*
     * ШИНЭ зураг нэмсэн даруйд захиалгын цонх нээгдэнэ.
     *
     * Урьд нь хэрэглэгч сагс руу буцаж, «Захиалга үргэлжлүүлэх» дараад өөр
     * хуудас руу шилждэг байв — гурван алхам. Одоо мэдээллээ шууд бөглөнө.
     *
     * ⚠️ ЗАСВАР хийсэн үед НЭЭХГҮЙ: хэрэглэгч сагсанд байгаа зургаа
     * тохируулж байгаа бөгөөд захиалга өгөх гэж яараагүй. Тэр үед цонх
     * гарах нь ажлыг нь тасалдана.
     */
    if (!wasEditing) setOrderOpen(true);
    else if (editCameFromOrder) {
      /* «Засах»-аас ирсэн бол буцаагаад захиалгын цонхыг нээнэ. */
      setEditCameFromOrder(false);
      setOrderOpen(true);
    }
  };

  return (
    <>
      <PageHero
        eyebrow={t('nav.print')}
        /*
         * `title` нь `revealLines` байхад ХАРАГДАХГҮЙ ч ЗААВАЛ утгатай байна:
         * хэл солиход эсвэл анимаци унтарсан үед эргэж хэрэглэгдэнэ.
         */
        title={t('print.pitch1a')}
        pushSlides={[
          [t('print.pitch1a'), t('print.pitch1b')],
          [t('print.pitch2a'), t('print.pitch2b')],
        ]}
        subtitle={t('print.subtitle')}
      />

      {/*
        * ── 12 ангиллын цонх ──────────────────────────────────────
        *
        * Ангилал сонгоогүй байхад ЭНЭ Л харагдана. Сонгосны дараа торыг
        * нуугаад тухайн ангиллын үнийн жагсаалт руу шилжинэ — хоёуланг нь
        * зэрэг харуулбал утсан дээр хэрэглэгч хаана байгаагаа мэдэхээ болино.
        */}
      {tab === null && <CategoryGrid counts={COUNTS} onPick={setTab} />}

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="mb-6 empty:hidden">
          <LastOrderBanner />
        </div>

        {tab !== null && (
        <>
        {/*
          * Хурдан табууд — утсан дээр хэвтээ гүйлгэнэ.
          *
          * Сонгосон ангилал эдгээрийн дунд байхгүй бол (жишээ нь Медаль)
          * түүнийг ЭХЭНД нь нэмнэ: эс тэгвээс хэрэглэгч хаана байгаагаа
          * табуудаас олж харахгүй, аль нь ч идэвхгүй харагдана.
          */}
        {/*
          * ── Буцах товч ────────────────────────────────────────
          *
          * Табын ГҮЙДЭГ мөрөөс гаргаж, өөрийн мөрөнд байрлуулав. Өмнө нь
          * табуудтай нэг эгнээнд байсан бөгөөд утсан дээр тэр эгнээ 609px
          * өргөнтэй (дэлгэц 390px) тул хэрэглэгч хажуу тийш гүйлгэж байж
          * олдог байв. Буцах нь хамгийн олон дардаг үйлдэл — хайж олох ёсгүй.
          *
          * Хуруунд 46px өндөр — Apple-ийн зөвлөмжийн 44px-ээс дээш.
          */}
        <button
          type="button"
          onClick={() => setTab(null)}
          className="mb-3 inline-flex items-center gap-2 rounded-xl border border-hairline px-4 py-3 text-sm font-semibold text-ink-soft transition-colors hover:border-neon hover:text-neon"
        >
          <IconArrowRight className="size-4 rotate-180" />
          {t('print.allCategories')}
        </button>

        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {(QUICK_TABS.includes(tab) ? QUICK_TABS : [tab, ...QUICK_TABS]).map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setTab(category)}
                  aria-current={category === tab ? 'true' : undefined}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    category === tab
                      ? 'bg-brand-500 text-white'
                      : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
                  }`}
                >
                  {tc(category)}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="min-w-0 text-sm leading-relaxed text-muted">
            {t(CATEGORY_HINT[tab])}
          </p>

          {/*
            * Ажилтны хэрэгсэл рүү орох гарц.
            *
            * Хэвлэлийн цэсний хажууд байрлана — ажилтан өдөржин энэ хуудсан
            * дээр байдаг тул хамгийн ойрхон нь энэ. Үйлчлүүлэгчийн урсгалаас
            * зориуд бүдэг өнгөөр, тусад нь салгасан.
            *
            * Нууц өгөгдөл байхгүй тул хамгаалалт хэрэггүй: хэрэгсэл бүрэн
            * офлайн ажилладаг, сервер рүү юу ч илгээдэггүй.
            */}
          {/*
            * ── ТҮР НУУСАН ────────────────────────────────────────
            *
            * `/tseej-zurag/avtomat` хуудас ХЭВЭЭР ажиллана: зам нь `App.tsx`
            * дээр бүртгэлтэй тул ажилтан хаягаар нь шууд орно. Зөвхөн ЛИНК
            * нь үйлчлүүлэгчийн хуудаснаас түр хасагдсан.
            *
            * Буцааж нэмэхэд доорхийн тайлбарыг авахад хангалттай:
            *
            * <Link
            *   to="/tseej-zurag/avtomat"
            *   className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-semibold text-muted transition-colors hover:text-brand-500"
            * >
            *   <IconCrop className="size-3.5" />
            *   {t('print.staffTool')}
            * </Link>
            */}
        </div>
        </>
        )}

        {/*
          * ── Багана хуваарилалт ────────────────────────────────
          *
          * Ангилал сонгоогүй үед ЗҮҮН багана байхгүй тул хоёр баганын
          * сүлжээ хэрэглэвэл ширээн дээр асар том хоосон талбай үлдэж,
          * сагс ганцаараа сунжирна. Тиймээс тэр үед нэг багана болгож,
          * сагсыг хэмжээгээр нь хязгаарлана.
          */}
        {/*
          * Сагсны хэсэг нь ЗӨВХӨН ангилал сонгосны дараа харагдана.
          *
          * Торны дэлгэц дээр «Таны сонголт» нь хэрэглэгчийн шийдвэрт огт
          * нэмэр болдоггүй — тэр мөчид сонгох зүйл нь ангилал, ширхэг биш.
          * Хоосон сагс харуулах нь зөвхөн доош гүйх зай нэмнэ.
          *
          * Сагсны агуулга алдагдахгүй: `BasketProvider` нь router-аас гадна
          * амьдардаг тул нуугдсан ч зураг, ширхэг хэвээр хадгалагдана. Мөн
          * толгой дээрх сагсны товч хаана ч байсан тоог харуулна.
          */}
        {tab !== null && (
        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Хэмжээний сонголт ─────────────────────────────── */}
          <div>
            {/*
              * ── Цээж зураг — ердийн урсгалаар ─────────────────────
              *
              * Өмнө нь энд `IdPhotoOrder` гэсэн БҮРЭН АВТОМАТ компонент
              * байсан: нүүр илрүүлэх, стандарт хэмжээгээр тайрах, дэвсгэр
              * цайруулах, чанарын хаалт. Санаа нь зөв ч бодит байдалд гурван
              * зүйл нурж байв —
              *
              *   1. Нүүр олдоогүй үед силуэтийн арга `null` биш, БҮТЭН
              *      зургийн хэмжээтэй «нүүр» буцаадаг. Улмаар бүтэн биеийн
              *      зураг «стандарт хангасан» гэж тэмдэглэгдээд сагсанд орно.
              *   2. Байрлалын шалгалтууд тайралтаас нь ГАРГАЖ бодогддог тул
              *      хэзээ ч унаж чадахгүй — хаалт нь чимэглэл болсон.
              *   3. Хэрэглэгч рүү боловсруулсан файл л очиж, ЭХ ФАЙЛ
              *      хаягддаг тул буруу тайралтыг ажилтан засах ч аргагүй.
              *
              * Одоогийн нөхцөлд хамгийн энгийн бөгөөд найдвартай шийдэл нь:
              * хэрэглэгч зүгээр л зургаа оруулна, ажилтан серверээс эх файлыг
              * татаж аваад ӨӨРӨӨ бэлтгэнэ. Ажилтны автомат хэрэгсэл
              * (`/tseej-zurag/avtomat`) хэвээр байгаа — тэнд нүүр илрүүлэлт
              * эргэлзээтэй үед анхааруулга гардаг, хуудсанд олноор нь
              * байрлуулж татдаг.
              */}
            {idPhoto && (
              <div className="mb-4 rounded-lg bg-brand-50 p-4">
                <p className="text-sm font-bold">{t('idPhoto.note.title')}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {t('idPhoto.note.body')}
                </p>
              </div>
            )}

            {walkIn && !idPhoto && (
              <div className="mb-4 rounded-lg bg-brand-50 p-4">
                <p className="text-sm font-bold">{t('walkIn.title')}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {t('walkIn.body')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {services.map((service) => {
                /*
                 * ⚠️ `sizeOf` биш `parsePhotoSize`.
                 *
                 * `sizeOf` нь хэмжээ танигдаагүй үед 10×15-ыг БУЦААДАГ.
                 * Дөрвөн табтай байхад бүх үйлчилгээ хэмжээтэй байсан тул
                 * энэ мэдэгддэггүй байв. Одоо медаль, цом, дурсгалын үг ил
                 * гарсан бөгөөд тэдгээр дээр «10×15 см» гэж худал бичих
                 * байсан. Хэмжээгүй бол үйлчилгээний НЭРИЙГ нь харуулна.
                 */
                const size = parsePhotoSize(service.name);
                /*
                 * Ижил хэмжээтэй ХОЁР үйлчилгээ байвал ялгах тэмдэглэл.
                 *
                 * Цээж зурагт «Цээж зураг 3.5*4.5» (5,000₮) болон «Гадаад
                 * пасспорт файл 3.5*4.5» (6,000₮) хоёр байдаг. Зөвхөн хэмжээг
                 * харуулбал хоёр карт ЯГ ижил бичигтэй, зөвхөн үнээрээ
                 * ялгаатай болно — хэрэглэгч аль нь юу болохыг таах ёстой
                 * болно. Тиймээс давхардсан тохиолдолд нэрнээс хэмжээг хасаад
                 * үлдсэн хэсгийг доор нь жижгээр бичнэ.
                 */
                const ambiguous =
                  size !== null &&
                  services.filter(
                    (other) => parsePhotoSize(other.name)?.label === size.label,
                  ).length > 1;
                const qualifier = ambiguous
                  ? ts(service.name)
                      .replace(/\d+(?:[.,]\d+)?\s*[*x×хХ]\s*\d+(?:[.,]\d+)?/, '')
                      .replace(/\s+/g, ' ')
                      .trim()
                  : '';
                const count = basket.countFor(service.id);
                const price = parsePrice(service.price);

                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => (walkIn ? undefined : setEditorFor({ service }))}
                    disabled={walkIn}
                    className={`${walkIn ? 'card' : 'card-lift'} relative flex flex-col items-center p-3 text-center sm:p-4 ${
                      walkIn
                        ? 'cursor-default'
                        : count > 0
                          ? '!border-brand-500 bg-brand-50/50'
                          : 'hover:bg-brand-50/40'
                    }`}
                  >
                    {count > 0 && (
                      <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand-500 text-[11px] font-black text-white">
                        {count}
                      </span>
                    )}

                    {/*
                     * Зөвхөн хэмжээ, үнэ хоёр. Нягтрал, хугацаа зэрэг дэлгэрэнгүйг
                     * зураг сонгох цонх дотор харуулна — картан дээр байвал 12
                     * картын текст утсан дээр нүд гүйцэхгүй ханан мэт болдог.
                     */}
                    {/* Хэмжээтэй бол цаасны харьцааг зурна; үгүй бол зай эзлэхгүй. */}
                    {size && (
                      /*
                        ⚠️ Хайрцаг нь БҮХ картад ИЖИЛ хэмжээтэй.
                        Урьд нь `fitBox`-оор хэмжээ тус бүрийн харьцаагаар
                        зурдаг байсан тул 6×9 нарийхан, 60×40 өргөн гарч,
                        тор жигд бус харагддаг байв. Одоо зөвхөн ЗУРАГ л
                        харагдана — харьцааг доорх шошго хэлнэ.

                        Жишээ зураг цаана нь БҮДЭГ дэвсгэр болж, хэмжээ/үнэ
                        голд нь давхарлагдана: урьд нь зураг том, үнэ доор
                        бага бичигдсэн тул хамгийн чухал мэдээлэл (хэмжээ,
                        үнэ) хамгийн бага анхаарал татдаг байв.
                      */
                      <span
                        /* Дүрс тайлбарлахгүй ч хэмжээ/үнэ дотор нь унших мэдээлэлтэй. */
                        className="relative block aspect-[6/5] w-full overflow-hidden rounded-md border-2 border-brand-400 bg-white"
                      >
                        {/*
                          * Жишээ зураг — БҮДЭГ дэвсгэр болгож тавьсан.
                          *
                          * ⚠️ Файлын нэр `ugaalt-poster.jpg` — `ugaalt-thumb`
                          * БИШ. Хөгжүүлэлтийн явцад тэр нэрээр ТАЙРСАН
                          * хувилбарууд дарагдаж байсан тул хэрэглэгчийн хөтөч
                          * хуучин тайралтыг кэшнээсээ өгдөг байв. Агуулга нь
                          * үндсээрээ өөрчлөгдсөн зурагт ШИНЭ нэр өгөх нь тэр
                          * ангийн алдааг бүрмөсөн таслана.
                          *
                          * Одоо зөвхөн дэвсгэр тул `object-cover` — тайрагдсан
                          * ч харагдац алдагдахгүй, харин `blur`-ээр текстийг
                          * дарахгүй байх нь чухал. Файл дутуу бол цагаан цаас
                          * үлдэнэ — карт эвдрэхгүй.
                          */}
                        {PHOTO_TABS.includes(tab as ServiceCategory) &&
                          !washImageFailed && (
                            <img
                              src="/category/ugaalt-poster.jpg"
                              alt=""
                              aria-hidden
                              decoding="async"
                              onError={() => setWashImageFailed(true)}
                              className="absolute inset-0 size-full scale-110 object-cover blur-md"
                            />
                          )}

                        {/*
                          * Харанхуйлах давхарга — зургийн агуулгаас үл
                          * хамааран текст үргэлж уншигдахын тулд. Хатуу
                          * хар/цагаан өнгө ЗОРИУДАА: энэ бол интерфейсийн
                          * гадаргуу биш, зургийн дэвсгэр тул `--color-*`
                          * дагах шаардлагагүй (README-ийн QR/цаасны
                          * загвартай адил үл хамаарал).
                          */}
                        <span
                          aria-hidden
                          className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10"
                        />

                        <span className="relative flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
                          <span className="text-base font-black text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] sm:text-lg">
                            {size.label}
                          </span>
                          <span className="text-sm font-bold text-amber-300 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)]">
                            {formatCurrency(price)}
                          </span>
                        </span>
                      </span>
                    )}

                    {!size && (
                      <>
                        <span className="flex min-h-14 items-center text-sm font-bold leading-snug">
                          {ts(service.name)}
                        </span>
                        <span className="mt-0.5 text-sm font-bold text-brand-500">
                          {formatCurrency(price)}
                        </span>
                      </>
                    )}
                    {qualifier && (
                      <span className="mt-0.5 line-clamp-2 w-full text-left text-[11px] leading-tight text-muted">
                        {qualifier}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/*
              * ── Өөрийн хэмжээ ────────────────────────────────────
              *
              * Угаалт БОЛОН засварт. Цээж зурагт хэмжээ нь баримт бичгийн
              * стандартаар тогтдог тул утгагүй — тэнд харуулбал хэрэглэгч
              * стандартаас хазайсан хэмжээ сонгоод, баримтад нь тохирохгүй
              * зураг гартаа авна.
              *
              * Самбарыг картны ДООР нээж байгаа шалтгаан: модал цонх нээвэл
              * хэрэглэгч хоёр давхар цонх (хэмжээ → зураг) дамжина. Энд
              * шууд бөглөөд «Зургаа оруулах» дарахад ганц цонх л нээгдэнэ.
              */}
            {tab !== undefined && CUSTOM_SIZE_ID[tab] !== undefined && (
              <div className="mt-4">
                {custom === null ? (
                  <button
                    type="button"
                    onClick={() => setCustom({ w: '', h: '', error: '' })}
                    className="card-lift flex w-full items-center gap-3 p-4 text-left"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-500">
                      <IconRuler className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{t('custom.card')}</span>
                      <span className="block text-xs text-muted">
                        {t('custom.cardHint')}
                      </span>
                    </span>
                    <IconArrowRight className="ml-auto size-4 shrink-0 text-muted" />
                  </button>
                ) : (
                  <div className="card p-4 sm:p-5">
                    <p className="text-sm font-bold">{t('custom.title')}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                      {t('custom.body')}
                    </p>

                    <div className="mt-3 flex gap-3">
                      {(
                        [
                          ['custom.width', 'w'],
                          ['custom.height', 'h'],
                        ] as const
                      ).map(([label, field]) => (
                        <label key={field} className="flex-1">
                          <span className="block text-xs font-semibold text-muted">
                            {t(label)}
                          </span>
                          <input
                            type="number"
                            inputMode="decimal"
                            min={CUSTOM_MIN_CM}
                            max={CUSTOM_MAX_CM}
                            value={custom[field]}
                            onChange={(e) =>
                              setCustom({ ...custom, [field]: e.target.value, error: '' })
                            }
                            className="field mt-1 w-full"
                          />
                        </label>
                      ))}
                    </div>

                    <p className="mt-1.5 text-[11px] text-muted">
                      {t('custom.range', { min: CUSTOM_MIN_CM, max: CUSTOM_MAX_CM })}
                    </p>

                    {custom.error && (
                      <p className="mt-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
                        {custom.error}
                      </p>
                    )}

                    {/*
                      * Үнийг ЭНД шууд хэлнэ. Сагсанд ороод «0₮» гэж харагдвал
                      * хэрэглэгч үнэгүй гэж ойлгож, дараа нь гайхна.
                      */}
                    <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent-strong">
                      <IconAlert className="mt-px size-4 shrink-0" />
                      {t('custom.priceNote')}
                    </p>

                    <div className="mt-3 flex gap-2">
                      {/*
                        ⚠️ `btn-accent` — `btn-brand` БИШ.

                        Энэ бол захиалгат хэмжээний ҮНДСЭН үйлдэл. Хуудасны
                        бусад бүх үндсэн товч улбар шар (сагсанд нэмэх,
                        захиалга үргэлжлүүлэх, захиалга илгээх) байхад энэ
                        ганцаараа цэнхэр байсан тул хэрэглэгч өөр төрлийн
                        үйлдэл гэж эндүүрч, дараагүй өнгөрөх эрсдэлтэй байв.
                      */}
                      <button
                        type="button"
                        onClick={openCustomEditor}
                        className="btn-accent flex-1 !py-2.5 !text-sm"
                      >
                        <IconImage className="size-4" /> {t('custom.next')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustom(null)}
                        className="btn-outline !py-2.5 !text-sm"
                      >
                        {t('custom.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="btn-outline mt-4 w-full !py-3 !text-sm"
              >
                {showAll ? t('print.showPopular') : `${t('print.showAll')} (${all.length})`}
                <IconChevronDown
                  className={`size-4 transition-transform ${showAll ? 'rotate-180' : ''}`}
                />
              </button>
            )}
          </div>

          {/* ── Сагс ──────────────────────────────────────────── */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-4 sm:p-5">
              <h2 className="text-base font-bold sm:text-lg">
                {t('print.yourPick')}
                {basket.totalQty > 0 && ` (${basket.totalQty})`}
              </h2>

              {basket.items.length === 0 ? (
                <p className="mt-4 rounded-md bg-brand-50 px-4 py-6 text-center text-sm text-muted">
                  {t('print.emptyBasket')}
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {basket.items.map((item) => {
                    const size = parsePhotoSize(item.service.name);
                    const price = parsePrice(item.service.price);
                    return (
                      <li
                        key={item.key}
                        className="flex gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0"
                      >
                        <span
                          className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-sm bg-brand-50 text-lg"
                          aria-hidden
                        >
                          {item.value.preview ? (
                            <img
                              src={item.value.preview}
                              alt=""
                              className="size-full object-cover"
                            />
                          ) : (
                            <IconImage className="size-5 text-brand-400" />
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold">
                              {size ? size.label : ts(item.service.name)}
                            </p>
                            <button
                              type="button"
                              aria-label={t('print.remove')}
                              onClick={() => basket.remove(item.key)}
                              className="-mt-1 shrink-0 px-1 text-muted hover:text-ink"
                            >
                              <IconClose className="size-4" />
                            </button>
                          </div>
                          <p className="truncate text-[11px] text-muted">
                            {item.value.fileName}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <span className="flex items-center rounded-sm border border-hairline">
                              <button
                                type="button"
                                aria-label={t('print.decrease')}
                                onClick={() => basket.setQty(item.key, item.value.qty - 1)}
                                className="px-2.5 py-1 text-sm"
                              >
                                −
                              </button>
                              <span className="w-7 text-center text-xs font-bold">
                                {item.value.qty}
                              </span>
                              <button
                                type="button"
                                aria-label={t('print.increase')}
                                onClick={() => basket.setQty(item.key, item.value.qty + 1)}
                                className="px-2.5 py-1 text-sm"
                              >
                                +
                              </button>
                            </span>
                            {/*
                              * Үнэгүй мөр = тохиролцооны хэмжээ. «0₮» гэж
                              * харуулбал хэрэглэгч үнэгүй гэж ойлгоно.
                              */}
                            <span className="text-sm font-bold">
                              {price > 0
                                ? formatCurrency(price * item.value.qty)
                                : t('custom.byAgreement')}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setEditorFor({ service: item.service, itemKey: item.key })
                            }
                            className="mt-1.5 text-xs font-semibold text-brand-500 hover:underline"
                          >
                            {t('editor.replace')}
                            <IconArrowRight className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 flex justify-between border-t border-hairline pt-4 text-base font-black">
                <span>{t('print.total')}</span>
                <span className="text-brand-500">{formatCurrency(basket.total)}</span>
              </div>

              {/*
                * Зөвхөн тохиролцооны мөр байвал нийт дүн «0₮» гэж гарна.
                * Тайлбаргүй бол хэрэглэгч үнэгүй гэж ойлгоно.
                */}
              {basket.items.some((item) => parsePrice(item.service.price) === 0) && (
                <p className="mt-2 rounded-md bg-accent/10 px-3 py-2 text-[11px] leading-relaxed text-accent-strong">
                  {t('custom.totalNote')}
                </p>
              )}

              {/*
                * Сагсанд зураг байгаа хүнд ЗАХИАЛГА ДУУСГАХ гарц.
                *
                * Урьд нь энэ товч `/zakhialga` руу ШИЛЖДЭГ байсан — тусдаа
                * хуудас, дунд нь нэмэлт алхам. Одоо цонх нээгдэнэ: зураг нэмэх
                * даруйд өөрөө гарч ирдэг болсон тул энэ нь зөвхөн хаачихсан
                * хүнд зориулсан БУЦАХ гарц.
                */}
              <button
                type="button"
                onClick={() => setOrderOpen(true)}
                disabled={basket.items.length === 0}
                className="btn-accent mt-3 hidden w-full lg:inline-flex"
              >
                {t('print.finish')} <IconArrowRight className="size-4" />
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                {t('print.privacy')}
              </p>

              {/*
                Хязгаар, хугацааг САГСНЫ доор хэлнэ — хэрэглэгч зургаа
                нэмж байх үедээ л шийдвэрээ өөрчилж чадна. Захиалгын
                хуудсан дээр анх удаа мэдвэл эргэж буцах хэрэгтэй болно.
              */}
              <PhotoLimitNote
                photos={basket.items.filter((item) => item.value.file).length}
              />
            </div>
          </aside>
        </div>
        )}

        {/*
          * Заавруудыг анхдагчаар хураасан.
          *
          * Хэрэглэгчийн 95% нь зургаа сонгоод л явдаг — тэдэнд эдгээр текст
          * зөвхөн хуудсыг уртасгаж, гүйлгэх зайг нэмдэг. Хэрэгтэй хүн нь дарж
          * нээнэ. `<details>` бол JS-гүй, хайлтын системд ч уншигдана.
          */}
        {/* Заавар нь хэмжээ сонгож байгаа хүнд л хамаатай. */}
        {tab !== null && (
        <details className="mt-10 rounded-lg border border-hairline sm:mt-16">
          <summary className="cursor-pointer px-4 py-3.5 text-sm font-bold marker:text-brand-500">
            {t('tips.summary')}
          </summary>
          <div className="grid gap-4 border-t border-hairline p-4 sm:grid-cols-3">
            {(
              [
                { Icon: IconRuler, title: 'tips.resolution', text: 'tips.resolutionText' },
                { Icon: IconCrop, title: 'tips.crop', text: 'tips.cropText' },
                { Icon: IconPalette, title: 'tips.colour', text: 'tips.colourText' },
              ] as const
            ).map((tip) => (
              <div key={tip.title} className="rounded-md bg-brand-50/60 p-4">
                <tip.Icon className="size-5 text-brand-500" />
                <h3 className="mt-2 text-sm font-bold">{t(tip.title)}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{t(tip.text)}</p>
              </div>
            ))}
          </div>
        </details>
        )}
      </div>

      {/* Утсан дээрх доод мөр */}
      {basket.items.length > 0 && (
        <div
          className="sticky bottom-0 z-40 border-t border-hairline bg-card/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted">
                {basket.totalQty} {t('print.pieces')}
              </p>
              <p className="text-base font-black text-brand-500">
                {formatCurrency(basket.total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOrderOpen(true)}
              className="btn-accent flex-1"
            >
              {t('print.finishShort')} <IconArrowRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {editorFor && (
        <PhotoEditor
          key={editorFor.itemKey ?? editorFor.service.id}
          service={editorFor.service}
          initial={editing?.value}
          editing={Boolean(editorFor.itemKey)}
          /*
           * ⚠️ Сагсны тоог ЗААВАЛ дамжуулна. Үүнгүйгээр хязгаар нь зөвхөн
           * нэг цонхонд үйлчилж, хэрэглэгч цонх бүрт дахин дүүргэж чадна —
           * бүгдийг бэлдэж дуусаад л сервер татгалзана.
           */
          alreadyInBasket={basket.items.filter((item) => item.value.file).length}
          onCancel={() => {
            setEditorFor(null);
            /*
             * Цуцлахад ч буцаана. Хэрэглэгч «Засах» дараад бодлоо өөрчилсөн
             * бол захиалгаа алдах ёсгүй — зүгээр л өмнөх байдалдаа эргэнэ.
             */
            if (editCameFromOrder) {
              setEditCameFromOrder(false);
              setOrderOpen(true);
            }
          }}
          onSave={saveFromEditor}
        />
      )}

      {/*
        * Захиалгын цонх — сагсанд зураг нэмсэн даруйд өөрөө нээгдэнэ.
        *
        * `Suspense`-ийн `fallback` нь ХООСОН: цонхны агуулга нь хэдхэн
        * миллисекундэд ирдэг (мөн `PhotoEditor`-той ажиллах зуур урьдчилж
        * татагдсан байх магадлалтай) тул тэр зуур эргэлдэх дүрс харуулбал
        * анивчилт нэмнэ.
        */}
      {orderOpen && (
        <Suspense fallback={null}>
          <Order
            variant="modal"
            onClose={() => setOrderOpen(false)}
            /*
             * «Засах» — цонхыг хааж, СҮҮЛД нэмсэн зургийн тохируулах цонхыг
             * дахин нээнэ. Хэрэглэгч тэндээс зураг, ширхэг, НӨАТ-аа өөрчилнө.
             *
             * ⚠️ `itemKey` дамжуулах нь ЗААВАЛ: үүнгүй бол `PhotoEditor` нь
             * ШИНЭ мөр гэж үзээд сагсанд хоёр дахь хувийг нэмнэ — хэрэглэгч
             * засах гэж ороод давхардуулсан захиалга үүсгэнэ.
             */
            onEdit={
              basket.items.length > 0
                ? () => {
                    const last = basket.items[basket.items.length - 1];
                    setOrderOpen(false);
                    setEditCameFromOrder(true);
                    setEditorFor({ service: last.service, itemKey: last.key });
                  }
                : undefined
            }
          />
        </Suspense>
      )}
    </>
  );
}
