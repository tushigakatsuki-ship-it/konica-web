import { useEffect, useMemo, useRef, useState } from 'react';
import PageHero from '../components/PageHero';
import MedalPreview from '../components/MedalPreview';
import { IconAlert, IconCheck, IconImage } from '../components/icons';
import {
  DEFAULT_ADJUST,
  PHOTO_ZOOM,
  designsFor,
  panBy,
  type MedalDesign,
  type MedalMaterial,
  type PhotoAdjust,
} from '../lib/medal';
import { decodeImage } from '../lib/photoRender';
import { SERVICES } from '../data/catalog';
import { formatCurrency, parsePrice, serviceIdFor } from '../lib/price';
import { useBasket } from '../state/basket';
import { useLang } from '../state/lang';

/**
 * Медаль захиалах.
 *
 * ── Урсгал ───────────────────────────────────────────────────────
 *
 *   1. Материал — шил эсвэл төмөр
 *   2. Загвар — өнгө
 *   3. Бичвэр ба зураг — медалийн дээд нумаар бичигдэж, зураг голд сууна
 *   4. Тоо ширхэг → сагс
 *
 * Урьдчилсан харагдац нь АЛХАМ БҮРТ шинэчлэгдэнэ: медаль бол буцаалтгүй
 * бүтээгдэхүүн тул хэрэглэгч захиалахаасаа өмнө яг юу гарахыг харах ёстой.
 */

type Decoded = CanvasImageSource & { width: number; height: number };

/** Дээд нумын хамгийн урт бичвэр — үүнээс хойш уншигдахаа болино. */
const MAX_TEXT = 40;

/**
 * Доод нумынх нь УРТ: байгууллагын бүтэн нэр тэндүүр явдаг бөгөөд нум нь
 * ~276° эзэлдэг тул дээдээс хоёр дахин их үсэг багтана.
 */
const MAX_SUB_TEXT = 80;

/** Он — «2026» эсвэл «2026 ОН». Түүнээс урт бол он биш. */
const MAX_YEAR = 9;

/**
 * Урьдчилсан харагдацын хэмжээ.
 *
 * ⚠️ Тогтмол болгосон нь санамсаргүй биш: чирэх тооцоо энэ утгаас
 * хамаардаг. Зөвхөн JSX дотор бичвэл хоёр газар зөрөх эрсдэлтэй.
 */
const PREVIEW_SIZE = 280;

/**
 * Тоо ширхэгт тохирсон нэгж үнэ.
 *
 * ⚠️ `design.serviceId`-г ШУУД хэрэглэж болохгүй: шилэн медаль олноор
 * хямддаг (`bulk`). Хямдралыг үл тоомсорловол 50 ширхэгт 125,000₮ гэж
 * харуулна — бодит үнэ нь 75,000₮.
 */
const serviceFor = (design: MedalDesign, qty: number) =>
  SERVICES.find((s) => s.id === serviceIdFor(design, qty));

const priceOf = (design: MedalDesign, qty: number) =>
  parsePrice(serviceFor(design, qty)?.price);

export default function Medal() {
  const basket = useBasket();
  const { lang } = useLang();

  const [material, setMaterial] = useState<MedalMaterial>('metal');
  const designs = useMemo(() => designsFor(material), [material]);
  const [designId, setDesignId] = useState(designs[0]?.id ?? '');

  const [text, setText] = useState('');
  /** Доод нумын бичвэр — байгууллагын бүтэн нэр. */
  const [subText, setSubText] = useState('');
  /** Он — голын зургийн доор, хэвтээ, улаанаар. */
  const [year, setYear] = useState('');
  const [qty, setQty] = useState(10);
  const [photo, setPhoto] = useState<Decoded | null>(null);
  /** Голын зургийн томруулалт, шилжилт. */
  const [adjust, setAdjust] = useState<PhotoAdjust>(DEFAULT_ADJUST);
  const [fileName, setFileName] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  /** Задалсан зургийн санах ойг чөлөөлөх функц. */
  const closeRef = useRef<(() => void) | null>(null);
  useEffect(() => () => closeRef.current?.(), []);

  /* Материал солиход тухайн материалын эхний загвар руу шилжинэ. */
  useEffect(() => {
    if (!designs.some((d) => d.id === designId)) setDesignId(designs[0]?.id ?? '');
  }, [designs, designId]);

  const design = designs.find((d) => d.id === designId) ?? designs[0];
  const unit = design ? priceOf(design, qty) : 0;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setProblem(null);
    setAdded(false);

    try {
      const decoded = await decodeImage(file);
      closeRef.current?.();
      closeRef.current = decoded.close;
      setPhoto(decoded.source as Decoded);
      setFileName(file.name);
      /*
       * Шинэ зурагт хуучин тохируулга утгагүй: өмнөх зургийн төвд
       * тааруулсан шилжилт нь өөр харьцаатай зурагт огт өөр хэсгийг
       * харуулна. Хэрэглэгч «яагаад ингэж таслав» гэж гайхна.
       */
      setAdjust(DEFAULT_ADJUST);
    } catch (error) {
      /*
       * Техникийн мессежийг хэрэглэгчид харуулахгүй — юу хийхээ
       * хэлдэггүй. Дэлгэрэнгүйг консолд үлдээнэ.
       */
      console.error('[медаль] зураг задлахад алдаа', error);
      setProblem('Зургийг уншиж чадсангүй. Өөр зураг сонгоно уу.');
    }
  };

  /* ── Голын зургийг чирж байрлуулах ─────────────────────────── */

  const drag = useRef<{ x: number; y: number } | null>(null);

  const startDrag = (event: React.PointerEvent) => {
    if (!photo) return;
    /*
     * Заагчийг БАРЬЖ авна. Үгүй бол хурдан чирэхэд заагч элементээс гарч,
     * `pointerup` нь өөр газар очиж, карт «наалдсан» хэвээр үлдэнэ.
     */
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  };

  const onDrag = (event: React.PointerEvent) => {
    const from = drag.current;
    if (!from || !photo) return;

    /*
     * Нүдний дэлгэц дээрх диаметр. `MedalPreview` доторх тооцоотой ИЖИЛ
     * байх ёстой — зөрвөл чирэлт зургийн хөдөлгөөнтэй тохирохгүй болно.
     */
    const windowPx = (PREVIEW_SIZE / 2 - 2) * design.photoRadius * 2;

    setAdjust((current) =>
      panBy(
        photo.width,
        photo.height,
        current,
        windowPx,
        event.clientX - from.x,
        event.clientY - from.y,
      ),
    );
    drag.current = { x: event.clientX, y: event.clientY };
  };

  const endDrag = () => {
    drag.current = null;
  };

  const addToBasket = () => {
    const service = design && serviceFor(design, qty);
    if (!service || !design) return;

    basket.add(service, {
      qty,
      /*
       * Медалийн сийлбэрийн эхийг ажилтан бэлддэг тул ЭХ зургийг
       * дамжуулна. Урьдчилсан харагдац нь зөвхөн хэрэглэгчид зориулсан —
       * түүнийг илгээвэл ажилтанд ашиггүй, дахин боловсруулах шаардлагатай
       * файл очно.
       */
      file: null,
      fileName,
      preview: null,
      natural: photo ? { w: photo.width, h: photo.height } : null,
      note: [
        `Медаль: ${design.label[lang]} (${material === 'glass' ? 'шилэн' : 'төмөр'})`,
        text.trim() === '' ? null : `Дээр: ${text.trim()}`,
        subText.trim() === '' ? null : `Доор: ${subText.trim()}`,
        year.trim() === '' ? null : `Он: ${year.trim()}`,
        fileName ? `Зураг: ${fileName}` : 'Зураггүй',
      ]
        .filter(Boolean)
        .join(' · '),
    });
    setAdded(true);
  };

  if (!design) return null;

  return (
    <>
      <PageHero
        eyebrow="Медаль"
        title="Медалиа өөрөө зохионо"
        subtitle="Загвараа сонгоод нэр, огноогоо бичнэ. Зураг нь медалийн голд, бичвэр нь дээд нумаар сийлэгдэнэ."
      />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="grid gap-8 lg:grid-cols-[340px_1fr] lg:gap-12">
          {/* ── Урьдчилан харах ─────────────────────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <div className="card grid place-items-center bg-sunken p-6">
              <div
                onPointerDown={startDrag}
                onPointerMove={onDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className={photo ? 'cursor-grab touch-none active:cursor-grabbing' : ''}
              >
                <MedalPreview
                  design={design}
                  photo={photo}
                  adjust={adjust}
                  text={text}
                  subText={subText}
                  year={year}
                  size={PREVIEW_SIZE}
                />
              </div>
            </div>

            {/*
              * Зургийн тохируулга — ЗӨВХӨН зурагтай үед.
              *
              * Зураггүй байхад гулсуур харуулах нь юу ч хийхгүй хяналт
              * болж, хэрэглэгч эвдэрсэн гэж бодно.
              */}
            {photo && (
              <div className="card mt-3 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold">Зургийн байрлал</span>
                  <button
                    type="button"
                    onClick={() => setAdjust(DEFAULT_ADJUST)}
                    disabled={
                      adjust.zoom === DEFAULT_ADJUST.zoom &&
                      adjust.offsetX === 0 &&
                      adjust.offsetY === 0
                    }
                    className="text-[11px] font-semibold text-muted transition-colors hover:text-brand-500 disabled:opacity-40"
                  >
                    Анхны байдал
                  </button>
                </div>

                <label className="mt-2 block">
                  <span className="sr-only">Томруулах</span>
                  <input
                    type="range"
                    min={PHOTO_ZOOM.min}
                    max={PHOTO_ZOOM.max}
                    step={PHOTO_ZOOM.step}
                    value={adjust.zoom}
                    onChange={(event) =>
                      setAdjust((a) => ({ ...a, zoom: Number(event.target.value) }))
                    }
                    className="w-full accent-brand-500"
                  />
                </label>

                <p className="text-[11px] leading-relaxed text-muted">
                  Зураг дээр чирж байрлуулна. Томруулалт {adjust.zoom.toFixed(2)}×
                </p>
              </div>
            )}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">
              Урьдчилсан загвар. Бодит сийлбэрийн нарийвчлал материалаас
              хамаарна.
            </p>
          </div>

          {/* ── Тохиргоо ────────────────────────────────────── */}
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-bold">1. Материал</h2>
              <div className="mt-2 flex gap-2">
                {(['metal', 'glass'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMaterial(item)}
                    className={`min-h-11 flex-1 rounded-md px-4 text-sm font-semibold transition-colors ${
                      item === material
                        ? 'bg-brand-500 text-white'
                        : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
                    }`}
                  >
                    {item === 'metal' ? 'Төмөр' : 'Шилэн'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold">2. Загвар</h2>
              {/*
                * ⚠️ `auto-fill` — тогтмол 3 багана БИШ.
                *
                * Шилэн таб дээр ганц загвар байдаг: тогтмол багананд
                * ганц карт дэлгэцийн гуравны нэгийг эзэлж сунан
                * «эвдэрсэн» мэт харагдана. `auto-fill` нь хоосон
                * замуудыг үлдээдэг тул карт хэвийн хэмжээтэй хэвээр.
                */}
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-3">
                {designs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setDesignId(item.id)}
                    aria-pressed={item.id === design.id}
                    className={`card-lift flex flex-col items-center gap-2 p-3 ${
                      item.id === design.id ? '!border-brand-500 bg-brand-50/50' : ''
                    }`}
                  >
                    <MedalPreview design={item} photo={photo} adjust={adjust} text="" size={64} />
                    <span className="text-xs font-semibold">{item.label[lang]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-bold">3. Бичвэр ба зураг</h2>

              <label className="mt-3 block">
                <span className="label">Медаль дээр бичих үг</span>
                <input
                  type="text"
                  value={text}
                  maxLength={MAX_TEXT}
                  onChange={(event) => {
                    setText(event.target.value);
                    setAdded(false);
                  }}
                  placeholder="Жишээ нь: ТЭРГҮҮН БАЙР 2026"
                  className="field"
                />
                <span className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>Дээд нумаар сийлэгдэнэ</span>
                  <span>
                    {text.length}/{MAX_TEXT}
                  </span>
                </span>
              </label>

              {/*
                * Доод нум — бодит медальд байгууллагын БҮТЭН нэр энд
                * ордог: зүүн талаас доошоо, ёроолоор, баруун тал руу.
                * Тиймээс дээдээс урт бичвэр хүлээж авна.
                */}
              <label className="mt-3 block">
                <span className="label">Доод нумын бичвэр</span>
                <input
                  type="text"
                  value={subText}
                  maxLength={MAX_SUB_TEXT}
                  onChange={(event) => {
                    setSubText(event.target.value);
                    setAdded(false);
                  }}
                  placeholder="Жишээ нь: ЕРӨНХИЙ БОЛОВСРОЛЫН СУРГУУЛИЙН АШТ"
                  className="field"
                />
                <span className="mt-1 flex justify-between text-[11px] text-muted">
                  <span>Байгууллагын нэр — доод нумаар бүтнээр багтана</span>
                  <span>
                    {subText.length}/{MAX_SUB_TEXT}
                  </span>
                </span>
              </label>

              {/*
                * Он нь НУМААР биш, зургийн доор хэвтээ, улаанаар — бодит
                * бүтээгдэхүүн яг ингэж хэвлэгддэг. Нумаар бичвэл гурав
                * дахь тойрог үүсч, медаль бөглүү харагдана.
                */}
              <label className="mt-3 block">
                <span className="label">Он</span>
                <input
                  type="text"
                  value={year}
                  maxLength={MAX_YEAR}
                  onChange={(event) => {
                    setYear(event.target.value);
                    setAdded(false);
                  }}
                  placeholder="2026"
                  className="field !w-32"
                />
                <span className="mt-1 block text-[11px] text-muted">
                  Зургийн доор улаанаар. Заавал биш.
                </span>
              </label>

              <label className="mt-4 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-hairline p-4 text-center transition-colors hover:border-brand-500">
                <IconImage className="size-6 text-muted" />
                <span className="text-sm font-semibold">
                  {fileName ?? 'Голд тавих зураг сонгох'}
                </span>
                <span className="text-[11px] leading-relaxed text-muted">
                  Дугуй нүдэнд төвөөрөө багтана. Заавал биш.
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    void pickPhoto(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </label>

              {problem && (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs leading-relaxed text-accent-strong">
                  <IconAlert className="mt-px size-4 shrink-0" />
                  {problem}
                </p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-bold">4. Тоо ширхэг</h2>

              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setQty((n) => Math.max(1, n - 1))}
                    aria-label="Хасах"
                    className="grid size-11 place-items-center rounded-md border border-hairline text-lg font-bold transition-colors hover:bg-brand-50 active:scale-95"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={qty}
                    onChange={(event) =>
                      setQty(Math.min(999, Math.max(1, Number(event.target.value) || 1)))
                    }
                    className="field !w-20 !px-2 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => setQty((n) => Math.min(999, n + 1))}
                    aria-label="Нэмэх"
                    className="grid size-11 place-items-center rounded-md border border-hairline text-lg font-bold transition-colors hover:bg-brand-50 active:scale-95"
                  >
                    +
                  </button>
                </div>

                <p className="text-sm">
                  <span className="text-muted">Нэгж {formatCurrency(unit)} · </span>
                  <span className="font-bold text-brand-500">
                    {formatCurrency(unit * qty)}
                  </span>
                </p>
              </div>

              {/*
                * Олны хямдралыг ИЛ хэлнэ.
                *
                * Үнэ нь өөрөө буудаг ч хэрэглэгч яагаад буусныг мэдэхгүй
                * бол «алдаа юм болов уу» гэж эргэлзэнэ. Хүрэхээс өмнө
                * нь хэлбэл бас нэмж захиалах шалтгаан болно.
                */}
              {design.bulk && (
                <p className="mt-2 text-[11px] font-semibold text-brand-500">
                  {qty >= design.bulk.from
                    ? `Олны үнэ идэвхжсэн (${design.bulk.from}-аас дээш)`
                    : `${design.bulk.from} ширхэгээс олны үнэ хямдарна`}
                </p>
              )}

              {/*
                * ⚠️ Үнэ нь ТААМАГ гэдгийг хэлнэ.
                *
                * Медалийн эцсийн үнэ нь сийлбэрийн нарийвчлал, оосор,
                * баглаа боодлоос хамаардаг. «Энэ бол эцсийн үнэ» гэж
                * ойлгуулбал ажилтан дараа нь нэмэлт мөнгө нэхэхэд
                * хэрэглэгч хууртагдсан гэж үзнэ.
                */}
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                Ойролцоо үнэ. Оосор, сийлбэрийн нарийвчлал, баглаа боодлоос
                хамаарч өөрчлөгдөж болно — ажилтан баталгаажуулж залгана.
              </p>

              {added ? (
                <p className="mt-4 flex items-center gap-2 rounded-md bg-brand-50 p-3.5 text-sm font-bold text-brand-500">
                  <IconCheck className="size-4" /> Сагсанд нэмэгдлээ
                </p>
              ) : (
                <button
                  type="button"
                  onClick={addToBasket}
                  className="btn-brand mt-4 w-full"
                >
                  Сагсанд нэмэх
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
