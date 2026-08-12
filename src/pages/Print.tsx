import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHero from '../components/PageHero';
import PhotoEditor, { type EditorValue } from '../components/PhotoEditor';
import LastOrderBanner from '../components/LastOrderBanner';
import { byCategory, type ServiceCategory, type ServiceItem } from '../data/catalog';
import { fitBox, sizeOf } from '../lib/photoSize';
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

const TABS: readonly { key: ServiceCategory; label: string; hint: string }[] = [
  { key: 'Угаалт', label: 'Зураг угаалт', hint: 'Konica Minolta лабораторын өнгө.' },
  { key: 'Засвар', label: 'Засвартай зураг', hint: 'Хуучирсан зургийг сэргээж хэвлэнэ.' },
  { key: 'Хэвлэл', label: 'Фото цаас', hint: '200гр фото цаас — А4, А3.' },
  {
    key: 'Цээж зураг',
    label: 'Цээж зураг',
    hint: 'Иргэний үнэмлэх, паспорт, виз — онлайнаар эсвэл салбар дээр.',
  },
];

/**
 * Энэ хуудсаас ШУУД захиалдаггүй категориуд.
 *
 * Цээж зураг нь ердийн зурагтай өөр урсгалтай: нүүр илрүүлэх, дэвсгэр
 * солих, чанарын хаалт. Тиймээс энд үнийг нь харуулаад, тусгай хуудас
 * руу чиглүүлнэ — тэнд онлайнаар захиалж болно.
 */
const WALK_IN: readonly ServiceCategory[] = ['Цээж зураг'];

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

  const [tab, setTab] = useState<ServiceCategory>('Угаалт');
  const [showAll, setShowAll] = useState(false);
  const [editorFor, setEditorFor] = useState<
    { service: ServiceItem; itemKey?: string } | null
  >(null);

  const all = useMemo(() => byCategory(tab), [tab]);
  const walkIn = WALK_IN.includes(tab);

  /** Түгээмэл хэмжээнүүд — жагсаалтын дарааллаар нь эрэмбэлнэ. */
  const popular = useMemo(() => {
    const ids = POPULAR_IDS[tab];
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

  const saveFromEditor = (value: EditorValue) => {
    if (!editorFor) return;
    if (editorFor.itemKey) basket.update(editorFor.itemKey, value);
    else basket.add(editorFor.service, value);
    setEditorFor(null);
  };

  return (
    <>
      <PageHero
        eyebrow="Хэвлэл"
        title="Хэмжээгээ сонгоод зургаа оруул"
        subtitle="Хэмжээ бүрийн үнэ шууд харагдана. Хэмжээ дээрээ дараад зургаа оруулж, хэдэн ширхэг хэвлэхээ л сонгоно."
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="mb-6 empty:hidden">
          <LastOrderBanner />
        </div>

        {/* Табууд — утсан дээр хэвтээ гүйлгэнэ */}
        <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  t.key === tab
                    ? 'bg-brand-500 text-white'
                    : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <p className="text-sm leading-relaxed text-muted">
            {TABS.find((t) => t.key === tab)?.hint}
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
          <Link
            to="/tseej-zurag/avtomat"
            className="inline-flex shrink-0 items-center gap-1.5 self-start text-xs font-semibold text-muted transition-colors hover:text-brand-500"
          >
            <IconCrop className="size-3.5" />
            Ажилтны хэрэгсэл — цээж зураг автоматаар
          </Link>
        </div>

        <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Хэмжээний сонголт ─────────────────────────────── */}
          <div>
            {/*
              * Цээж зураг нь ӨӨР урсгалтай.
              *
              * Нүүр илрүүлэх, дэвсгэр солих, чанарын хаалт шаардлагатай тул
              * ердийн зургийн картан урсгалд багтахгүй. Энд үнийг нь
              * харуулаад тусгай хуудас руу чиглүүлнэ.
              */}
            {walkIn && (
              <div className="mb-4 rounded-lg bg-brand-50 p-4">
                <p className="text-sm font-bold">Цээж зураг тусдаа хуудастай</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
                  Зургаа оруулахад нүүрийг олж, дэвсгэрийг цагаан болгож,
                  стандартын дагуу тайрна. Хэвлэхэд тохирох эсэхийг шалгаад л
                  сагсанд нэмнэ. Салбар дээр ирж авахуулах ч боломжтой.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/tseej-zurag" className="btn-brand !py-2 !text-xs">
                    Цээж зураг захиалах
                  </Link>
                  <a href={PRIMARY_PHONE.href} className="btn-outline !py-2 !text-xs">
                    <IconPhone className="size-4" /> {PRIMARY_PHONE.label}
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {services.map((service) => {
                const size = sizeOf(service.name);
                const box = fitBox(size, 48, 48);
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
                    <span className="grid h-14 place-items-center">
                      <span
                        aria-hidden
                        style={{ width: box.width, height: box.height }}
                        /* Цаасыг төлөөлнө — харанхуй горимд ч цагаан хэвээр. */
                        className="block rounded-[3px] border-2 border-brand-400 bg-white"
                      />
                    </span>

                    <span className="mt-2 text-base font-bold">{size.label}</span>
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
                {showAll ? 'Түгээмэл хэмжээг харуулах' : `Бүх хэмжээ харах (${all.length})`}
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
                Таны сонголт{basket.totalQty > 0 && ` (${basket.totalQty})`}
              </h2>

              {basket.items.length === 0 ? (
                <p className="mt-4 rounded-md bg-brand-50 px-4 py-6 text-center text-sm text-muted">
                  Хэмжээ дээрээ дарж зургаа оруулна уу.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {basket.items.map((item) => {
                    const size = sizeOf(item.service.name);
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
                            <p className="text-sm font-semibold">{size.label}</p>
                            <button
                              type="button"
                              aria-label="Хасах"
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
                                aria-label="Хорогдуулах"
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
                                aria-label="Нэмэгдүүлэх"
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
                            Зураг солих
                            <IconArrowRight className="size-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 flex justify-between border-t border-hairline pt-4 text-base font-black">
                <span>Нийт</span>
                <span className="text-brand-500">{formatCurrency(basket.total)}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate('/zakhialga')}
                disabled={basket.items.length === 0}
                className="btn-accent mt-3 hidden w-full lg:inline-flex"
              >
                Захиалга үргэлжлүүлэх <IconArrowRight className="size-4" />
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                Зураг таны төхөөрөмжөөс гарахгүй. Захиалга илгээх товч дарсны дараа л
                хамгаалалттай сан руу шилжинэ.
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
        <details className="mt-10 rounded-lg border border-hairline sm:mt-16">
          <summary className="cursor-pointer px-4 py-3.5 text-sm font-bold marker:text-brand-500">
            Анхаарах зүйл — нягтрал, тайралт, өнгө
          </summary>
          <div className="grid gap-4 border-t border-hairline p-4 sm:grid-cols-3">
            {[
              {
                Icon: IconRuler,
                title: 'Нягтрал',
                text: 'Зураг сонгоход тухайн хэмжээнд тохирох пикселийн доод хэмжээг харуулж, багадвал сануулна.',
              },
              {
                Icon: IconCrop,
                title: 'Тайралт',
                text: 'Зураг цаасны харьцаанд төвөөрөө багтана. Урьдчилсан харагдац дээрх зүйл л хэвлэгдэнэ.',
              },
              {
                Icon: IconPalette,
                title: 'Өнгө',
                text: 'sRGB профайл. Хэт харанхуй эсвэл бүдэг зургийг ажилтан утсаар тохирч засаж өгнө.',
              },
            ].map((tip) => (
              <div key={tip.title} className="rounded-md bg-brand-50/60 p-4">
                <tip.Icon className="size-5 text-brand-500" />
                <h3 className="mt-2 text-sm font-bold">{tip.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{tip.text}</p>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* Утсан дээрх доод мөр */}
      {basket.items.length > 0 && (
        <div
          className="sticky bottom-0 z-40 border-t border-hairline bg-card/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-muted">{basket.totalQty} ш · нийт</p>
              <p className="text-base font-black text-brand-500">
                {formatCurrency(basket.total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/zakhialga')}
              className="btn-accent flex-1"
            >
              Үргэлжлүүлэх <IconArrowRight className="size-4" />
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
