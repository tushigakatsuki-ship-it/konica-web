import { useTilt } from '../lib/useTilt';

/**
 * Медалийн 3D загвар — хэрэглэгчийн зураг алтан медаль ДОТОР.
 *
 * ── Яагаад хэрэгтэй вэ ───────────────────────────────────────────
 *
 * Медаль захиалж буй хүн «миний лого тэр дээр ямар харагдах вэ» гэдгийг
 * мэдэхийг хүсдэг. Хавтгай зураг харуулах нь тэр асуултад хариулахгүй —
 * лого нь цаасан дээр биш, ГЯЛГАР МЕТАЛ дээр гарна. Тиймээс метал ирмэг,
 * гүн, гэрлийн ойлтыг үзүүлсэн нь захиалахад итгэл өгнө.
 *
 * ── Хямд шийдэл ──────────────────────────────────────────────────
 *
 * `PrintPreview3D`-тэй ЯГ ижил зарчим: жинхэнэ WebGL биет хэрэггүй.
 * `conic-gradient` (метал), заагч дагасан хазайлт, гүйдэг гялбаа гурав
 * хангалттай. three.js нэмбэл багц ~150KB томрох ч ялгаа нь энэ хэмжээнд
 * бараг мэдэгдэхгүй.
 *
 * Хөдөлгөөн нь ХОЁР эх сурвалжтай: заагчтай төхөөрөмж дээр `useTilt`
 * (хулгана дагаж хазайна), утсан дээр CSS-ийн `medal-shine` (гялбаа
 * өөрөө гүйнэ). Хоёулангийнх нь анхдагч төлөв нь зөв харагдац тул JS
 * ажиллаагүй ч, хөдөлгөөн хумисан хэрэглэгчид ч эвдрэхгүй.
 */

interface Props {
  /** Хэрэглэгчийн оруулсан зураг эсвэл лого. */
  src: string;
  alt: string;
  /** Оосор харуулах эсэх. Үүнгүй бол медаль зоос мэт харагдана. */
  ribbon?: boolean;
  className?: string;
}

export default function MedalPreview3D({ src, alt, ribbon = true, className = '' }: Props) {
  const stage = useTilt<HTMLDivElement>();

  return (
    <div ref={stage} className={`stage ${className}`}>
      <div className="stage-face">
        {/* Найгалт нь хазайлтаас ТУСДАА давхаргад — хоёулаа `transform` эзэмдэнэ. */}
        <div className="medal-swing flex flex-col items-center">
          {ribbon && <div className="medal-ribbon" />}
          <div className="medal-disc w-full">
            <div className="medal-window">
              <img src={src} alt={alt} className="size-full object-cover" draggable={false} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
