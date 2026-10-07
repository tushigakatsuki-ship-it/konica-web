import { useEffect, useRef } from 'react';
import { drawMedal, type MedalPhoto } from '../lib/medalDraw';
import { DEFAULT_ADJUST, type MedalDesign, type PhotoAdjust } from '../lib/medal';

/**
 * Медалийн урьдчилсан харагдац.
 *
 * Зураглал нь `lib/medalDraw.ts` дотор — энэ компонент зөвхөн React ба
 * дэлгэцийн нягтралыг хариуцна.
 */

interface Props {
  design: MedalDesign;
  /** Голын зураг. `null` бол хоосон дугуй нүд харагдана. */
  photo: MedalPhoto | null;
  /**
   * Голын зургийн томруулалт, шилжилт.
   *
   * Өгөөгүй бол төвөөс нь дөрвөлжин тайрна — жижиг урьдчилсан харагдац
   * (загвар сонгох хавтан) энэ хэлбэрээр л ажиллана.
   */
  adjust?: PhotoAdjust;
  text: string;
  /** Доод нумын бичвэр — байгууллагын бүтэн нэр. */
  subText?: string;
  /** Он — голын зургийн доор, хэвтээ, улаанаар. */
  year?: string;
  /** Талын хэмжээ, пикселээр. Дэлгэцийн нягтралаар үржинэ. */
  size?: number;
  className?: string;
}

export default function MedalPreview({
  design,
  photo,
  adjust = DEFAULT_ADJUST,
  text,
  subText = '',
  year = '',
  size = 320,
  className = '',
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    /*
     * Retina дэлгэц дээр CSS пиксел ≠ төхөөрөмжийн пиксел. Үржүүлэхгүй
     * бол ирмэг, үсэг бүдгэрч, «хямд» харагдана.
     */
    const dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    drawMedal(ctx, { design, photo, adjust, text, subText, year, size });
  }, [design, photo, adjust, text, subText, year, size]);

  const label = [text, subText, year].map((s) => s.trim()).filter(Boolean).join(' · ');

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      className={className}
      role="img"
      aria-label={label === '' ? 'Медалийн загвар' : `Медалийн загвар, бичвэр: ${label}`}
    />
  );
}
