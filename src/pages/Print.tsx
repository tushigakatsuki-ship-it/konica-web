import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHero from '../components/PageHero';
import PhotoEditor, { type EditorValue } from '../components/PhotoEditor';
import LastOrderBanner from '../components/LastOrderBanner';
import { SERVICES, byCategory, type ServiceCategory, type ServiceItem } from '../data/catalog';
import CategoryGrid from '../components/CategoryGrid';
import { useLang } from '../state/lang';
import { fitBox, parsePhotoSize } from '../lib/photoSize';
import { formatCurrency, parsePrice } from '../lib/price';
import { useBasket } from '../state/basket';
import {
  IconArrowRight,
  IconChevronDown,
  IconClose,
  IconCrop,
  IconImage,
  IconPalette,
  IconPhone,
  IconRuler,
} from '../components/icons';
import { PRIMARY_PHONE } from '../data/site';

/**
 * Ангилал бүрт хэдэн үйлчилгээ байгаа — цонхон дээр харагдана.
 *
 * Каталог нь build үед тогтмол тул нэг л удаа тоолно.
 */
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
  'Цээж зураг',
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
 * Хамгийн их захиалагддаг хэмжээнүүд.
 *
 * Угаалтын категорид 12 хэмжээ байдаг бөгөөд бүгдийг зэрэг харуулбал утсан
 * дээр хоёр дэлгэц дүүрэн жагсаалт болж, хэрэглэгч алийг нь сонгохоо мэдэхгүй
 * зогсдог. Ихэнх хүн 10×15 эсвэл 13×18 авдаг тул эхлээд тэднийг харуулж,
 * бусдыг нь «Бүх хэмжээ» товчны цаана нуув.
 */
const POPULAR_IDS: Partial<Record<ServiceCategory, readonly number[]>> = {
  Угаалт: [103, 104, 102, 107], // 10×15, 13×18, 9×12, 20×30
  Засвар: [202, 203, 206], // 10×15, 13×18, 20×30
};

export default function Print() {
  const navigate = useNavigate();
  const basket = useBasket();

  const { t, tc, ts } = useLang();

  /*
   * `null` = 12 цонхны сонголт харагдана. Ангилал сонгосны дараа тухайн
   * ангиллын үнийн жагсаалт руу шилжинэ.
   *
   * Router-ийн зам биш, дотоод төлөв ашиглаж байгаа шалтгаан: сагсанд
   * `File` объект байдаг тул хуудас солигдоход алдагдах эрсдэлтэй.
   * Ангилал хооронд үсрэх нь сонгосон зургийг арчих ёсгүй.
   */
  const [tab, setTab] = useState<ServiceCategory | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [editorFor, setEditorFor] = useState<
    { service: ServiceItem; itemKey?: string } | null
  >(null);

  const all = useMemo(() => (tab ? byCategory(tab) : []), [tab]);
  const walkIn = tab !== null && WALK_IN.includes(tab);
  /* Цээж зураг нь бусад walk-in ангиллаас ялгаатай — өөрийн хуудастай. */
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
   * Цонхноос ирсэн зургууд.
   *
   * Шинээр нэмэх үед олон байж болох бөгөөд зураг тус бүр ТУСДАА сагсны мөр
   * болно — ингэснээр хэрэглэгч дараа нь ширхэгийг нь тус тусад нь өөрчилж,
   * аль нэгийг нь ганцаар хасаж чадна. Засварлаж байгаа үед цонх үргэлж яг
   * нэг элемент буцаана.
   */
  const saveFromEditor = (values: EditorValue[]) => {
    if (!editorFor || values.length === 0) return;
    if (editorFor.itemKey) basket.update(editorFor.itemKey, values[0]);
    else for (const value of values) basket.add(editorFor.service, value);
    setEditorFor(null);
  };

  return (
    <>
      <PageHero
        eyebrow={t('nav.print')}
        title={t('print.title')}
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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            {/* Буцах — торны сонголт руу. */}
            <button
              type="button"
              onClick={() => {
                setTab(null);
                setShowAll(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-neon"
            >
              <IconArrowRight className="size-3.5 rotate-180" />
              {t('print.categories')}
            </button>
            <h2 className="mt-1.5 text-xl font-black tracking-tight sm:text-2xl">
              {tc(tab)}
            </h2>
          </div>

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
          <Link
            to="/tseej-zurag/avtomat"
            className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-semibold text-muted transition-colors hover:text-brand-500"
          >
            <IconCrop className="size-3.5" />
            {t('print.staffTool')}
          </Link>
        </div>
        )}

        {/*
          * ── Багана хуваарилалт ────────────────────────────────
          *
          * Ангилал сонгоогүй үед ЗҮҮН багана байхгүй тул хоёр баганын
          * сүлжээ хэрэглэвэл ширээн дээр асар том хоосон талбай үлдэж,
          * сагс ганцаараа сунжирна. Тиймээс тэр үед нэг багана болгож,
          * сагсыг хэмжээгээр нь хязгаарлана.
          */}
        <div
          className={
            tab === null
              ? 'mt-5 max-w-md'
              : 'mt-5 grid gap-8 lg:grid-cols-[1fr_340px]'
          }
        >
          {/* ── Хэмжээний сонголт ─────────────────────────────── */}
          {tab !== null && (
          <div>
            {/*
              * Дэлгүүр дээр хийгддэг үйлчилгээ.
              *
              * Цээж зураг нь ӨӨР урсгалтай (нүүр илрүүлэх, дэвсгэр солих,
              * чанарын хаалт) тул өөрийн хуудас руу чиглүүлнэ. Бусад нь
              * материал, хэмжээг биечлэн тохирдог тул утас руу чиглүүлнэ.
              */}
            {walkIn && (
              <div className="mb-4 rounded-lg bg-brand-50 p-4">
                <p className="text-sm font-bold">
                  {idPhoto ? t('walkIn.idPhotoTitle') : t('walkIn.title')}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  {idPhoto ? t('walkIn.idPhotoBody') : t('walkIn.body')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {idPhoto && (
                    <Link to="/tseej-zurag" className="btn-brand !py-2 !text-xs">
                      {t('walkIn.idPhotoCta')}
                    </Link>
                  )}
                  <a href={PRIMARY_PHONE.href} className="btn-outline !py-2 !text-xs">
                    <IconPhone className="size-4" /> {PRIMARY_PHONE.label}
                  </a>
                </div>
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
                const box = fitBox(size ?? { w: 10, h: 15, label: '' }, 48, 48);
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
                      <span className="grid h-14 place-items-center">
                        <span
                          aria-hidden
                          style={{ width: box.width, height: box.height }}
                          /* Цаасыг төлөөлнө — харанхуй горимд ч цагаан хэвээр. */
                          className="block rounded-[3px] border-2 border-brand-400 bg-white"
                        />
                      </span>
                    )}

                    <span
                      className={
                        size
                          ? 'mt-2 text-base font-bold'
                          : 'flex min-h-14 items-center text-sm font-bold leading-snug'
                      }
                    >
                      {size ? size.label : ts(service.name)}
                    </span>
                    <span className="mt-0.5 text-sm font-bold text-brand-500">
                      {formatCurrency(price)}
                    </span>
                  </button>
                );
              })}
            </div>

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
          )}

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
                            <span className="text-sm font-bold">
                              {formatCurrency(price * item.value.qty)}
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

              <button
                type="button"
                onClick={() => navigate('/zakhialga')}
                disabled={basket.items.length === 0}
                className="btn-accent mt-3 hidden w-full lg:inline-flex"
              >
                {t('print.continue')} <IconArrowRight className="size-4" />
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                {t('print.privacy')}
              </p>
            </div>
          </aside>
        </div>

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
              onClick={() => navigate('/zakhialga')}
              className="btn-accent flex-1"
            >
              {t('print.continueShort')} <IconArrowRight className="size-4" />
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
          onCancel={() => setEditorFor(null)}
          onSave={saveFromEditor}
        />
      )}
    </>
  );
}
