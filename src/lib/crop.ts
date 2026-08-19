/**
 * Гар аргаар тайрах загвар.
 *
 * ── Яагаад ийм гурван тоо вэ ─────────────────────────────────────
 *
 * Тайралтыг «пиксель тэгш өнцөгт» (x, y, w, h) хэлбэрээр хадгалах нь илүү
 * ойлгомжтой мэт боловч бодит хэрэглээнд эвдэрдэг: хэрэглэгч 640px-ийн
 * урьдчилсан харагдац дээр тайрдаг ч эцсийн файл 1181px-ээр гардаг. Пикселийг
 * дахин тооцоолох бүрд бөөрөнхийлөлтийн алдаа хуримтлагдаж, хэвлэсэн зураг
 * дэлгэцэн дээрхээсээ 1-2 пикселээр гулсдаг.
 *
 * Тиймээс НОРМАЛЧЛАГДСАН утга хадгална — ямар ч нягтралд ижилхэн ажиллана:
 *
 *   zoom  1-ээс эхэлнэ. 1 гэдэг нь «цаасыг яг дүүргэх хамгийн жижиг хэмжээ»
 *         (`object-fit: cover`). 2 бол хоёр дахин ойртуулсан.
 *   cx    0 = зүүн ирмэг, 0.5 = төв, 1 = баруун ирмэг.
 *   cy    0 = дээд ирмэг,  0.5 = төв, 1 = доод ирмэг.
 *
 * `cx`/`cy` нь ХИЛ ХООРОНДЫН ХУВЬ болохоос пикселийн байрлал биш. Ингэснээр
 * ямар ч утга [0,1] дотор байвал зураг хүрээнээс хэзээ ч гардаггүй — цагаан
 * зай үүсэх боломж алга.
 *
 * `DEFAULT_CROP` нь өнөөгийн зан төлөвтэй ЯГ ижил (төвөөр нь cover). Хуучин
 * сагсанд `crop` талбаргүй мөр байвал ч ижил үр дүн гарна.
 */

export interface Crop {
  /** ≥ 1. 1 = цаасыг яг дүүргэх хамгийн жижиг хэмжээ. */
  zoom: number;
  /** 0–1, хэвтээ байрлал. */
  cx: number;
  /** 0–1, босоо байрлал. */
  cy: number;
}

export const DEFAULT_CROP: Crop = { zoom: 1, cx: 0.5, cy: 0.5 };

/**
 * Хэт ойртуулах дээд хязгаар.
 *
 * 4-өөс цааш ойртуулах нь бараг үргэлж алдаа: 12MP зураг ч 4× дээр 300dpi-д
 * хүрэхээ болино. Хэрэглэгчид «болно» гэж хэлээд дараа нь бүдэг зураг өгөхөөс
 * эхнээс нь хязгаарласан нь шударга.
 */
export const MAX_ZOOM = 4;

const clamp = (value: number, low: number, high: number): number =>
  value < low ? low : value > high ? high : value;

/** Гаднаас ирсэн дурын утгыг аюулгүй болгоно (localStorage-оос уншсан ч байж болно). */
export const normalizeCrop = (crop: Partial<Crop> | null | undefined): Crop => {
  if (!crop) return DEFAULT_CROP;
  const zoom = Number.isFinite(crop.zoom) ? clamp(crop.zoom as number, 1, MAX_ZOOM) : 1;
  return {
    zoom,
    cx: Number.isFinite(crop.cx) ? clamp(crop.cx as number, 0, 1) : 0.5,
    cy: Number.isFinite(crop.cy) ? clamp(crop.cy as number, 0, 1) : 0.5,
  };
};

/** Хэрэглэгч огт хөндөөгүй юу — «Буцаах» товчийг идэвхгүй болгоход. */
export const isDefaultCrop = (crop: Crop): boolean =>
  crop.zoom === 1 && crop.cx === 0.5 && crop.cy === 0.5;

export interface Placement {
  /** Зурагдах өргөн, өндөр (гаралтын пикселээр). */
  width: number;
  height: number;
  /** Зүүн дээд буланг хаана тавих вэ. Сөрөг байх нь хэвийн — тэр хэсэг тайрагдана. */
  x: number;
  y: number;
}

/**
 * Эх зургийг гаралтын хүрээнд ХААНА, ЯМАР хэмжээтэй зурахыг тооцоолно.
 *
 * ЭНЭ функц нь canvas (хэвлэх файл) болон CSS `transform` (дэлгэц дээрх
 * урьдчилсан харагдац) ХОЁУЛАНГ нь тэжээнэ. Хоёр газар өөр өөр томьёо бичвэл
 * хэрэглэгчийн харсан тайралт хэвлэгдсэнээсээ ялгаатай болох нь цаг хугацааны
 * асуудал — тиймээс ганц эх сурвалжтай байлгав.
 */
export const placeCover = (
  source: { width: number; height: number },
  frame: { width: number; height: number },
  crop: Crop = DEFAULT_CROP,
): Placement => {
  const safe = normalizeCrop(crop);

  // Зургийг хүрээнд БАГТААХГҮЙ, ДҮҮРГЭНЭ — тиймээс `max`.
  const scale =
    Math.max(frame.width / (source.width || 1), frame.height / (source.height || 1)) *
    safe.zoom;

  const width = source.width * scale;
  const height = source.height * scale;

  /*
   * `frame - draw` нь сөрөг тоо (илүүдэл хэсэг). Түүнийг 0–1 хувиар үржүүлбэл:
   *   cx = 0   → x = 0            (зүүн ирмэг хүрээний зүүнд)
   *   cx = 0.5 → x = илүүдлийн тал (төв — өнөөгийн зан төлөв)
   *   cx = 1   → x = илүүдэл бүтэн (баруун ирмэг хүрээний баруунд)
   * Гурвуулаа хүрээг бүрэн дүүргэсэн хэвээр.
   */
  /*
   * `+ 0` нь `-0`-ыг `0` болгоно. Тооцоонд ялгаагүй ч `Object.is(-0, 0)` худал
   * тул тест, харьцуулалт, тэмдэглэл дээр гэнэтийн зөрүү үүсгэдэг.
   */
  return {
    width,
    height,
    x: (frame.width - width) * safe.cx + 0,
    y: (frame.height - height) * safe.cy + 0,
  };
};

/**
 * Дэлгэц дээр чирэхэд шинэ `cx`/`cy` тооцоолно.
 *
 * `dx`/`dy` нь хуруу хэдэн ПИКСЕЛЬ хөдөлснийг заана. Илүүдэл хэсэг бага байх
 * тусам ижил хөдөлгөөн илүү их хувь эзэлдэг тул хуваалт нь илүүдлээр явна.
 * Илүүдэл 0 (яг таарсан тал) бол тэр тэнхлэгээр хөдлөх зүйл алга.
 */
export const panCrop = (
  crop: Crop,
  placement: Placement,
  frame: { width: number; height: number },
  dx: number,
  dy: number,
): Crop => {
  const spareX = placement.width - frame.width;
  const spareY = placement.height - frame.height;

  return normalizeCrop({
    zoom: crop.zoom,
    // Хуруу баруун тийш хөдлөхөд зураг баруун тийш — өөрөөр хэлбэл ЗҮҮН хэсэг
    // харагдана, тиймээс `cx` буурна.
    cx: spareX > 0.5 ? crop.cx - dx / spareX : crop.cx,
    cy: spareY > 0.5 ? crop.cy - dy / spareY : crop.cy,
  });
};
