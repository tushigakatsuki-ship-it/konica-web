/**
 * Зургийг сонгосон цаасны харьцаанд буулгах canvas хувиргалт.
 *
 * Хэрэглэгч гар аргаар тайрдаггүй — зураг үргэлж ТӨВӨӨРӨӨ, `object-fit: cover`
 * зарчмаар багтана. Preview дээр харагдаж буй зүйл хэвлэгдэх файлтай яг ижил
 * байхын тулд хоёулаа энэ нэг функцээр гардаг.
 *
 * ГҮЙЦЭТГЭЛ. Утсаар авсан 12MP зураг задлахад ~50MB битмап үүсдэг. Тиймээс:
 *   • `createImageBitmap` ашиглана — задлалт үндсэн урсгалаас гадуур явдаг тул
 *     интерфейс царцахгүй (`<img src>` бол үндсэн урсгал дээр задалдаг).
 *   • Ажил дуусмагц `close()` дуудаж санах ойг НЭН ДАРУЙ чөлөөлнө. GC хүлээвэл
 *     хэд хэдэн зураг сонгосон хямд утас унах эрсдэлтэй.
 *   • Задалсан зургийг хадгалдаггүй: preview-д жижиг data URL, захиалга
 *     илгээхэд эх `File`-аас дахин задална. Санах ойд том зураг үлдэхгүй.
 */

import { DEFAULT_ADJUST, cssFilterFor, type Adjust } from './adjust';
import { DEFAULT_CROP, placeCover, type Crop } from './crop';
import { PRINT_DPI, orientSize, type PhotoSize } from './photoSize';

/** `ImageBitmap` ба `HTMLImageElement` хоёулаа энэ хэлбэрт тохирно. */
type Source = CanvasImageSource & { width: number; height: number };

interface Decoded {
  source: Source;
  close(): void;
}

/** Хуучин Safari дээр `createImageBitmap` байхгүй бол ердийн замаар. */
const decodeViaElement = (blob: Blob): Promise<Decoded> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      resolve({
        source: image as unknown as Source,
        close: () => URL.revokeObjectURL(url),
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Зургийг уншиж чадсангүй.'));
    };
    image.src = url;
  });

export async function decodeImage(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, close: () => bitmap.close() };
    } catch {
      // HEIC гэх мэт дэмжигдээгүй формат — <img> дээр амжилттай болж магадгүй.
    }
  }
  return decodeViaElement(blob);
}

/**
 * Цаасны харьцаанд буулгасан canvas. `outW` нь эцсийн өргөн (px).
 *
 * Байрлалыг `placeCover` тооцоолно — дэлгэц дээрх тайрах цонх ЯГ ижил функцийг
 * ашигладаг тул хэрэглэгчийн харсан зүйл хэвлэгдэхтэйгээ таарна.
 */
const drawCover = (
  source: Source,
  size: PhotoSize,
  outW: number,
  crop: Crop = DEFAULT_CROP,
  adjust: Adjust = DEFAULT_ADJUST,
): HTMLCanvasElement | null => {
  const outH = Math.max(1, Math.round(outW * (size.h / size.w)));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Ил тод PNG хэвлэхэд хар болохоос сэргийлж цагаан дэвсгэр тавина.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingQuality = 'high';

  /*
   * Эргүүлсэн үед `placeCover`-т СОЛИСОН хэмжээ өгнө — тэр функц өөрчлөгдөхгүй,
   * зөвхөн оролт нь эргүүлсний дараах бодит харагдах хэмжээг илэрхийлнэ.
   * Дараа нь `at`-ийн ТӨВД нь эх зургийг (СОЛИГДООГҮЙ хэмжээгээр) зурж,
   * canvas-ийн трансформоор эргүүлнэ — ингэснээр байрлалын цорын ганц эх
   * сурвалж (`placeCover`) хэвээр үлдэнэ.
   */
  const rotate90 = adjust.rotate === 90 || adjust.rotate === 270;
  const effectiveSource = rotate90 ? { width: source.height, height: source.width } : source;
  const at = placeCover(effectiveSource, { width: outW, height: outH }, crop);

  const filter = cssFilterFor(adjust);
  ctx.save();
  if (filter) ctx.filter = filter;

  const cx = at.x + at.width / 2;
  const cy = at.y + at.height / 2;
  const drawW = rotate90 ? at.height : at.width;
  const drawH = rotate90 ? at.width : at.height;
  ctx.translate(cx, cy);
  if (adjust.rotate !== 0) ctx.rotate((adjust.rotate * Math.PI) / 180);
  ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas;
};

export interface PreviewResult {
  /** Жижиг JPEG data URL — интерфейст энэ л харагдана. */
  preview: string;
  /** Эх зургийн бодит нягтрал — сэрэмжлүүлэг харуулахад. */
  natural: { w: number; h: number };
}

/**
 * Сонгосон файлаас жижиг урьдчилсан харагдац.
 *
 * 640px өргөн хангалттай: хамгийн том нь ч 320px хайрцагт (2× дэлгэц) харагдана.
 * Эх файлыг DOM-д тавихгүй байгаагийн гол шалтгаан ч энэ — хөтөч 12MP зургийг
 * 260px хайрцагт харуулахын тулд бүтнээр нь задалж, санах ойд барьдаг.
 */
export async function renderPreview(
  blob: Blob,
  paper: PhotoSize,
  maxWidth = 640,
  crop: Crop = DEFAULT_CROP,
  adjust: Adjust = DEFAULT_ADJUST,
): Promise<PreviewResult> {
  const decoded = await decodeImage(blob);
  try {
    const natural = { w: decoded.source.width, h: decoded.source.height };
    /*
     * Хэвлэх файлтай ИЖИЛ дүрмээр эргүүлнэ — эс тэгвээс дэлгэц худал хэлнэ.
     * Хэрэглэгч 90°-аар эргүүлсэн бол цаасны чиглэлийг ЭРГҮҮЛСЭН ХАРАГДАХ
     * хэмжээгээр сонгоно, эх файлын түүхий чиглэлээр биш.
     */
    const rotate90 = adjust.rotate === 90 || adjust.rotate === 270;
    const effectiveNatural = rotate90
      ? { width: decoded.source.height, height: decoded.source.width }
      : decoded.source;
    const size = orientSize(paper, effectiveNatural);
    const outW = Math.min(maxWidth, Math.max(160, natural.w || maxWidth));
    const preview =
      drawCover(decoded.source, size, outW, crop, adjust)?.toDataURL('image/jpeg', 0.82) ?? '';
    return { preview, natural };
  } finally {
    decoded.close();
  }
}

/**
 * ТАЙРААГҮЙ, зөвхөн жижигрүүлсэн хувилбар — тайрах цонхонд зориулав.
 *
 * Тайрахын тулд хэрэглэгч зургийнхаа БҮХ хэсгийг харах ёстой. `renderPreview`
 * нь аль хэдийн тайрсан зураг өгдөг тул тэрийг ашиглавал тайрагдсан хэсэг рүү
 * буцаж очих боломжгүй болно.
 *
 * Энэ функц нь зөвхөн хэрэглэгч зураг дээр дархад л дуудагдана. Урьдчилж 30
 * зургийн тайраагүй хувилбар үүсгэвэл хямд утсанд хэдэн MB base64 дэмий
 * хуримтлагдана — тэр нь тайрах гэж огт бодоогүй хүнд ч тохиолдоно.
 */
export async function renderSource(blob: Blob, maxWidth = 1024): Promise<string> {
  const decoded = await decodeImage(blob);
  try {
    const { width, height } = decoded.source;
    const scale = Math.min(1, maxWidth / (width || maxWidth));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, outW, outH);

    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    decoded.close();
  }
}

/** Зургийн нягтрал хүрэхгүй бол хиймлээр томруулахгүй — энэ доод хязгаар хүртэл. */
const MIN_DPI = 150;

/**
 * Хэвлэхэд бэлэн файл — сонгосон хэмжээний ЯГ харьцаатай, 300dpi-д
 * тохирсон пикселтэй JPEG.
 *
 * Хиймэл томруулалт хийхгүй: эх зураг 300dpi хүрэхгүй бол байгаа нягтралаараа
 * (гэхдээ 150dpi-аас доошгүй) гаргана. Ингэснээр файл дэмий томордоггүй бөгөөд
 * бодит нарийвчлал ч нэмэгддэггүй — зөвхөн уншиж чадахуйц дүрс үүснэ.
 */
export async function renderPrintBlob(
  blob: Blob,
  paper: PhotoSize,
  crop: Crop = DEFAULT_CROP,
  adjust: Adjust = DEFAULT_ADJUST,
): Promise<Blob | null> {
  const decoded = await decodeImage(blob);
  try {
    /*
     * Цаасыг зургийн чиглэлд тохируулна — тайрахаас ӨМНӨ.
     *
     * `renderPreview` ч мөн адил хийдэг тул хэрэглэгчийн дэлгэц дээр харсан
     * хүрээ хэвлэгдэх файлтай яг таарна. Хоёрын нэгэнд нь мартвал дэлгэц
     * дээр бүтэн харагдаад, хэвлэхэд тал нь тасарна. 90°-аар эргүүлсэн бол
     * ЭРГҮҮЛСЭН ХАРАГДАХ хэмжээгээр (`effectiveNatural`) сонгоно.
     */
    const rotate90 = adjust.rotate === 90 || adjust.rotate === 270;
    const effectiveNatural = rotate90
      ? { width: decoded.source.height, height: decoded.source.width }
      : { width: decoded.source.width, height: decoded.source.height };
    const size = orientSize(paper, effectiveNatural);

    const target = Math.round((size.w / 2.54) * PRINT_DPI);
    const floor = Math.round((size.w / 2.54) * MIN_DPI);
    /*
     * Эх зургаас гарах бодит өргөн — `cover` тул богино талаараа хязгаарлагдана.
     *
     * Ойртуулсан бол харагдах хэсэг нь `zoom` дахин жижиг болно: 2× ойртуулбал
     * эх зургийн талыг л ашиглах тул боломжит нягтрал ч хоёр дахин буурна.
     * Үүнийг тооцохгүй бол canvas дутуу мэдээллийг хиймлээр сунгаж, файл
     * томорсон ч чанар нэмэгдэхгүй. `effectiveNatural`-г ашигладаг шалтгаан:
     * 90°-аар эргүүлсэн үед өргөн/өндөр СОЛИГДСОН тул тооцоо буруу тэнхлэгээр
     * хийгдэж, нягтралын доод хязгаар алдаатай гарахаас сэргийлнэ.
     */
    const available = Math.round(
      Math.min(effectiveNatural.width, effectiveNatural.height * (size.w / size.h)) /
        Math.max(1, crop.zoom),
    );
    const outW = Math.max(floor, Math.min(target, available || target));

    const canvas = drawCover(decoded.source, size, outW, crop, adjust);
    if (!canvas) return null;

    /*
     * JPEG чанар 0.95 — 0.92 БИШ.
     *
     * Хэмжсэн зөрүү: 10×15 зурагт 335KB → 367KB, ердөө +32KB. Эх файл нь
     * өөрөө ~1.7MB тул нийт илгээлт 1.5% л уртасна.
     *
     * Харин 0.92 дээр өндөр ялгарлын ирмэг (улаан үсэг цагаан дэвсгэр дээр,
     * тод хувцас, бичээс) дээр JPEG-ийн «цагираг» тод харагдаж байсан.
     * Хэвлэсний дараа тэр нь эргэж арилахгүй.
     */
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.95);
    });
  } finally {
    decoded.close();
  }
}
