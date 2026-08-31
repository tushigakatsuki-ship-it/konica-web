import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ServiceItem } from '../data/catalog';
import { formatCurrency, parsePrice, vatPortion } from '../lib/price';
import { DEFAULT_ADJUST, type Adjust } from '../lib/adjust';
import { DEFAULT_CROP, isDefaultCrop, type Crop } from '../lib/crop';
import { renderPreview, renderSource } from '../lib/photoRender';
import { orientSize, recommendedPixels, sizeOf } from '../lib/photoSize';
import { MAX_PHOTOS_PER_ORDER } from '../lib/limits';
import { useLang } from '../state/lang';
import { useBasket } from '../state/basket';
import CropStudio from './CropStudio';
import { IconAlert, IconClose, IconImage, IconZoom } from './icons';
import PrintPreview3D from './PrintPreview3D';

export interface EditorValue {
  qty: number;
  /** Хэрэглэгчийн эх файл. Захиалга илгээх үед л уншигдана. */
  file: File | null;
  fileName: string | null;
  /** Цаасны харьцаагаар тайрсан жижиг data URL — интерфейст энэ л харагдана. */
  preview: string | null;
  /** Эх зургийн нягтрал — сэрэмжлүүлэг ба мэдээлэлд. */
  natural: { w: number; h: number } | null;
  /**
   * Гар аргаар тайрсан байрлал. Байхгүй бол төвөөр нь автоматаар (хуучин зан
   * төлөв). `preview` нь ҮРГЭЛЖ энэ тайралтыг тусгасан байна.
   */
  crop?: Crop;
  /**
   * Brightness/blur/sharpen/дэвсгэр — ЗӨВХӨН Цээж зурагт (`idPhoto` prop).
   * Байхгүй бол `DEFAULT_ADJUST` — бусад ангиллын зан төлөв өөрчлөгдөхгүй.
   */
  adjust?: Adjust;
}

interface Props {
  service: ServiceItem;
  initial?: EditorValue;
  onCancel(): void;
  /**
   * Сонгосон зургууд. Шинээр нэмэх үед ОЛОН байж болно — мөр тус бүр тусдаа
   * сагсны мөр болно. Засварлаж байгаа үед үргэлж яг нэг элемент.
   */
  onSave(values: EditorValue[]): void;
  /** Аль хэдийн сагсанд орсон мөрийг засаж байгаа эсэх. */
  editing?: boolean;
  /**
   * Сагсанд АЛЬ ХЭДИЙН орсон зургийн тоо.
   *
   * ⚠️ Үүнгүйгээр хязгаар нь зөвхөн НЭГ цонхонд үйлчилнэ: хэрэглэгч
   * 100 зураг нэмээд, цонхыг хааж, дахин 100 нэмж чадна. Бүгдийг бэлдэж
   * дуусаад сервер татгалзах бөгөөд хийсэн ажил бүхэлдээ хаягдана.
   */
  alreadyInBasket?: number;
  /**
   * Цээж зургийн ангилал уу — brightness/blur/sharpen/дэвсгэрийн хяналт
   * зөвхөн энд `CropStudio`-д харагдана. Бусад бүх ангилалд `undefined`
   * (`false`-той адил) тул шинэ UI огт унших/зурагдахгүй.
   */
  idPhoto?: boolean;
}

/**
 * Зураг сонгох цонх.
 *
 * Санаатайгаар засварын хэрэгсэлгүй: хэрэглэгч зөвхөн зургаа сонгож, хэдэн
 * ширхэг хэвлэхээ хэлнэ. Зураг нь сонгосон цаасны харьцаанд ТӨВӨӨРӨӨ
 * автоматаар багтана — доорх урьдчилсан харагдац нь хэвлэгдэх зурагтай яг ижил.
 *
 * Эх файлыг DOM-д ХЭЗЭЭ Ч тавихгүй: сонгосон даруйд 640px-ийн жижиг хувилбар
 * үүсгээд түүнийг харуулна. 12MP зургийг 260px хайрцагт харуулах нь хямд утсан
 * дээр хэдэн арван MB санах ой иддэг.
 *
 * ── Яагаад portal вэ ─────────────────────────────────────────────
 *
 * Цонх нь `document.body` дээр шууд зурагдана. `<main>` дээр `page-enter`
 * хөдөлгөөн явдаг бөгөөд `animation-fill-mode: both` тул хөдөлгөөн дууссаны
 * дараа ч `transform` нь «идэвхтэй» хэвээр үлддэг (`matrix(1,0,0,1,0,0)`).
 * Тэгш хэмт матриц ч гэсэн `position: fixed`-ийн ЭЗЭН БЛОК-ыг үүсгэдэг тул
 * `fixed inset-0` нь дэлгэц биш, `<main>`-ы бүтэн өндөр рүү суудаг. Урт
 * хуудсан дээр цонх дэлгэцийн доод захаас гарч, `body { overflow: hidden }`
 * дэвсгэрийн гүйлтийг түгжсэн байдаг тул хэрэглэгч түүн рүү хүрч чадахгүй
 * болно. Portal нь энэ гинжийг бүрмөсөн тасалдаг.
 */
export default function PhotoEditor({
  service,
  initial,
  onCancel,
  onSave,
  editing = false,
  alreadyInBasket = 0,
  idPhoto = false,
}: Props) {
  const { t, ts } = useLang();
  /* НӨАТ нь захиалгын түвшний тохиргоо — сагсанд амьдардаг. */
  const basket = useBasket();

  /** Энэ цонхноос дахин хэдэн зураг нэмж болох вэ. */
  const remaining = Math.max(0, MAX_PHOTOS_PER_ORDER - alreadyInBasket);
  const size = useMemo(() => sizeOf(service.name), [service.name]);
  const unitPrice = parsePrice(service.price);

  /**
   * Урьдчилсан харагдацын хайрцгийн харьцаа, ТУХАЙН зургийн чиглэлээр.
   *
   * Зураг хараахан уншигдаагүй үед (`natural === null`) каталогийн чиглэлээр
   * харуулна — хайрцаг хоосон байх тэр хэдэн зуун миллисекундэд ямар харьцаа
   * байх нь хамаагүй, харин хэмжээ нь нэг л удаа үсрэх нь дээр.
   */
  const frameOf = (natural: { w: number; h: number } | null | undefined): string => {
    const oriented = orientSize(
      size,
      natural ? { width: natural.w, height: natural.h } : null,
    );
    return `${oriented.w} / ${oriented.h}`;
  };

  const fileInput = useRef<HTMLInputElement>(null);
  /** Хуучирсан үр дүнг хаяхад — хурдан дараалж зураг сонговол. */
  const pickSeq = useRef(0);

  const [photos, setPhotos] = useState<EditorValue[]>(() =>
    initial?.preview ? [initial] : [],
  );
  const [loading, setLoading] = useState(false);
  /** Олон зураг уншиж байхад «3/12» гэж харуулна. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Тайрч байгаа зураг. `source` нь ТАЙРААГҮЙ жижигрүүлсэн хувилбар — зөвхөн
   * хэрэглэгч зураг дээр дархад л үүсдэг тул тайрахгүй хүнд ямар ч зардалгүй.
   */
  const [cropping, setCropping] = useState<{ index: number; source: string } | null>(null);
  const [cropLoading, setCropLoading] = useState<number | null>(null);

  /** Зураг дээр дархад — томоор харах ба тайрах цонх нээнэ. */
  const openCrop = async (index: number) => {
    const photo = photos[index];
    if (!photo?.file || cropLoading !== null) return;

    setCropLoading(index);
    try {
      const source = await renderSource(photo.file);
      if (source) setCropping({ index, source });
      else setError(t('editor.unreadable'));
    } catch {
      setError(t('editor.unreadable'));
    } finally {
      setCropLoading(null);
    }
  };

  /**
   * Тайралт баталгаажсан — тухайн зургийн урьдчилсан харагдацыг ДАХИН үүсгэнэ.
   *
   * Preview-г шинэчлэхгүй бол сагсанд болон энэ цонхонд хуучин тайралт
   * харагдсаар байх бөгөөд хэвлэгдэх файл нь өөр болно. Хэрэглэгчийн итгэл
   * бүхэлдээ «харсан зүйл минь хэвлэгдэнэ» гэдэг дээр тогтдог.
   */
  const applyCrop = async (crop: Crop, adjust: Adjust) => {
    const target = cropping;
    setCropping(null);
    if (!target) return;

    const photo = photos[target.index];
    if (!photo?.file) return;

    setCropLoading(target.index);
    try {
      const result = await renderPreview(photo.file, size, 640, crop, adjust);
      setPhotos((list) =>
        list.map((item, i) =>
          i === target.index ? { ...item, crop, adjust, preview: result.preview } : item,
        ),
      );
    } catch {
      setError(t('editor.unreadable'));
    } finally {
      setCropLoading(null);
    }
  };

  /* Escape товч болон дэвсгэрийн гүйлтийг түгжих. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  /**
   * Сонгосон файлуудыг ДАРААЛЛААР уншина.
   *
   * Зэрэг уншвал 12MP зураг бүр ~50MB битмап нээх тул хямд утас 5-6 зураг дээр
   * унана. Дараалуулбал нэг үед ганц битмап л амьд байна — удаан ч гэсэн
   * найдвартай. Явцыг тоогоор харуулж хүлээлтийг ойлгомжтой болгоно.
   */
  const pickFiles = async (chosen: FileList | null) => {
    const incoming = chosen ? Array.from(chosen) : [];
    if (incoming.length === 0) return;

    const seq = (pickSeq.current += 1);

    /* Засварлаж байгаа үед зөвхөн нэг зураг СОЛИНО, нэмэхгүй. */
    const room = editing ? 1 : Math.max(0, remaining - photos.length);
    const accepted = incoming.slice(0, room);
    const overflow = incoming.length - accepted.length;

    if (accepted.length === 0) {
      setError(t('editor.tooMany', { n: MAX_PHOTOS_PER_ORDER }));
      return;
    }

    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: accepted.length });

    const made: EditorValue[] = [];
    let failed = 0;

    for (const [index, chosenFile] of accepted.entries()) {
      try {
        const result = await renderPreview(chosenFile, size);
        if (seq !== pickSeq.current) return; // илүү шинэ сонголт ирсэн
        made.push({
          qty: 1,
          file: chosenFile,
          fileName: chosenFile.name,
          preview: result.preview,
          natural: result.natural,
          crop: DEFAULT_CROP,
          adjust: DEFAULT_ADJUST,
        });
      } catch {
        if (seq !== pickSeq.current) return;
        failed += 1;
      }
      setProgress({ done: index + 1, total: accepted.length });
    }

    if (seq !== pickSeq.current) return;

    setPhotos((list) => (editing ? made.slice(0, 1) : [...list, ...made]));

    const notes: string[] = [];
    if (failed > 0)
      notes.push(
        failed === accepted.length
          ? t('editor.unreadable')
          : t('editor.someFailed', { n: failed }),
      );
    if (overflow > 0) notes.push(t('editor.overflow', { n: overflow }));

    setError(notes.length > 0 ? notes.join(' ') : null);
    setLoading(false);
    setProgress(null);
  };

  const setQtyAt = (index: number, next: number) =>
    setPhotos((list) =>
      list.map((photo, i) => (i === index ? { ...photo, qty: Math.max(1, next) } : photo)),
    );

  const removeAt = (index: number) =>
    setPhotos((list) => list.filter((_, i) => i !== index));

  /**
   * Зураггүйгээр сагсанд нэмэхийг зөвшөөрөхгүй.
   *
   * Өмнө нь «зураггүй ч захиалж болно» гэж үздэг байсан нь бодит байдалд
   * ажилтанд хэвлэх юмгүй ажлын мөр үүсгээд, хэрэглэгч рүү залгаж файл гуйх
   * ажил нэмдэг байв. Зураг сонгох нь энэ цонхны цорын ганц зорилго учир
   * хоосон хадгалахыг бүрмөсөн хаав.
   */
  const ready = photos.length > 0 && !loading;

  const save = useCallback(() => {
    if (photos.length === 0 || loading) return;
    onSave(photos);
  }, [loading, onSave, photos]);

  /** 200dpi-аас доош бол хэвлэхэд мэдэгдэхүйц бүдэг гарна. */
  const minPixels = Math.round((Math.min(size.w, size.h) / 2.54) * 200);
  const isLowRes = (natural: EditorValue['natural']) =>
    natural !== null && Math.min(natural.w, natural.h) < minPixels;

  const lowResCount = photos.filter((photo) => isLowRes(photo.natural)).length;
  const totalQty = photos.reduce((sum, photo) => sum + photo.qty, 0);

  /*
   * Энэ сонголтын дүн. НӨАТ асаалттай бол товчны дээрх тоо нь ТӨЛӨХ дүнг
   * шууд харуулна — хэрэглэгч дараагийн алхам дээр гэнэтийн 10% олохгүй.
   */
  const amountBase = unitPrice * totalQty;
  const amountVat = basket.vat ? vatPortion(amountBase) : 0;
  const amountWithVat = amountBase + amountVat;
  const single = photos.length === 1 ? photos[0] : null;

  const openPicker = () => fileInput.current?.click();

  const busyLabel = progress
    ? `${t('editor.loading')} ${progress.done}/${progress.total}`
    : t('editor.loading');

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label={t('nav.close')}
        onClick={onCancel}
        className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={ts(service.name)}
        className="relative flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-card shadow-2xl sm:max-w-md sm:rounded-xl"
      >
        {/* Толгой */}
        <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{size.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {ts(service.name)} · {formatCurrency(unitPrice)}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t('nav.close')}
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-md text-muted hover:bg-brand-50"
          >
            <IconClose className="size-5" />
          </button>
        </div>

        <div className="scroll-hint min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {/* ── Зураггүй эсвэл ганц зураг — том харагдац ── */}
          {photos.length <= 1 && (
            <div className="mx-auto w-full max-w-[260px]">
              {/*
                Хүрээг ТУХАЙН зургийн чиглэлээр — `size`-аар шууд биш.

                `renderPreview`, `renderPrintBlob` хоёр ижил дүрмээр эргүүлдэг
                тул энд эргүүлэхгүй бол хайрцаг босоо, доторх зураг хэвтээ
                болж, хэрэглэгч буруу тайралт харна.
              */}
              <div
                style={{ aspectRatio: frameOf(single?.natural) }}
                className="relative w-full overflow-hidden rounded-md bg-brand-50"
              >
                {single?.preview ? (
                  /*
                   * Хавтгай зураг биш, ЗУЗААНТАЙ цаас мэт харуулна.
                   *
                   * Хэрэглэгчийн жинхэнэ асуулт нь «тайрагдах уу» биш
                   * «би юу гартаа авах вэ». Цаасны зузаан, ирмэг, гялбаа
                   * харагдсан нь захиалахад итгэл өгнө.
                   *
                   * Дархад томоор нээгдэж, тайрах боломжтой — зургийн аль хэсэг
                   * үлдэхийг хэрэглэгч өөрөө шийднэ.
                   */
                  <button
                    type="button"
                    onClick={() => void openCrop(0)}
                    disabled={cropLoading !== null || loading}
                    aria-label={t('crop.open')}
                    className="absolute inset-0 size-full"
                  >
                    <PrintPreview3D
                      src={single.preview}
                      alt=""
                      className="absolute inset-0 size-full [&_img]:size-full [&_.print-card]:size-full [&_.stage-face]:size-full"
                    />
                    <span className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full bg-ink/70 px-2 py-1 text-[10px] font-bold text-white">
                      <IconZoom className="size-3.5" />
                      {cropLoading === 0 ? t('editor.loading') : t('crop.short')}
                    </span>
                    {!isDefaultCrop(single.crop ?? DEFAULT_CROP) && (
                      <span className="pointer-events-none absolute left-1.5 top-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent">
                        {t('crop.edited')}
                      </span>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={openPicker}
                    disabled={loading}
                    className="absolute inset-0 grid place-items-center rounded-md border-2 border-dashed border-brand-200 px-4 text-center"
                  >
                    <span>
                      <IconImage
                        className={`mx-auto size-8 ${loading ? 'text-muted' : 'text-brand-400'}`}
                      />
                      <span className="mt-2 block text-sm font-semibold text-brand-500">
                        {loading ? busyLabel : t('editor.add')}
                      </span>
                      {!loading && (
                        <span className="mt-1 block text-xs text-muted">
                          {editing ? t('editor.fromGallery') : t('editor.multiHint')}
                        </span>
                      )}
                    </span>
                  </button>
                )}

                {loading && single?.preview && (
                  <span className="absolute inset-0 grid place-items-center bg-card/70 text-sm font-semibold text-brand-500">
                    {busyLabel}
                  </span>
                )}
              </div>

              <p className="mt-2 text-center text-xs text-muted">
                {single?.preview
                  ? t('editor.previewNote')
                  : t('editor.recommendedShort', { n: recommendedPixels(size) })}
              </p>
            </div>
          )}

          {/* ── Олон зураг — тор ── */}
          {photos.length > 1 && (
            <>
              <div className="mb-2 flex items-baseline justify-between">
                <p className="text-sm font-bold">
                  {t('editor.photoCount', { n: photos.length })}
                </p>
                <p className="text-xs text-muted">
                  {t('editor.totalPieces', { n: totalQty })}
                </p>
              </div>

              <ul className="grid grid-cols-3 gap-2.5">
                {photos.map((photo, index) => (
                  <li key={`${photo.fileName ?? 'photo'}-${index}`} className="relative">
                    <button
                      type="button"
                      onClick={() => void openCrop(index)}
                      disabled={cropLoading !== null || loading}
                      aria-label={t('crop.openNth', { n: index + 1 })}
                      style={{ aspectRatio: frameOf(photo.natural) }}
                      className="relative block w-full overflow-hidden rounded-md bg-brand-50"
                    >
                      {photo.preview && (
                        <img
                          src={photo.preview}
                          alt=""
                          className="size-full object-cover"
                          draggable={false}
                        />
                      )}
                      <span className="pointer-events-none absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-ink/65 text-white">
                        <IconZoom className="size-3" />
                      </span>
                      {cropLoading === index && (
                        <span className="absolute inset-0 grid place-items-center bg-card/70 text-[10px] font-bold text-brand-500">
                          {t('editor.loading')}
                        </span>
                      )}
                      {!isDefaultCrop(photo.crop ?? DEFAULT_CROP) && (
                        <span className="pointer-events-none absolute left-1 top-1 rounded-full bg-accent px-1.5 py-0.5 text-[9px] font-bold text-on-accent">
                          {t('crop.edited')}
                        </span>
                      )}
                      {isLowRes(photo.natural) && (
                        <span
                          title={t('editor.softTitle')}
                          className="absolute inset-x-0 bottom-0 bg-accent/90 py-0.5 text-center text-[10px] font-bold text-on-accent"
                        >
                          {t('editor.soft')}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      aria-label={t('editor.removeNth', { n: index + 1 })}
                      onClick={() => removeAt(index)}
                      className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full border border-hairline bg-card text-muted shadow-sm"
                    >
                      <IconClose className="size-3.5" />
                    </button>

                    <div className="mt-1 flex items-center justify-between rounded-md border border-hairline">
                      <button
                        type="button"
                        aria-label={t('editor.decreaseNth', { n: index + 1 })}
                        onClick={() => setQtyAt(index, photo.qty - 1)}
                        className="px-2 py-1 text-sm leading-none"
                      >
                        −
                      </button>
                      <span className="text-xs font-bold tabular-nums">{photo.qty}</span>
                      <button
                        type="button"
                        aria-label={t('editor.increaseNth', { n: index + 1 })}
                        onClick={() => setQtyAt(index, photo.qty + 1)}
                        className="px-2 py-1 text-sm leading-none"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>

              {loading && (
                <p className="mt-3 text-center text-sm font-semibold text-brand-500">
                  {busyLabel}
                </p>
              )}
            </>
          )}

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            /* Засварлаж байгаа үед ганц зураг СОЛИНО — олноор сонгох нь утгагүй. */
            multiple={!editing}
            hidden
            onChange={(e) => {
              void pickFiles(e.target.files);
              // Ижил файлыг дахин сонгоход `change` дахин ажиллуулна.
              e.target.value = '';
            }}
          />

          {photos.length > 0 && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={openPicker}
                disabled={loading || (!editing && photos.length >= remaining)}
                className="rounded-md border border-hairline px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-brand-50 disabled:opacity-50"
              >
                {editing ? t('editor.replace') : t('editor.addMore')}
              </button>
              {!editing && photos.length >= remaining && (
                <p className="mt-1.5 text-xs text-muted">
                  {t('editor.limitHit', { n: MAX_PHOTOS_PER_ORDER })}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">
              <IconAlert className="mt-px size-4 shrink-0" />
              {error}
            </p>
          )}

          {lowResCount > 0 && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent-strong">
              <IconAlert className="mt-px size-4 shrink-0" />
              <span>
                {lowResCount === 1 && photos.length === 1
                  ? t('editor.lowResOne', { size: size.label })
                  : t('editor.lowResMany', { n: lowResCount, size: size.label })}{' '}
                {t('editor.lowResFix', { n: recommendedPixels(size) })}
              </span>
            </p>
          )}

          <dl className="mt-4 rounded-md bg-brand-50/70 px-3 py-2.5 text-xs">
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">{t('editor.sizeLabel')}</dt>
              <dd className="font-semibold">{size.label}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">{t('editor.recommended')}</dt>
              <dd className="font-semibold">{recommendedPixels(size)}</dd>
            </div>
            {single?.natural && (
              <div className="flex justify-between py-0.5">
                <dt className="text-muted">{t('editor.yourPhoto')}</dt>
                <dd className="font-semibold">
                  {single.natural.w} × {single.natural.h} px
                </dd>
              </div>
            )}
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">{t('editor.unitPrice')}</dt>
              <dd className="font-semibold">{formatCurrency(unitPrice)}</dd>
            </div>
          </dl>
        </div>

        {/* Хөл — тоо ширхэг ба хадгалах */}
        <div
          className="shrink-0 border-t border-hairline bg-card px-4 py-3 sm:px-5"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between gap-3">
            {photos.length > 1 ? (
              <div className="min-w-0">
                <p className="text-[11px] text-muted">{t('editor.selected')}</p>
                <p className="truncate text-sm font-bold">
                  {t('editor.summary', { a: photos.length, b: totalQty })}
                </p>
              </div>
            ) : (
              <div className="flex items-center rounded-md border border-hairline">
                <button
                  type="button"
                  aria-label={t('print.decrease')}
                  onClick={() => setQtyAt(0, (single?.qty ?? 1) - 1)}
                  disabled={!single}
                  className="px-3.5 py-2 text-base disabled:opacity-40"
                >
                  −
                </button>
                <span className="w-10 text-center text-sm font-bold">{single?.qty ?? 1}</span>
                <button
                  type="button"
                  aria-label={t('print.increase')}
                  onClick={() => setQtyAt(0, (single?.qty ?? 1) + 1)}
                  disabled={!single}
                  className="px-3.5 py-2 text-base disabled:opacity-40"
                >
                  +
                </button>
              </div>
            )}
            <div className="text-right">
              <p className="text-[11px] text-muted">{t('editor.amount')}</p>
              <p className="text-base font-black text-brand-500">
                {formatCurrency(amountWithVat)}
              </p>
              {basket.vat && (
                <p className="text-[11px] text-muted">
                  {t('editor.vatIncluded', { a: formatCurrency(amountVat) })}
                </p>
              )}
            </div>
          </div>

          {/*
            * НӨАТ-ын сонголт — товчны ЯГ дээр.
            *
            * ⚠️ Энэ нь ЗАХИАЛГЫН түвшний тохиргоо, зураг тус бүрийнх БИШ:
            * утга нь сагсанд хадгалагдаж, бүх мөрөнд нэг удаа бодогдоно.
            * Тиймээс тайлбарт «захиалгын дүнд» гэдгийг ил хэлнэ — эс бөгөөс
            * олон зураг нэмсэн хүн зураг бүрдээ 10% нэмэгдэнэ гэж ойлгоно.
            */}
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-md border border-hairline px-3 py-2.5">
            <input
              type="checkbox"
              checked={basket.vat}
              onChange={(event) => basket.setVat(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-brand-500"
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold">{t('editor.vat')}</span>
              <span className="block text-[11px] leading-relaxed text-muted">
                {t('editor.vatNote')}
              </span>
            </span>
          </label>

          {/*
            ⚠️ Хоёр төлөвт ИЖИЛ өнгө.

            Урьд нь зураг сонгохоос өмнө цэнхэр, сонгосны дараа улбар шар
            болдог байв. Гэтэл хоёул ижил байрлалд байгаа, хоёул ҮНДСЭН
            үйлдэл — өнгө нь солигдох нь «өөр товч гарч ирлээ» гэсэн худал
            дохио өгнө. Идэвхгүй/идэвхтэйг `disabled` л ялгана.
          */}
          <button
            type="button"
            onClick={ready ? save : openPicker}
            disabled={loading}
            className="btn-accent mt-3 w-full"
          >
            {loading ? (
              busyLabel
            ) : ready ? (
              editing ? (
                t('editor.save')
              ) : photos.length > 1 ? (
                `${photos.length} · ${t('editor.addToBasket')}`
              ) : (
                t('editor.addToBasket')
              )
            ) : (
              <>
                <IconImage className="size-4" /> {t('editor.pickFirst')}
              </>
            )}
          </button>
        </div>
      </div>

      {/*
        * Тайрах цонх нь ЭНЭ цонхны дээр (z-70 vs z-60) өөрийн portal-аар гарна.
        * Тиймээс доорх зураг сонгох цонх задрахгүй — хэрэглэгч тайрч дуусаад
        * шууд үргэлжлүүлнэ.
        */}
      {cropping && (
        <CropStudio
          source={cropping.source}
          size={size}
          initial={photos[cropping.index]?.crop ?? DEFAULT_CROP}
          idPhoto={idPhoto}
          initialAdjust={photos[cropping.index]?.adjust ?? DEFAULT_ADJUST}
          onCancel={() => setCropping(null)}
          onApply={(crop, adjust) => void applyCrop(crop, adjust)}
        />
      )}
    </div>,
    document.body,
  );
}
