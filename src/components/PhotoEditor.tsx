import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceItem } from '../data/catalog';
import { formatCurrency, parsePrice } from '../lib/price';
import { renderPreview } from '../lib/photoRender';
import { recommendedPixels, sizeOf } from '../lib/photoSize';

export interface EditorValue {
  qty: number;
  /** Хэрэглэгчийн эх файл. Захиалга илгээх үед л уншигдана. */
  file: File | null;
  fileName: string | null;
  /** Цаасны харьцаагаар тайрсан жижиг data URL — интерфейст энэ л харагдана. */
  preview: string | null;
  /** Эх зургийн нягтрал — сэрэмжлүүлэг ба мэдээлэлд. */
  natural: { w: number; h: number } | null;
}

interface Props {
  service: ServiceItem;
  initial?: EditorValue;
  onCancel(): void;
  onSave(value: EditorValue): void;
  /** Аль хэдийн сагсанд орсон мөрийг засаж байгаа эсэх. */
  editing?: boolean;
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
 */
export default function PhotoEditor({
  service,
  initial,
  onCancel,
  onSave,
  editing = false,
}: Props) {
  const size = useMemo(() => sizeOf(service.name), [service.name]);
  const unitPrice = parsePrice(service.price);

  const fileInput = useRef<HTMLInputElement>(null);
  /** Хуучирсан үр дүнг хаяхад — хурдан дараалж зураг сонговол. */
  const pickSeq = useRef(0);

  const [file, setFile] = useState<File | null>(initial?.file ?? null);
  const [fileName, setFileName] = useState<string | null>(initial?.fileName ?? null);
  const [preview, setPreview] = useState<string | null>(initial?.preview ?? null);
  const [natural, setNatural] = useState(initial?.natural ?? null);
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const pickFile = async (chosen: File | undefined) => {
    if (!chosen) return;
    const seq = (pickSeq.current += 1);

    setFile(chosen);
    setFileName(chosen.name);
    setLoading(true);
    setError(null);

    try {
      const result = await renderPreview(chosen, size);
      if (seq !== pickSeq.current) return; // илүү шинэ сонголт ирсэн
      setPreview(result.preview);
      setNatural(result.natural);
    } catch {
      if (seq !== pickSeq.current) return;
      setPreview(null);
      setNatural(null);
      setError('Энэ файлыг уншиж чадсангүй. JPG эсвэл PNG зураг сонгоно уу.');
    } finally {
      if (seq === pickSeq.current) setLoading(false);
    }
  };

  /**
   * Зураггүйгээр сагсанд нэмэхийг зөвшөөрөхгүй.
   *
   * Өмнө нь «зураггүй ч захиалж болно» гэж үздэг байсан нь бодит байдалд
   * ажилтанд хэвлэх юмгүй ажлын мөр үүсгээд, хэрэглэгч рүү залгаж файл гуйх
   * ажил нэмдэг байв. Зураг сонгох нь энэ цонхны цорын ганц зорилго учир
   * хоосон хадгалахыг бүрмөсөн хаав.
   */
  const ready = Boolean(file && preview && !error && !loading);

  const save = useCallback(() => {
    if (!ready || !file) return;
    onSave({ qty, file, fileName, preview, natural });
  }, [file, fileName, natural, onSave, preview, qty, ready]);

  /** 200dpi-аас доош бол хэвлэхэд мэдэгдэхүйц бүдэг гарна. */
  const lowRes =
    natural !== null &&
    Math.min(natural.w, natural.h) < Math.round((Math.min(size.w, size.h) / 2.54) * 200);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Хаах"
        onClick={onCancel}
        className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${service.name} — зураг оруулах`}
        className="relative flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-w-md sm:rounded-xl"
      >
        {/* Толгой */}
        <div className="flex shrink-0 items-start gap-3 border-b border-hairline px-4 py-3.5 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{size.label}</p>
            <p className="mt-0.5 truncate text-xs text-muted">
              {service.name} · {formatCurrency(unitPrice)} / ш
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Хаах"
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-md text-lg text-muted hover:bg-brand-50"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {/* Зургийн хүрээ */}
          <div className="mx-auto w-full max-w-[260px]">
            <div
              style={{ aspectRatio: `${size.w} / ${size.h}` }}
              className="relative w-full overflow-hidden rounded-md bg-brand-50"
            >
              {preview ? (
                <img
                  src={preview}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={loading}
                  className="absolute inset-0 grid place-items-center rounded-md border-2 border-dashed border-brand-200 px-4 text-center"
                >
                  <span>
                    <span className="block text-3xl" aria-hidden>
                      {loading ? '⏳' : '🖼️'}
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-brand-500">
                      {loading ? 'Уншиж байна…' : 'Зураг оруулах'}
                    </span>
                    {!loading && (
                      <span className="mt-1 block text-xs text-muted">
                        Зурган сан эсвэл камераас
                      </span>
                    )}
                  </span>
                </button>
              )}

              {loading && preview && (
                <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-semibold text-brand-500">
                  Уншиж байна…
                </span>
              )}
            </div>

            <p className="mt-2 text-center text-xs text-muted">
              {preview
                ? 'Хэвлэгдэх байдал — зураг цаасны хэмжээнд төвөөрөө багтана'
                : `Санал болгох нягтрал: ${recommendedPixels(size)}`}
            </p>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              void pickFile(e.target.files?.[0]);
              // Ижил файлыг дахин сонгоход `change` дахин ажиллуулна.
              e.target.value = '';
            }}
          />

          {preview && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={loading}
                className="rounded-md border border-hairline px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-brand-50 disabled:opacity-50"
              >
                Зураг солих
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          {lowRes && (
            <p className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-xs leading-relaxed text-accent-strong">
              Энэ зураг {size.label} хэвлэхэд нягтрал багавтар байна. Тод гаргахын
              тулд {recommendedPixels(size)} орчим байвал зохимжтой.
            </p>
          )}

          <dl className="mt-4 rounded-md bg-brand-50/70 px-3 py-2.5 text-xs">
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">Хэмжээ</dt>
              <dd className="font-semibold">{size.label}</dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">Санал болгох нягтрал</dt>
              <dd className="font-semibold">{recommendedPixels(size)}</dd>
            </div>
            {natural && (
              <div className="flex justify-between py-0.5">
                <dt className="text-muted">Таны зураг</dt>
                <dd className="font-semibold">
                  {natural.w} × {natural.h} px
                </dd>
              </div>
            )}
            <div className="flex justify-between py-0.5">
              <dt className="text-muted">Нэгжийн үнэ</dt>
              <dd className="font-semibold">{formatCurrency(unitPrice)}</dd>
            </div>
          </dl>
        </div>

        {/* Хөл — тоо ширхэг ба хадгалах */}
        <div
          className="shrink-0 border-t border-hairline bg-white px-4 py-3 sm:px-5"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center rounded-md border border-hairline">
              <button
                type="button"
                aria-label="Хорогдуулах"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3.5 py-2 text-base"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-bold">{qty}</span>
              <button
                type="button"
                aria-label="Нэмэгдүүлэх"
                onClick={() => setQty((q) => q + 1)}
                className="px-3.5 py-2 text-base"
              >
                +
              </button>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted">Дүн</p>
              <p className="text-base font-black text-brand-500">
                {formatCurrency(unitPrice * qty)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={ready ? save : () => fileInput.current?.click()}
            disabled={loading}
            className={ready ? 'btn-accent mt-3 w-full' : 'btn-brand mt-3 w-full'}
          >
            {loading
              ? 'Уншиж байна…'
              : ready
                ? editing
                  ? 'Хадгалах'
                  : 'Сагсанд нэмэх'
                : '🖼️ Эхлээд зургаа сонгоно уу'}
          </button>
        </div>
      </div>
    </div>
  );
}
