import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHero from '../components/PageHero';
import {
  IconAlert,
  IconArrowRight,
  IconCheck,
  IconCrop,
  IconImage,
} from '../components/icons';
import {
  BACKGROUNDS,
  ID_SIZES,
  SHEET,
  applyBackground,
  backgroundMask,
  borderColor,
  cmToPx,
  cropForFace,
  featherMask,
  sheetLayout,
  type CropRect,
  type IdSize,
} from '../lib/idPhoto';
import { detectFace, type FaceResult } from '../lib/faceDetect';
import { decodeImage } from '../lib/photoRender';

/**
 * Цээж зураг автоматжуулах — АЖИЛТНЫ хэрэгсэл.
 *
 * Зураг оруулахад: нүүрийг олж → дэвсгэрийг цагаан болгож → баримтын
 * стандартын дагуу тайрч → 300dpi-аар хэвлэхэд бэлэн ганц файл гаргана.
 *
 * ⚠️ Захиалгын мэдээлэл ЭНД ОГТ БАЙХГҮЙ — бүх боловсруулалт браузер дотор,
 * сервер рүү юу ч илгээгддэггүй.
 *
 * ── Хязгаарлалтууд (интерфейс дээр ч хэлсэн) ─────────────────────
 *
 * • **Нүүр илрүүлэлт** нь дүрсийн хүрээнд суурилсан (`lib/faceDetect.ts`).
 *   Жигд дэвсгэртэй студийн зурагт сайн; эмх замбараагүй дэвсгэрт алдана.
 *   Нарийвчлал хэрэгтэй бол `detectFace`-ийг MediaPipe Face Mesh-ээр
 *   солиход бусад код өөрчлөгдөхгүй.
 *
 * • **Дэвсгэр авахад** буржгар үс, нимгэн шил зэрэг нарийн ирмэг заримдаа
 *   бүдгэрнэ. Хүнд тохиолдолд «Хэвээр» сонгоод гараар засах нь хурдан.
 *
 * • **Нүүр олдоогүй үед зориуд таслахгүй.** Буруу таслагдсан зураг
 *   хэвлэгдснээс дахин авахыг хүссэн нь хямд.
 */

/** Урьдчилан харах хүрээний өндөр (px). Жинхэнэ гаралт нь 300dpi. */
const PREVIEW_H = 360;

/**
 * Нүүр хайхад ашиглах ажлын зургийн өргөн.
 *
 * 12MP зураг дээр үерийн дүүргэлт секунд шаардана; 480px дээр агшин зуур
 * бөгөөд толгойн хайрцаг ижил нарийвчлалтай гарна (харьцаагаар буцаана).
 */
const DETECT_W = 480;

type Stage = 'idle' | 'working' | 'ready' | 'no-face';

export default function IdPhotoStudio() {
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<CanvasImageSource & { width: number; height: number }>(null);
  const closeRef = useRef<(() => void) | null>(null);

  const [size, setSize] = useState<IdSize>(ID_SIZES[0]);
  const [bgKey, setBgKey] = useState(BACKGROUNDS[0].key);
  const [tolerance, setTolerance] = useState(60);
  const [copies, setCopies] = useState(0);
  const [stage, setStage] = useState<Stage>('idle');
  const [face, setFace] = useState<FaceResult | null>(null);
  /** Тайрах хүрээ — автоматаар тооцоод, ажилтан чирж засаж болно. */
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [clamped, setClamped] = useState(false);
  const [busy, setBusy] = useState(false);

  const layout = useMemo(() => sheetLayout(size), [size]);
  const background = BACKGROUNDS.find((b) => b.key === bgKey) ?? BACKGROUNDS[0];
  const removeBg = background.rgb !== null;

  useEffect(() => setCopies(layout.count), [layout.count]);
  useEffect(() => () => closeRef.current?.(), []);

  /** Илэрсэн нүүрээс сонгосон хэмжээний дагуу хүрээг дахин тооцно. */
  const recrop = useCallback(
    (detected: FaceResult | null, target: IdSize) => {
      const source = sourceRef.current;
      if (!source || !detected) return;

      const auto = cropForFace(detected.box, target, source.width, source.height);
      setCrop(auto.rect);
      setClamped(auto.clamped);
    },
    [],
  );

  useEffect(() => recrop(face, size), [face, recrop, size]);

  /** Зургийн тайрсан хэсгийг canvas дээр буулгаж, дэвсгэрийг солино. */
  const drawPhoto = useCallback(
    (canvas: HTMLCanvasElement, outH: number): void => {
      const source = sourceRef.current;
      if (!source || !crop) return;

      const outW = Math.round(outH * (size.w / size.h));
      canvas.width = outW;
      canvas.height = outH;

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, outW, outH);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, outW, outH);

      if (!background.rgb) return;

      const image = ctx.getImageData(0, 0, outW, outH);
      const bg = borderColor(image.data, outW, outH);
      const mask = backgroundMask(image.data, outW, outH, tolerance, bg);
      // Радиус нь хэмжээтэй хамт өснө — 300dpi дээр 1px зөөлрөлт хангалтгүй.
      const soft = featherMask(mask, outW, outH, Math.max(1, Math.round(outH / 200)));
      applyBackground(image.data, soft, background.rgb);
      ctx.putImageData(image, 0, 0);
    },
    [background, crop, size, tolerance],
  );

  useEffect(() => {
    if (crop && previewRef.current) drawPhoto(previewRef.current, PREVIEW_H);
  }, [crop, drawPhoto]);

  /* ── Зураг оруулах → бүтэн урсгал ─────────────────────────────── */
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setStage('working');
    setFace(null);
    setCrop(null);

    try {
      closeRef.current?.();
      const decoded = await decodeImage(file);
      sourceRef.current = decoded.source;
      closeRef.current = decoded.close;

      // Нүүр хайх ажлын хуулбар — жижигрүүлж хурдасгана.
      const scale = Math.min(1, DETECT_W / decoded.source.width);
      const w = Math.max(1, Math.round(decoded.source.width * scale));
      const h = Math.max(1, Math.round(decoded.source.height * scale));

      const work = document.createElement('canvas');
      work.width = w;
      work.height = h;
      const ctx = work.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(decoded.source, 0, 0, w, h);

      const found = await detectFace(ctx.getImageData(0, 0, w, h).data, w, h);

      if (!found) {
        /*
         * Нүүр олдсонгүй — ЗОРИУД таслахгүй.
         *
         * Таамгаар таслаад хэвлэвэл толгой тасарсан, эсвэл хэт жижиг зураг
         * гарна. Ажилтан дахин авах нь буруу хэвлэснээс хямд.
         */
        setStage('no-face');
        return;
      }

      // Ажлын хуулбарын координатыг эх зураг руу буцаана.
      setFace({
        ...found,
        box: {
          x: found.box.x / scale,
          y: found.box.y / scale,
          w: found.box.w / scale,
          h: found.box.h / scale,
        },
      });
      setStage('ready');
    } finally {
      setBusy(false);
    }
  };

  /* ── Хүрээг гараар зөөх ───────────────────────────────────────── */
  const drag = useRef<{ x: number; y: number } | null>(null);

  const onPointerMove = (event: React.PointerEvent) => {
    const start = drag.current;
    const box = frameRef.current;
    const source = sourceRef.current;
    if (!start || !box || !crop || !source) return;

    const rect = box.getBoundingClientRect();
    // Дэлгэц дээрх хөдөлгөөнийг эх зургийн пиксел рүү хөрвүүлнэ.
    const dx = ((event.clientX - start.x) / rect.width) * crop.w;
    const dy = ((event.clientY - start.y) / rect.height) * crop.h;
    drag.current = { x: event.clientX, y: event.clientY };

    setCrop({
      ...crop,
      x: Math.max(0, Math.min(source.width - crop.w, crop.x - dx)),
      y: Math.max(0, Math.min(source.height - crop.h, crop.y - dy)),
    });
  };

  /* ── Хуудас угсарч татах ──────────────────────────────────────── */
  const downloadSheet = async () => {
    if (!crop) return;
    setBusy(true);
    try {
      const photo = document.createElement('canvas');
      drawPhoto(photo, cmToPx(size.h));

      const sheet = document.createElement('canvas');
      sheet.width = cmToPx(SHEET.w);
      sheet.height = cmToPx(SHEET.h);

      const ctx = sheet.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.imageSmoothingQuality = 'high';

      layout.slots.slice(0, copies).forEach((slot) => {
        const x = cmToPx(slot.x);
        const y = cmToPx(slot.y);
        const w = cmToPx(slot.w);
        const h = cmToPx(slot.h);

        if (layout.rotated) {
          ctx.save();
          ctx.translate(x + w / 2, y + h / 2);
          ctx.rotate(Math.PI / 2);
          ctx.drawImage(photo, -h / 2, -w / 2, h, w);
          ctx.restore();
        } else {
          ctx.drawImage(photo, x, y, w, h);
        }

        // Зүсэх заавар — саарал, учир нь зүсэлт зөрөхөд харагдана.
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        sheet.toBlob(resolve, 'image/jpeg', 0.95),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tseej-${size.label.replace(/[^\w]/g, '')}-${copies}sh.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(false);
    }
  };

  const openPicker = () => fileInput.current?.click();

  return (
    <>
      <PageHero
        eyebrow="Ажилтны хэрэгсэл"
        title="Цээж зураг автоматжуулах"
        subtitle="Зураг оруулахад нүүрийг өөрөө олж, дэвсгэрийг цагаан болгож, баримтын стандартын дагуу тасалж, 300dpi-аар хэвлэхэд бэлэн ганц файл гаргана."
      />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="rounded-md bg-brand-50 px-4 py-3 text-sm leading-relaxed text-ink-soft">
          Бүх боловсруулалт таны төхөөрөмж дээр хийгдэнэ — зураг сервер рүү
          илгээгддэггүй.
        </p>

        <div className="mt-6 grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* ── Урьдчилан харах ────────────────────────────────── */}
          <div>
            <div
              ref={frameRef}
              onPointerDown={(e) => {
                if (!crop) return;
                (e.target as Element).setPointerCapture?.(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              style={{ aspectRatio: `${size.w} / ${size.h}` }}
              className={`relative mx-auto w-full max-w-[300px] touch-none select-none overflow-hidden rounded-md border border-hairline bg-brand-50 ${
                crop ? 'cursor-grab active:cursor-grabbing' : ''
              }`}
            >
              {crop ? (
                <canvas ref={previewRef} className="absolute inset-0 size-full" />
              ) : (
                <button
                  type="button"
                  onClick={openPicker}
                  disabled={stage === 'working'}
                  className="absolute inset-0 grid place-items-center border-2 border-dashed border-brand-200 px-4 text-center"
                >
                  <span>
                    <IconImage className="mx-auto size-8 text-brand-400" />
                    <span className="mt-2 block text-sm font-semibold text-brand-500">
                      {stage === 'working' ? 'Нүүр хайж байна…' : 'Зураг оруулах'}
                    </span>
                  </span>
                </button>
              )}

              {/* Стандартын заавар — толгойн өндөр, нүдний шугам. */}
              {crop && (
                <div aria-hidden className="pointer-events-none absolute inset-0">
                  <div
                    className="absolute left-1/2 -translate-x-1/2 rounded-[50%] border-2 border-dashed border-white/70"
                    style={{
                      top: `${size.topMargin * 100}%`,
                      height: `${size.headRatio * 100}%`,
                      width: `${size.headRatio * 72}%`,
                    }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-accent/80"
                    style={{ top: `${(size.topMargin + size.headRatio * 0.45) * 100}%` }}
                  />
                </div>
              )}
            </div>

            <p className="mt-2 text-center text-xs text-muted">
              {crop
                ? 'Автоматаар байрлуулсан · шаардвал чирж засна'
                : `${size.label} · толгой ${Math.round(size.headRatio * 100)}%`}
            </p>

            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                void pickFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />

            {stage !== 'idle' && (
              <button
                type="button"
                onClick={openPicker}
                className="btn-outline mt-3 w-full !py-2 !text-xs"
              >
                Зураг солих
              </button>
            )}

            {/* ── Илрүүлэлтийн төлөв ──────────────────────────── */}
            {stage === 'no-face' && (
              <div className="mt-4 rounded-md bg-accent/10 p-3">
                <p className="flex items-start gap-2 text-xs font-bold text-accent-strong">
                  <IconAlert className="mt-px size-4 shrink-0" />
                  Нүүр олдсонгүй — зориуд таслаагүй
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-accent-strong">
                  Буруу таслагдсан зураг хэвлэгдснээс дахин авах нь хямд. Жигд
                  дэвсгэр дээр, урдаас, гэрэлтэй авсан зураг оруулна уу.
                </p>
              </div>
            )}

            {face?.confidence === 'low' && stage === 'ready' && (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-[11px] leading-relaxed text-accent-strong">
                <IconAlert className="mt-px size-4 shrink-0" />
                Илрүүлэлт эргэлзээтэй — хүрээг нүдээр шалгаж, шаардвал чирж
                засна уу.
              </p>
            )}

            {clamped && stage === 'ready' && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-[11px] leading-relaxed text-accent-strong">
                <IconAlert className="mt-px size-4 shrink-0" />
                Стандартын хүрээ зургийн гадна гарлаа. Хүн хэт ирмэгт зогссон
                эсвэл зураг ойроос авагдсан — стандарт зөрчигдөж болзошгүй.
              </p>
            )}

            {stage === 'ready' && face?.confidence === 'high' && !clamped && (
              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                <IconCheck className="mt-px size-4 shrink-0 text-ok-strong" />
                Нүүр илэрч, стандартын дагуу таслагдлаа.
              </p>
            )}
          </div>

          {/* ── Тохиргоо ───────────────────────────────────────── */}
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold">1. Хэмжээ</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {ID_SIZES.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setSize(item)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      item.label === size.label
                        ? 'bg-brand-500 text-white'
                        : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">
                Хэмжээ солиход хүрээ автоматаар дахин тооцогдоно.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-bold">2. Дэвсгэр</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                {BACKGROUNDS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setBgKey(item.key)}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                      item.key === bgKey
                        ? 'border-brand-500 bg-brand-50 text-brand-500'
                        : 'border-hairline text-ink-soft'
                    }`}
                  >
                    <span
                      aria-hidden
                      className="size-4 rounded-sm border border-hairline"
                      style={{
                        background: item.rgb
                          ? `rgb(${item.rgb.r},${item.rgb.g},${item.rgb.b})`
                          : 'repeating-linear-gradient(45deg,#e2e8f0 0 4px,#fff 4px 8px)',
                      }}
                    />
                    {item.label}
                  </button>
                ))}
              </div>

              {removeBg ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="flex justify-between text-xs font-semibold text-ink-soft">
                      <span>Зөвшөөрөл</span>
                      <span className="text-muted">{tolerance}</span>
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={160}
                      value={tolerance}
                      onChange={(e) => setTolerance(Number(e.target.value))}
                      className="mt-1.5 w-full accent-[#1a56db]"
                    />
                  </label>

                  <p className="flex items-start gap-2 rounded-md bg-accent/10 px-3 py-2 text-[11px] leading-relaxed text-accent-strong">
                    <IconAlert className="mt-px size-4 shrink-0" />
                    <span>
                      Буржгар үс, нимгэн шил зэрэг нарийн ирмэг заримдаа бүдгэрнэ.
                      Хүнд тохиолдолд <strong>«Хэвээр»</strong> сонгоод гараар
                      засах нь хурдан.
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-[11px] leading-relaxed text-muted">
                  Дэвсгэрийг хөндөхгүй — тайралт, хуудасны байрлуулалт л хийгдэнэ.
                </p>
              )}
            </div>

            <div>
              <h2 className="text-sm font-bold">3. Хуудас</h2>
              <dl className="mt-2 rounded-md bg-brand-50/70 px-3 py-2.5 text-xs">
                <div className="flex justify-between py-0.5">
                  <dt className="text-muted">Цаас</dt>
                  <dd className="font-semibold">
                    {SHEET.label} · {cmToPx(SHEET.w)}×{cmToPx(SHEET.h)} px
                  </dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt className="text-muted">Тор</dt>
                  <dd className="font-semibold">
                    {layout.cols}×{layout.rows}
                    {layout.rotated && ' (эргүүлсэн)'}
                  </dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt className="text-muted">Багтах дээд тоо</dt>
                  <dd className="font-semibold">{layout.count} ш</dd>
                </div>
              </dl>

              <label className="mt-3 block">
                <span className="flex justify-between text-xs font-semibold text-ink-soft">
                  <span>Хэвлэх тоо</span>
                  <span className="text-muted">
                    {copies} / {layout.count}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={layout.count}
                  value={copies}
                  onChange={(e) => setCopies(Number(e.target.value))}
                  className="mt-1.5 w-full accent-[#1a56db]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void downloadSheet()}
              disabled={!crop || busy}
              className="btn-accent w-full !py-3.5"
            >
              {busy ? (
                'Боловсруулж байна…'
              ) : (
                <>
                  <IconCrop className="size-4" /> {SHEET.label} хуудас татах
                </>
              )}
            </button>
          </div>
        </div>

        {/* Хязгаарлалт — нуухгүй хэлнэ */}
        <section className="mt-12 rounded-lg border border-hairline p-5 sm:mt-16">
          <h2 className="text-base font-bold">Хязгаарлалт</h2>
          <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
            <li className="flex gap-3">
              <IconAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" />
              <span>
                <strong className="text-ink">Нүүр илрүүлэлт</strong> нь дүрсийн
                хүрээнд суурилсан. Жигд дэвсгэр дээр, урдаас, гэрэлтэй авсан
                зурагт сайн; эмх замбараагүй дэвсгэр, хэт хажуу эргэсэн зурагт
                алдана. Нарийвчлал хэрэгтэй бол{' '}
                <code className="rounded-sm bg-brand-50 px-1 text-xs">detectFace</code>
                -ийг MediaPipe Face Mesh-ээр солиход бусад код өөрчлөгдөхгүй.
              </span>
            </li>
            <li className="flex gap-3">
              <IconAlert className="mt-0.5 size-4 shrink-0 text-accent-strong" />
              <span>
                <strong className="text-ink">Арын дэвсгэр авахад</strong> буржгар
                үс, нимгэн шил зэрэг нарийн ирмэг заримдаа бүдгэрнэ. Хүнд
                тохиолдолд «Хэвээр» сонгоод гараар засах нь хурдан.
              </span>
            </li>
            <li className="flex gap-3">
              <IconCheck className="mt-0.5 size-4 shrink-0 text-ok-strong" />
              <span>
                <strong className="text-ink">Нүүр олдоогүй үед зориуд
                таслахгүй.</strong>{' '}
                Буруу таслагдсан зураг хэвлэгдснээс дахин авахыг хүссэн нь хямд.
              </span>
            </li>
          </ul>
        </section>

        <Link
          to="/tseej-zurag"
          className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500 hover:underline"
        >
          Цээж зургийн үнэ, шаардлага <IconArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}
