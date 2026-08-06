import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ServiceItem } from '../data/catalog';
import { formatCurrency, parsePrice } from '../lib/price';
import {
  DEFAULT_EDITS,
  FINISHES,
  clampOffset,
  filterCss,
  renderPreview,
  rotationBoost,
  transformCss,
  type Finish,
  type PhotoEdits,
} from '../lib/photoEdit';
import { recommendedPixels, sizeOf } from '../lib/photoSize';

export interface EditorValue {
  qty: number;
  edits: PhotoEdits;
  /** Түүхий зургийн object URL — зөвхөн браузер дотор. */
  src: string | null;
  /** Хэрэглэгчийн эх файл. Захиалга илгээх үед хэвлэлийн хувилбартай хамт явна. */
  file: File | null;
  fileName: string | null;
  /** Засвар тусгасан бяцхан зураг (data URL). */
  preview: string | null;
}

interface Props {
  service: ServiceItem;
  initial?: EditorValue;
  onCancel(): void;
  onSave(value: EditorValue): void;
  /** Аль хэдийн сагсанд орсон мөрийг засаж байгаа эсэх. */
  editing?: boolean;
}

const SLIDERS = [
  { key: 'brightness', label: 'Гэрэлтүүлэг', icon: '☀️' },
  { key: 'contrast', label: 'Контраст', icon: '◐' },
  { key: 'saturation', label: 'Өнгөний ханалт', icon: '🎨' },
] as const;

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
  const frame = useRef<HTMLDivElement>(null);
  const imageEl = useRef<HTMLImageElement | null>(null);
  /** Энэ сессэд үүсгэсэн object URL-үүд — цуцлахад цэвэрлэнэ. */
  const created = useRef<string[]>([]);

  const [src, setSrc] = useState<string | null>(initial?.src ?? null);
  const [file, setFile] = useState<File | null>(initial?.file ?? null);
  const [fileName, setFileName] = useState<string | null>(
    initial?.fileName ?? null,
  );
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [edits, setEdits] = useState<PhotoEdits>(initial?.edits ?? DEFAULT_EDITS);
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [tab, setTab] = useState<'crop' | 'color' | 'paper'>('crop');

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

  /* Зураг ачаалж, жинхэнэ хэмжээг нь тогтоох. */
  useEffect(() => {
    if (!src) {
      imageEl.current = null;
      setNatural(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      imageEl.current = img;
      setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
  }, [src]);

  const boost = rotationBoost(size, natural?.w ?? 0, natural?.h ?? 0, edits.rotation);

  const patch = (next: Partial<PhotoEdits>) => setEdits((e) => ({ ...e, ...next }));

  const pickFile = (chosen: File | undefined) => {
    if (!chosen) return;
    const url = URL.createObjectURL(chosen);
    created.current.push(url);
    setSrc(url);
    setFile(chosen);
    setFileName(chosen.name);
    setEdits(DEFAULT_EDITS);
  };

  /* ── Чирэх (drag) ──────────────────────────────────────────── */
  const drag = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!src) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    const box = frame.current;
    if (!start || !box) return;
    const rect = box.getBoundingClientRect();
    const dx = (e.clientX - start.x) / rect.width;
    const dy = (e.clientY - start.y) / rect.height;
    drag.current = { x: e.clientX, y: e.clientY };
    setEdits((prev) => ({
      ...prev,
      offsetX: clampOffset(prev.offsetX + dx),
      offsetY: clampOffset(prev.offsetY + dy),
    }));
  };

  const endDrag = () => {
    drag.current = null;
  };

  /* ── Хадгалах / цуцлах ─────────────────────────────────────── */
  const save = useCallback(() => {
    const preview = imageEl.current
      ? renderPreview(imageEl.current, size, edits)
      : null;
    // Буцаагаагүй URL-үүдийг цэвэрлэнэ.
    created.current
      .filter((url) => url !== src)
      .forEach((url) => URL.revokeObjectURL(url));
    created.current = [];
    onSave({ qty, edits, src, file, fileName, preview });
  }, [edits, file, fileName, onSave, qty, size, src]);

  const cancel = useCallback(() => {
    created.current
      .filter((url) => url !== initial?.src)
      .forEach((url) => URL.revokeObjectURL(url));
    created.current = [];
    onCancel();
  }, [initial?.src, onCancel]);

  const lowRes =
    natural !== null &&
    Math.min(natural.w, natural.h) < Math.round((Math.min(size.w, size.h) / 2.54) * 200);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Хаах"
        onClick={cancel}
        className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${service.name} — зураг оруулах`}
        className="relative flex max-h-[94dvh] w-full flex-col rounded-t-xl bg-white shadow-2xl sm:max-w-lg sm:rounded-xl"
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
            onClick={cancel}
            aria-label="Хаах"
            className="-mr-1 grid size-9 shrink-0 place-items-center rounded-md text-lg text-muted hover:bg-brand-50"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {/* Зургийн хүрээ */}
          <div className="mx-auto w-full max-w-[280px]">
            <div
              ref={frame}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{ aspectRatio: `${size.w} / ${size.h}` }}
              className={`relative w-full touch-none select-none overflow-hidden rounded-md bg-brand-50 ${
                src ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              {src ? (
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  style={{
                    transform: transformCss(edits, boost),
                    filter: filterCss(edits),
                  }}
                  className="absolute inset-0 size-full object-cover will-change-transform"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="absolute inset-0 grid place-items-center rounded-md border-2 border-dashed border-brand-200 px-4 text-center"
                >
                  <span>
                    <span className="block text-3xl" aria-hidden>
                      🖼️
                    </span>
                    <span className="mt-2 block text-sm font-semibold text-brand-500">
                      Зураг оруулах
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      Зурган сан эсвэл камераас
                    </span>
                  </span>
                </button>
              )}

              {/* Тайрах туслах тор */}
              {src && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3"
                >
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className="border border-white/25" />
                  ))}
                </div>
              )}
            </div>

            <p className="mt-2 text-center text-xs text-muted">
              {src
                ? 'Чирж байрлуулна · доорх тохиргоогоор засна'
                : `Санал болгох нягтрал: ${recommendedPixels(size)}`}
            </p>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickFile(e.target.files?.[0])}
          />

          {src && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-50"
              >
                Зураг солих
              </button>
              <button
                type="button"
                onClick={() => setEdits(DEFAULT_EDITS)}
                className="rounded-md border border-hairline px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-50"
              >
                Анхны байдал
              </button>
            </div>
          )}

          {lowRes && (
            <p className="mt-3 rounded-md bg-accent/10 px-3 py-2 text-xs text-accent-strong">
              Энэ зураг {size.label} хэвлэхэд нягтрал багавтар байна. Тод гаргахын
              тулд {recommendedPixels(size)} орчим байвал зохимжтой.
            </p>
          )}

          {/* Тохиргооны табууд */}
          <div className="mt-5 grid grid-cols-3 gap-1 rounded-md bg-brand-50 p-1">
            {(
              [
                ['crop', 'Байрлал'],
                ['color', 'Өнгө'],
                ['paper', 'Цаас'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-sm py-2 text-xs font-semibold transition-colors ${
                  tab === key ? 'bg-white text-brand-500 shadow-sm' : 'text-ink-soft'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-4">
            {tab === 'crop' && (
              <>
                <label className="block">
                  <span className="flex justify-between text-xs font-semibold text-ink-soft">
                    <span>Томруулах</span>
                    <span className="text-muted">{edits.zoom.toFixed(1)}×</span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.05}
                    value={edits.zoom}
                    disabled={!src}
                    onChange={(e) => patch({ zoom: Number(e.target.value) })}
                    className="mt-2 w-full accent-[#1a56db] disabled:opacity-40"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!src}
                    onClick={() => patch({ rotation: (edits.rotation + 270) % 360 })}
                    className="btn-outline !py-2.5 !text-xs"
                  >
                    ↺ Зүүн 90°
                  </button>
                  <button
                    type="button"
                    disabled={!src}
                    onClick={() => patch({ rotation: (edits.rotation + 90) % 360 })}
                    className="btn-outline !py-2.5 !text-xs"
                  >
                    ↻ Баруун 90°
                  </button>
                  <button
                    type="button"
                    disabled={!src}
                    onClick={() => patch({ flipH: !edits.flipH })}
                    className={`btn-outline !py-2.5 !text-xs ${
                      edits.flipH ? '!border-brand-500 !bg-brand-50 !text-brand-500' : ''
                    }`}
                  >
                    ⇋ Хэвтээ толь
                  </button>
                  <button
                    type="button"
                    disabled={!src}
                    onClick={() => patch({ flipV: !edits.flipV })}
                    className={`btn-outline !py-2.5 !text-xs ${
                      edits.flipV ? '!border-brand-500 !bg-brand-50 !text-brand-500' : ''
                    }`}
                  >
                    ⇅ Босоо толь
                  </button>
                </div>
              </>
            )}

            {tab === 'color' &&
              SLIDERS.map((slider) => (
                <label key={slider.key} className="block">
                  <span className="flex justify-between text-xs font-semibold text-ink-soft">
                    <span>
                      <span aria-hidden>{slider.icon}</span> {slider.label}
                    </span>
                    <span className="text-muted">{edits[slider.key]}%</span>
                  </span>
                  <input
                    type="range"
                    min={50}
                    max={150}
                    step={1}
                    value={edits[slider.key]}
                    disabled={!src}
                    onChange={(e) => patch({ [slider.key]: Number(e.target.value) })}
                    className="mt-2 w-full accent-[#1a56db] disabled:opacity-40"
                  />
                </label>
              ))}

            {tab === 'paper' && (
              <>
                <div>
                  <span className="text-xs font-semibold text-ink-soft">Гадаргуу</span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {FINISHES.map((finish: Finish) => (
                      <button
                        key={finish}
                        type="button"
                        onClick={() => patch({ finish })}
                        className={`rounded-md border px-3 py-2.5 text-xs font-semibold transition-colors ${
                          edits.finish === finish
                            ? 'border-brand-500 bg-brand-50 text-brand-500'
                            : 'border-hairline text-ink-soft'
                        }`}
                      >
                        {finish}
                      </button>
                    ))}
                  </div>
                </div>

                <dl className="rounded-md bg-brand-50/70 px-3 py-3 text-xs">
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
              </>
            )}
          </div>
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

          <button type="button" onClick={save} className="btn-accent mt-3 w-full">
            {editing ? 'Хадгалах' : 'Сагсанд нэмэх'}
          </button>
          {!src && (
            <p className="mt-2 text-center text-[11px] text-muted">
              Зураггүй ч захиалж болно — файлаа дараа нь ирүүлж болно.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
