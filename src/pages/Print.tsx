import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHero from '../components/PageHero';
import PhotoEditor, { type EditorValue } from '../components/PhotoEditor';
import LastOrderBanner from '../components/LastOrderBanner';
import SectionTitle from '../components/SectionTitle';
import { byCategory, type ServiceCategory, type ServiceItem } from '../data/catalog';
import { fitBox, recommendedPixels, sizeOf } from '../lib/photoSize';
import { formatCurrency, parsePrice } from '../lib/price';
import { useBasket } from '../state/basket';

const TABS: readonly { key: ServiceCategory; label: string; hint: string }[] = [
  {
    key: 'Угаалт',
    label: 'Зураг угаалт',
    hint: 'Konica Minolta лабораторын өнгө. 6×9-өөс 50×100 хүртэлх бүх хэмжээ.',
  },
  {
    key: 'Засвар',
    label: 'Засвартай зураг',
    hint: 'Хуучирсан, урагдсан, бүдгэрсэн зургийг сэргээж, өнгөт болгож хэвлэнэ.',
  },
  {
    key: 'Хэвлэл',
    label: 'Фото цаас',
    hint: '200гр фото цаасан дээрх шууд хэвлэл — А4, А3 хэмжээгээр.',
  },
];

/** Хугацааны товч заавар — томрох тусам удаан. */
const leadTime = (area: number): string => {
  if (area <= 200) return 'Тухайн өдөртөө';
  if (area <= 1200) return '24 цаг';
  return '48 цаг';
};

export default function Print() {
  const navigate = useNavigate();
  const basket = useBasket();

  const [tab, setTab] = useState<ServiceCategory>('Угаалт');
  const [editorFor, setEditorFor] = useState<
    { service: ServiceItem; itemKey?: string } | null
  >(null);

  const services = useMemo(() => byCategory(tab), [tab]);

  const editing = editorFor?.itemKey
    ? basket.items.find((item) => item.key === editorFor.itemKey)
    : undefined;

  const saveFromEditor = (value: EditorValue) => {
    if (!editorFor) return;
    if (editorFor.itemKey) basket.update(editorFor.itemKey, value);
    else basket.add(editorFor.service, value);
    setEditorFor(null);
  };

  const withoutPhoto = basket.items.filter((item) => !item.value.file).length;

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
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {TABS.find((t) => t.key === tab)?.hint}
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_340px]">
          {/* ── Хэмжээний сонголт ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
            {services.map((service) => {
              const size = sizeOf(service.name);
              const box = fitBox(size, 56, 56);
              const count = basket.countFor(service.id);
              const price = parsePrice(service.price);

              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setEditorFor({ service })}
                  className={`card relative flex flex-col items-center p-3 text-center transition-colors sm:p-4 ${
                    count > 0
                      ? 'border-brand-500 bg-brand-50/50'
                      : 'hover:border-brand-200 hover:bg-brand-50/40'
                  }`}
                >
                  {count > 0 && (
                    <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-brand-500 text-[11px] font-black text-white">
                      {count}
                    </span>
                  )}

                  <span className="grid h-16 place-items-center">
                    <span
                      aria-hidden
                      style={{ width: box.width, height: box.height }}
                      className="block rounded-[3px] border-2 border-brand-400 bg-white"
                    />
                  </span>

                  <span className="mt-2 text-sm font-bold">{size.label}</span>
                  <span className="mt-0.5 text-sm font-bold text-brand-500">
                    {formatCurrency(price)}
                  </span>
                  <span className="mt-1 text-[11px] leading-tight text-muted">
                    {recommendedPixels(size)}
                    <br />
                    {leadTime(size.w * size.h)}
                  </span>

                  <span className="mt-2.5 w-full rounded-md bg-accent px-2 py-1.5 text-xs font-bold text-white">
                    Зураг оруулах
                  </span>
                </button>
              );
            })}
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
                            '🖼️'
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
                              ✕
                            </button>
                          </div>
                          <p className="truncate text-[11px] text-muted">
                            {item.value.fileName ?? '⚠️ зураг ороогүй'}
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
                            {item.value.file ? 'Зураг засах →' : 'Зураг нэмэх →'}
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

              {withoutPhoto > 0 && (
                <p className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-strong">
                  {withoutPhoto} мөрөнд зураг ороогүй байна. Зураггүй захиалж болох ч
                  файлаа дараа нь ирүүлэх шаардлагатай.
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate('/zakhialga')}
                disabled={basket.items.length === 0}
                className="btn-accent mt-3 hidden w-full lg:inline-flex"
              >
                Захиалга үргэлжлүүлэх →
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
                Зураг таны төхөөрөмжөөс гарахгүй. Захиалга илгээх товч дарсны дараа л
                хамгаалалттай сан руу шилжинэ.
              </p>
            </div>
          </aside>
        </div>

        {/* Анхаарах зүйл */}
        <section className="mt-16 sm:mt-24">
          <SectionTitle
            title="Анхаарах зүйл"
            subtitle="Хамгийн сайн үр дүнд хүрэхийн тулд"
          />
          <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
            {[
              {
                icon: '📐',
                title: 'Нягтрал',
                text: 'Карт бүр дээр тухайн хэмжээнд тохирох пикселийн доод хэмжээг бичсэн байгаа.',
              },
              {
                icon: '✂️',
                title: 'Тайралт',
                text: 'Зураг цаасны харьцаанд төвөөрөө багтана. Урьдчилсан харагдац дээрх зүйл л хэвлэгдэнэ.',
              },
              {
                icon: '🎨',
                title: 'Өнгө',
                text: 'sRGB профайл. Хэт харанхуй эсвэл бүдэг зургийг ажилтан утсаар тохирч засаж өгнө.',
              },
            ].map((tip) => (
              <div key={tip.title} className="rounded-lg bg-brand-50/60 p-5 sm:p-6">
                <span className="text-2xl" aria-hidden>
                  {tip.icon}
                </span>
                <h3 className="mt-3 text-base font-bold">{tip.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{tip.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Утсан дээрх доод мөр */}
      {basket.items.length > 0 && (
        <div
          className="sticky bottom-0 z-40 border-t border-hairline bg-white/95 px-4 py-3 backdrop-blur lg:hidden"
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
              Үргэлжлүүлэх →
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
