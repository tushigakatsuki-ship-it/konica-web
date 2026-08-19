import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  DEFAULT_CROP,
  MAX_ZOOM,
  isDefaultCrop,
  normalizeCrop,
  panCrop,
  placeCover,
  type Crop,
} from '../lib/crop';
import type { PhotoSize } from '../lib/photoSize';
import { useLang } from '../state/lang';
import { IconClose } from './icons';

interface Props {
  /** ТАЙРААГҮЙ зургийн data URL (`renderSource`-оос). */
  source: string;
  size: PhotoSize;
  initial: Crop;
  onCancel(): void;
  onApply(crop: Crop): void;
}

/**
 * Зургийг томоор харах ба гар аргаар тайрах цонх.
 *
 * ── Яагаад хэрэгтэй болов ────────────────────────────────────────
 *
 * Өмнө нь тайралт нь БҮРЭН автомат байсан: зураг цаасны харьцаанд төвөөрөө
 * багтдаг. Хэвтээ зургийг босоо цаасанд хэвлэхэд энэ нь хоёр талаас нь огтолж,
 * гэр бүлийн зургийн хажуугийн хүн тасардаг. Хэрэглэгч тэрийг зөвхөн бэлэн
 * хэвлэсний дараа л мэддэг байв.
 *
 * ── Хэрхэн ажилладаг вэ ──────────────────────────────────────────
 *
 * Хүрээ нь цаасны ЯГ харьцаатай. Зураг түүнийг үргэлж дүүргэнэ (`cover`) тул
 * цагаан зай гарах боломж алга. Хуруугаараа чирж хөдөлгөнө, хоёр хуруугаар
 * эсвэл гулсуураар ойртуулна.
 *
 * Дэлгэц дээрх байрлалыг `placeCover` тооцоолдог — хэвлэх файл ЯГ ижил функц
 * ашигладаг. Хоёр газар тусад нь томьёо бичих нь «харсан зүйл хэвлэгдсэнээсээ
 * зөрөх» алдааг зайлшгүй төрүүлдэг.
 */
export default function CropStudio({ source, size, initial, onCancel, onApply }: Props) {
  const { t } = useLang();

  const [crop, setCrop] = useState<Crop>(() => normalizeCrop(initial));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null);

  /** Боломжит талбай. Хүрээ нь энэ дотор багтах хамгийн том зөв харьцаат хэсэг. */
  const stageRef = useRef<HTMLDivElement>(null);

  /**
   * Идэвхтэй хуруунууд. Хоёр хуруу зэрэг байвал чирэхийн оронд ойртуулна.
   *
   * `PointerEvent`-ыг ашигласан шалтгаан: хулгана, хуруу, цахим үзэг гурвыг нэг
   * кодоор барина. `touchstart`/`mousedown` хоёрыг тусад нь бичвэл давхар
   * ажиллах, зөрөх алдаа гардаг.
   */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  /**
   * Хүрээний хэмжээг ПИКСЕЛЭЭР өөрсдөө тооцоолно.
   *
   * ⚠️ Эхлээд үүнийг цэвэр CSS-ээр (`aspect-ratio` + `max-h-full`) хийсэн нь
   * ажиллаагүй: намхан дэлгэц дээр `max-height` өндрийг таслахад браузер
   * харьцааг хадгалдаггүй, зүгээр л намхан хайрцаг үлдээдэг. Тест дээр 10:15
   * (0.667) байх ёстой хүрээ 0.771 гарсан — өөрөөр хэлбэл хэрэглэгчийн тайрч
   * буй хүрээ цаасны харьцаа БИШ байв. Тэр нь энэ боломжийн утга учрыг үгүй
   * хийнэ: харсан зүйл нь хэвлэгдэхтэй таарахаа болино.
   *
   * Тиймээс боломжит талбайг хэмжээд, дотор нь багтах ХАМГИЙН ТОМ зөв
   * харьцаатай тэгш өнцөгтийг өөрсдөө бодно — өндөр, өргөн хоёуланд найдвартай.
   */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const box = stage.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) return;

      const ratio = size.w / size.h;
      const width = Math.min(box.width, box.height * ratio);
      setFrame({ width, height: width / ratio });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [size.h, size.w]);

  /* Escape — хаах. Дэвсгэрийн гүйлтийг түгжинэ. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onCancel]);

  const placement = useMemo(
    () => (natural && frame ? placeCover({ width: natural.w, height: natural.h }, frame, crop) : null),
    [crop, frame, natural],
  );

  const distanceOf = (): number => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    (event.target as Element).setPointerCapture?.(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2)
      pinchStart.current = { distance: distanceOf(), zoom: crop.zoom };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !placement || !frame) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    // ── Хоёр хуруу: ойртуулах ──
    if (pointers.current.size === 2 && pinchStart.current) {
      const now = distanceOf();
      if (pinchStart.current.distance > 0) {
        const next = (pinchStart.current.zoom * now) / pinchStart.current.distance;
        setCrop((current) => normalizeCrop({ ...current, zoom: next }));
      }
      return;
    }

    // ── Нэг хуруу: чирэх ──
    setCrop((current) =>
      panCrop(
        current,
        placement,
        frame,
        event.clientX - previous.x,
        event.clientY - previous.y,
      ),
    );
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  };

  /*
   * Ойртуулахдаа ТӨВИЙГ хадгална.
   *
   * Гулсуураар томруулахад зураг зүүн дээд булан руугаа гүйвэл хэрэглэгч
   * тохируулсан хэсгээ дахин хайх болно. `cx`/`cy` нь хувь учир өөрчлөхгүй
   * орхиход харагдаж буй цэг байрандаа үлддэг.
   */
  const setZoom = (zoom: number) => setCrop((current) => normalizeCrop({ ...current, zoom }));

  return createPortal(
    /*
     * Дэвсгэр нь БҮРЭН тунгалаг бус. `bg-ink/95` үед доорх зураг сонгох цонхны
     * бичвэр цаанаас нь уншигдаж, «Хуруугаараа чирж байрлуулна» гэсэн заавар
     * дээр өөр өгүүлбэр давхарлан харагддаг байв — дэлгэцийн зураг дээр
     * илэрсэн. Тайрах үед хэрэглэгч зөвхөн зурагтаа анхаарах ёстой.
     */
    <div className="fixed inset-0 z-[70] flex flex-col bg-ink">
      {/* Толгой */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-3 text-white">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('nav.close')}
          className="-ml-1 grid size-9 place-items-center rounded-md hover:bg-white/10"
        >
          <IconClose className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{t('crop.title')}</p>
          <p className="truncate text-xs text-white/60">{size.label}</p>
        </div>
        <button
          type="button"
          onClick={() => setCrop(DEFAULT_CROP)}
          disabled={isDefaultCrop(crop)}
          className="rounded-md px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:opacity-40"
        >
          {t('crop.reset')}
        </button>
      </div>

      {/* Тайрах талбар */}
      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-4 py-1">
        {/* Дотоод давхарга нь ЯГ боломжит талбай — гадна талын зайг хэмжилтэд оруулахгүй. */}
        <div
          ref={stageRef}
          className="flex size-full max-w-[26rem] items-center justify-center"
        >
        <div
          data-testid="crop-frame"
          style={frame ? { width: `${frame.width}px`, height: `${frame.height}px` } : undefined}
          className="relative touch-none select-none overflow-hidden rounded-lg bg-black/40 shadow-2xl"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
          <img
            src={source}
            alt=""
            draggable={false}
            onLoad={(event) =>
              setNatural({
                w: event.currentTarget.naturalWidth,
                h: event.currentTarget.naturalHeight,
              })
            }
            style={
              placement
                ? {
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: `${placement.width}px`,
                    height: `${placement.height}px`,
                    /*
                     * ⚠️ Tailwind-ийн preflight нь `img { max-width: 100% }`
                     * гэж тавьдаг. Түүнийг цуцлахгүй бол ойртуулсан зураг
                     * хүрээний өргөнд ШАХАГДАНА: `width` нь 582px гэж бичигдсэн
                     * атал бодит өргөн 291px хэвээр үлдэж, зураг сунаж
                     * гажина. Гаднаас нь харахад «томруулах ажиллахгүй байна»
                     * гэж харагдана.
                     */
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(${placement.x}px, ${placement.y}px)`,
                  }
                : { opacity: 0 }
            }
          />

          {/*
            * Гуравны нэгийн тор — зөвхөн харааны туслах.
            * `pointer-events-none` тул чирэхэд саад болохгүй.
            */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
          </div>
        </div>
        </div>
      </div>

      {/* Хяналт */}
      <div
        className="shrink-0 px-4 pt-4 text-white"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto max-w-[min(88vw,26rem)]">
          <label className="flex items-center gap-3">
            <span className="text-xs font-semibold text-white/70">{t('crop.zoom')}</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.02}
              value={crop.zoom}
              aria-label={t('crop.zoom')}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/25 accent-white"
            />
            <span className="w-10 text-right text-xs font-bold tabular-nums">
              {crop.zoom.toFixed(1)}×
            </span>
          </label>

          <p className="mt-3 text-center text-xs leading-relaxed text-white/60">
            {t('crop.hint')}
          </p>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-md border border-white/25 py-2.5 text-sm font-semibold hover:bg-white/10"
            >
              {t('crop.cancel')}
            </button>
            <button
              type="button"
              onClick={() => onApply(crop)}
              className="btn-accent flex-1"
            >
              {t('crop.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
