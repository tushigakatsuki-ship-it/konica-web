/**
 * Медалийн зураглал — canvas дээр.
 *
 * ── Яагаад React компонентоос ГАДНА вэ ──────────────────────────
 *
 * Энэ код нь дэлгүүрийн бүтээгдэхүүн ямар харагдахыг шийддэг: хээний
 * нягтрал, оны байрлал, нумын урт. `useEffect` дотор хоригдвол зөвхөн
 * хөтөч дээр л ажиллана — өөрөөр хэлбэл зөвхөн ГАРААР шалгаж болно.
 *
 * Тусад нь гаргаснаар headless canvas дээр зурж, гарсан зургийг
 * автоматаар шалгах боломжтой болно. `MedalPreview` нь зөвхөн React ба
 * дэлгэцийн нягтралыг хариуцна.
 */
import {
  CAP_HALF,
  DEFAULT_ADJUST,
  MAX_ARC,
  ORNAMENT_BAND,
  innerEdge,
  fitFontSize,
  layoutArcText,
  photoCrop,
  shapePoints,
  type ArcSide,
  type MedalDesign,
  type MedalShape,
  type PhotoAdjust,
} from './medal';

/** Голд тавих зураг — өргөн, өндрөө мэддэг байх ёстой (тайралт тооцно). */
export type MedalPhoto = CanvasImageSource & { width: number; height: number };

export interface MedalArt {
  design: MedalDesign;
  photo: MedalPhoto | null;
  adjust?: PhotoAdjust;
  /** Дээд нумын бичвэр. */
  text?: string;
  /** Доод нумын бичвэр — байгууллагын бүтэн нэр. */
  subText?: string;
  /** Он — зургийн доор, хэвтээ, улаанаар. */
  year?: string;
  /** Талын хэмжээ, CSS пикселээр. */
  size: number;
}

/**
 * Хэлбэрийн замыг зурна — дугуй эсвэл олон талт.
 *
 * ⚠️ Хэлбэрийг үл тоомсорловол `shape: 'hexagon'` загвар нь ЧИМЭЭГҮЙ
 * дугуй болж зурагдана: алдаа гарахгүй, зөвхөн буруу бүтээгдэхүүн
 * харагдана.
 */
const tracePath = (
  ctx: CanvasRenderingContext2D,
  shape: MedalShape,
  cx: number,
  cy: number,
  radius: number,
): void => {
  const points = shapePoints(shape, cx, cy, radius);
  ctx.beginPath();

  if (points.length === 0) {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    return;
  }

  ctx.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.closePath();
};

/**
 * Алхан хээний нэг давталт — дөрвөлжин OROOMOG.
 *
 * Нэгж дөрвөлжин дотор (`0…1`) өгсөн нь санамсаргүй биш: нэг л
 * тодорхойлолтыг 64px-ийн сонголтын картаас 320px-ийн урьдчилсан
 * харагдац хүртэл сунгаж хэрэглэнэ.
 */
const KEY_UNIT: readonly [number, number][] = [
  [0.1, 0.12],
  [0.9, 0.12],
  [0.9, 0.88],
  [0.32, 0.88],
  [0.32, 0.4],
  [0.66, 0.4],
  [0.66, 0.64],
];

/**
 * Ирмэгийн монгол алхан хээ.
 *
 * ── Яагаад хэсэг бүрийг ЭРГҮҮЛЖ зурдаг вэ ───────────────────────
 *
 * Хээ нь тойргийг дагаж муруйх ёстой. Цэг бүрийн туйлын координатыг
 * бодох нь боломжтой ч зам нь шулуун хэрчмүүдээс тогтдог тул муруй биш
 * ОЛОН ТАЛТ болж, ирмэгээс гарна. Оронд нь туузыг жижиг хэсэгт хувааж,
 * хэсэг бүрийг өөрийнх нь өнцгөөр эргүүлээд ХАВТГАЙ зурна.
 *
 * ── Яагаад дэвсгэрийг БУДАХГҮЙ вэ ───────────────────────────────
 *
 * Эхний хувилбар туузыг хөхөөр дүүргээд хээг цагаанаар зурсан нь бодит
 * бүтээгдэхүүнтэй ЭСРЭГ байв: шилэн медаль дээр дэвсгэр нь цагаан, хээ
 * нь хөх. Хөх цагираг нь медалийг «хүнд» харагдуулж, голын зургийг дарна.
 */
const drawOrnament = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  colour: string,
): void => {
  const outer = radius * ORNAMENT_BAND.outer;
  const inner = radius * ORNAMENT_BAND.inner;
  const width = outer - inner;
  if (!(width > 0)) return;

  const mid = (outer + inner) / 2;
  const hair = Math.max(0.5, width * 0.09);

  ctx.save();
  ctx.strokeStyle = colour;

  // Туузыг хүрээлэх хоёр нарийн шугам — хээг «зорчих эгнээнд» барина.
  ctx.lineWidth = hair;
  for (const r of [inner - width * 0.22, outer + width * 0.22]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  /*
   * ⚠️ Хэсгийн тоог ТОГТМОЛ болговол жижиг медальд хээ бүдүүн, томд нь
   * нарийн болно. Туузын өргөнтэй харьцуулж тооцвол хаана ч ижил.
   */
  const segments = Math.max(10, Math.round((Math.PI * 2 * mid) / (width * 1.5)));
  const step = (Math.PI * 2) / segments;
  const cell = step * mid * 0.82;

  ctx.lineWidth = Math.max(0.5, width * 0.13);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'butt';

  for (let i = 0; i < segments; i += 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2 + i * step);
    ctx.translate(0, -mid);

    ctx.beginPath();
    KEY_UNIT.forEach(([u, v], index) => {
      const x = -cell / 2 + u * cell;
      const y = -width / 2 + v * width;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
};

/**
 * Медалийг зурна. `ctx` нь аль хэдийн CSS пикселийн масштабтай байх ёстой.
 *
 * Зурах дараалал нь ЧУХАЛ: хавчаар → ирмэг → нүүр → тусгал → хээ →
 * голын зураг → нум → он. Зургийг бичвэрийн дараа зурвал бичвэрийг
 * халхлана.
 */
export function drawMedal(ctx: CanvasRenderingContext2D, art: MedalArt): void {
  const {
    design,
    photo,
    adjust = DEFAULT_ADJUST,
    text = '',
    subText = '',
    year = '',
    size,
  } = art;

  if (!(size > 0)) return;

  const cx = size / 2;
  const cy = size / 2;
  /*
   * Дээд хавчаарт зай үлдээнэ. Үгүй бол хавчаар нь canvas-ийн ирмэгээр
   * тасарч, медаль тайрагдсан мэт харагдана.
   */
  const radius = size / 2 - size * 0.06;

  /* ── 1. Ирмэг ба нүүр ──────────────────────────────────────── */
  /*
   * Дээд хавчаар (оосор холбогч).
   *
   * Бодит медаль бүр оосортой бөгөөд алтлаг хээтэй хавчаараар
   * холбогддог. Түүнгүйгээр зураг нь медаль биш, зүгээр л дугуй
   * шошго мэт харагдана — хэрэглэгч юу авах гэж байгаагаа таньж
   * чадахгүй.
   *
   * Медалийн ӨМНӨ зурна: доод хэсэг нь медалийн ард нуугдана.
   */
  if (design.hanger) {
    const clipW = radius * 0.34;
    const clipH = radius * 0.15;
    ctx.beginPath();
    ctx.roundRect(cx - clipW / 2, cy - radius - clipH * 0.7, clipW, clipH * 1.6, clipH * 0.4);
    ctx.fillStyle = '#c9a227';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy - radius - clipH * 0.05, clipH * 0.34, 0, Math.PI * 2);
    ctx.fillStyle = '#8a6f13';
    ctx.fill();
  }

  tracePath(ctx, design.shape, cx, cy, radius);
  ctx.fillStyle = design.rim;
  ctx.fill();

  tracePath(ctx, design.shape, cx, cy, radius * design.faceRadius);
  ctx.fillStyle = design.face;
  ctx.fill();

  /*
   * Шилэн медальд гэрлийн тусгал — материалыг ялгаж харуулах цорын
   * ганц дохио. Түүнгүйгээр шил, төмөр хоёр зөвхөн өнгөөрөө л ялгаатай
   * харагдана.
   */
  if (design.material === 'glass') {
    ctx.save();
    tracePath(ctx, design.shape, cx, cy, radius * design.faceRadius);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.3, cy - radius * 0.4, radius * 0.5, radius * 0.22, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.restore();
  }

  /*
   * Хээ — тусгалын ДАРАА. Өмнө нь зурвал хагас тунгалаг цагаан тусгал
   * хээг цайруулж, бүдэг болгоно.
   *
   * Зөвхөн ДУГУЙ хэлбэрт: тойрог хээ нь олон өнцөгтийн өнцөг дээр
   * ирмэгээс гарч, зүсэгдсэн мэт харагдана.
   */
  if (design.ornament && design.shape === 'circle') {
    drawOrnament(ctx, cx, cy, radius, design.ornament);
  }

  /* ── 2. Голын зураг ────────────────────────────────────────── */
  const photoR = radius * design.photoRadius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
  ctx.clip();

  if (photo) {
    /*
     * Дугуй нүдэнд сунгахгүй — эхлээд дөрвөлжин болгоно. Хэрэглэгчийн
     * томруулалт, шилжилтийг `photoCrop` хариуцна.
     */
    const crop = photoCrop(photo.width, photo.height, adjust);
    ctx.drawImage(
      photo,
      crop.sx,
      crop.sy,
      crop.size,
      crop.size,
      cx - photoR,
      cy - photoR,
      photoR * 2,
      photoR * 2,
    );
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(cx - photoR, cy - photoR, photoR * 2, photoR * 2);
  }
  ctx.restore();

  /*
   * ⚠️ Голын зурагт ХҮРЭЭ ЗУРАХГҮЙ.
   *
   * Өмнө нь зургийн ирмэгээр шугам татдаг байсан нь бодит
   * бүтээгдэхүүнтэй зөрж байв: шилэн медаль дээр зураг нь шууд
   * хэвлэгддэг тул ямар ч хүрээгүй, цагаан дэвсгэртэйгээ нийлдэг.
   * Урьдчилсан харагдац дээрх хиймэл цагираг нь захиалагчид «ийм
   * шугамтай гарна» гэсэн буруу ойлголт өгнө.
   */

  /* ── 3. Нумаар бичих ───────────────────────────────────────── */
  const textR = radius * design.textRadius;

  /*
   * ⚠️ `textRadius` бол үсгийн ТӨВ, ирмэг нь биш.
   *
   * Үсгийн дээд тал нь төвөөсөө `CAP_HALF`×фонт цааш гардаг. Үүнийг
   * тооцохгүй бол том фонт хээт туузан дээр — эсвэл олон өнцөгтийн
   * талын дунд хэсэгт ирмэгээс — гарна. Тестээр баригдахгүй, зөвхөн
   * харагдацаар мэдэгдэнэ.
   *
   * Хязгаар нь хоёрын аль ОЙРХОН нь: хээт тууз, эсвэл нүүрний ирмэг.
   * Олон өнцөгтөд ирмэг нь талын дундаараа хамгийн ойр (`innerEdge`).
   */
  const barrier = Math.min(
    design.ornament ? ORNAMENT_BAND.inner : Infinity,
    design.faceRadius * innerEdge(design.shape) * 0.97,
  );
  const ceiling = Math.max(8, (radius * barrier - textR) / CAP_HALF);

  /** Зурсан фонтын хэмжээ — он байрлуулахад хэрэгтэй. 0 бол юу ч зураагүй. */
  const drawArc = (raw: string, side: ArcSide): number => {
    const clean = raw.trim();
    if (clean === '') return 0;

    /*
     * ⚠️ `round` БИШ `floor`.
     *
     * Дээшээ дугуйруулбал тааз давж, үсэг ирмэгээс хагас пикселээр
     * гарна. Ганц пиксел өчүүхэн санагдавч сийлбэрийн эх дээр хээ,
     * үсэг хоёр хүрэлцэж, хэвлэхэд бохир харагдана.
     */
    let fontSize = Math.floor(Math.min(size * 0.082, ceiling));

    const widthsAt = (px: number) => {
      ctx.font = `700 ${px}px Inter, system-ui, sans-serif`;
      return [...clean].map((char) => ctx.measureText(char).width);
    };

    /*
     * Хоёр дамжлага: эхлээд хэмжиж нум тооцно, багтахгүй бол фонтыг
     * багасгаад ДАХИН хэмжинэ. Нэг дамжлагаар тооцвол багасгасан фонтын
     * бодит өргөнийг мэдэхгүй тул бичвэр дахин хэтэрч болно.
     */
    /*
     * Доод нум нь өргөн: байгууллагын бүтэн нэр тэндүүр явдаг. Дээд,
     * доодыг ижил хязгаараар барьвал урт нэр шаардлагагүй жижгэрнэ.
     */
    const maxArc =
      side === 'top'
        ? MAX_ARC.top
        : text.trim() === ''
          ? MAX_ARC.bottomAlone
          : MAX_ARC.bottom;

    let layout = layoutArcText(clean, widthsAt(fontSize), textR, maxArc, side);
    if (layout.overflow) {
      fontSize = fitFontSize(layout.span, maxArc, fontSize, Math.round(size * 0.035));
      layout = layoutArcText(clean, widthsAt(fontSize), textR, maxArc, side);
    }

    ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = design.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const glyph of layout.glyphs) {
      ctx.save();
      ctx.translate(cx + Math.cos(glyph.angle) * textR, cy + Math.sin(glyph.angle) * textR);
      ctx.rotate(glyph.rotation);
      ctx.fillText(glyph.char, 0, 0);
      ctx.restore();
    }

    return fontSize;
  };

  drawArc(text, 'top');
  const bottomFont = drawArc(subText, 'bottom');

  /* ── 4. Он — хэвтээ, голын зургийн доор ────────────────────── */
  const cleanYear = year.trim();
  if (cleanYear !== '') {
    /*
     * ⚠️ Оны байрлалыг ТААМАГЛАЖ болохгүй.
     *
     * Зураг ба доод нумын ХООРОНД тавина. Гэвч доод нумын фонт нь
     * бичвэрийн уртаас хамаарч автоматаар багасдаг — тогтмол зайгаар
     * тооцвол урт нэртэй үед он нумын үсэг рүү орж давхцана. Тиймээс
     * `drawArc`-ийн буцаасан бодит фонтоор чөлөөт зайг хэмжинэ.
     */
    const pad = size * 0.012;
    const top = photoR + pad;
    const floor = radius * design.textRadius - bottomFont * CAP_HALF - pad;
    const room = floor - top;

    if (room > size * 0.03) {
      ctx.font = `800 ${Math.round(Math.min(size * 0.075, room * 0.82))}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = design.subInk ?? design.ink;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cleanYear, cx, cy + (top + floor) / 2, photoR * 1.8);
    }
  }
}
