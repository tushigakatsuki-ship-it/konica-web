import { useTilt } from '../lib/useTilt';

/**
 * Хэвлэмэл зургийн 3D загвар.
 *
 * ── Яагаад хэрэгтэй вэ ───────────────────────────────────────────
 *
 * Хавтгай preview нь «энэ зураг тайрагдах уу» гэдэгт л хариулна.
 * Хэрэглэгчийн жинхэнэ асуулт нь «би юу гартаа авах вэ» — цаасны
 * зузаан, ирмэг, гялбаа. Тэднийг харуулсан нь захиалахад итгэл өгнө.
 *
 * ── Хямд шийдэл ──────────────────────────────────────────────────
 *
 * Жинхэнэ WebGL биет үүсгэх шаардлагагүй. Гурван зүйл хангалттай:
 * зузааны хуурамч давхарга, хазайлт дагасан сүүдэр, гүйдэг тусгал.
 * Three.js нэмбэл багц гурав дахин томрох ч ялгаа нь бараг мэдэгдэхгүй.
 *
 * JS ажиллаагүй, эсвэл хэрэглэгч хөдөлгөөн хүсээгүй бол хавтгай,
 * зөв харагдана — `--tilt-*` анхдагч утга нь 0.
 */

interface Props {
  src: string;
  alt: string;
  /** Цаасны харьцаа — `10/15` гэх мэт. */
  ratio?: number;
  className?: string;
}

export default function PrintPreview3D({ src, alt, ratio, className = '' }: Props) {
  const stage = useTilt<HTMLDivElement>();

  return (
    <div ref={stage} className={`stage ${className}`}>
      <div className="stage-face">
        <div className="print-card overflow-hidden">
          <img
            src={src}
            alt={alt}
            style={ratio ? { aspectRatio: String(ratio) } : undefined}
            className="block w-full object-cover"
          />
        </div>
      </div>
    </div>
  );
}
