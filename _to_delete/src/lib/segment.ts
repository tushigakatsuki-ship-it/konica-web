/**
 * Дэвсгэр салгах **порт** — U²-Net загвар браузер дотор.
 *
 * ── Яагаад сервер биш вэ ─────────────────────────────────────────
 *
 * Санал болгосон архитектур нь Python + FastAPI + GPU + дараалал байсан.
 * Гэвч дэвсгэр салгах загвар нь 4–7MB — браузерт багтана. Сервер сонговол:
 *
 *   • Үйлчлүүлэгчийн царай сервер рүү гарна (одоо огт гардаггүй)
 *   • GPU VPS сард $100–300
 *   • Дараалал, хадгалалт, ажиллагааны ачаалал
 *
 * Хариуд нь юу ч нэмэгдэхгүй: ижил загвар, ижил үр дүн. Тиймээс браузерт.
 *
 * ── Лиценз ───────────────────────────────────────────────────────
 *
 * U²-Net нь **Apache 2.0** — арилжаанд чөлөөтэй. Энэ нь санамсаргүй
 * сонголт биш: InsightFace-ийн бэлэн жин, CodeFormer, IDM-VTON зэрэг нь
 * ХУДАЛДААНЫ хэрэглээнд хориотой. Дэлгүүр бол худалдааны байгууллага тул
 * тэдгээрийг ашиглах эрхгүй.
 *
 * ── Заавал биш байдал ────────────────────────────────────────────
 *
 * Загварын файл байхгүй бол энэ модуль `null` буцаана — вэб хэвийн
 * ажиллаж, силуэтийн арга ажиллана. `onnxruntime-web` нь загвар БАЙВАЛ л
 * татагдана (динамик import), эс бөгөөс нэг ч байт нэмэгдэхгүй.
 *
 * Загвар суулгах: `public/models/u2netp.onnx` (README-г үз).
 */

/** Дэвсгэрийн маск буцаана: `255` = дэвсгэр, `0` = хүн. */
export type Segmenter = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => Promise<Uint8Array | null>;

export const MODEL_URL = '/models/u2netp.onnx';

/** U²-Net-ийн сургалтын оролтын хэмжээ. Өөрчилбөл чанар унана. */
export const INPUT_SIZE = 320;

/** ImageNet-ийн хэвийн утгууд — U²-Net үүгээр сурсан. */
const MEAN = [0.485, 0.456, 0.406] as const;
const STD = [0.229, 0.224, 0.225] as const;

/**
 * Зургийг загварын оролт болгоно: хэмжээ өөрчлөх → хэвийн болгох → NCHW.
 *
 * Хоёр шугаман (bilinear) томруулалтыг ГАРААР бичсэн — canvas ашиглавал
 * DOM хэрэгтэй болж, тест node дээр ажиллахгүй. Энэ нь мөн зөв: цөм нь
 * цэвэр функц байх ёстой.
 */
export function preprocess(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  size = INPUT_SIZE,
): Float32Array {
  const out = new Float32Array(3 * size * size);
  const plane = size * size;

  for (let y = 0; y < size; y += 1) {
    // Пикселийн ТӨВийг харгалзана — эс бөгөөс хагас пикселээр хазайна.
    const sy = Math.min(height - 1, Math.max(0, ((y + 0.5) * height) / size - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(height - 1, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < size; x += 1) {
      const sx = Math.min(width - 1, Math.max(0, ((x + 0.5) * width) / size - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(width - 1, x0 + 1);
      const fx = sx - x0;

      const i00 = (y0 * width + x0) * 4;
      const i01 = (y0 * width + x1) * 4;
      const i10 = (y1 * width + x0) * 4;
      const i11 = (y1 * width + x1) * 4;

      for (let c = 0; c < 3; c += 1) {
        const top = data[i00 + c] * (1 - fx) + data[i01 + c] * fx;
        const bottom = data[i10 + c] * (1 - fx) + data[i11 + c] * fx;
        const v = (top * (1 - fy) + bottom * fy) / 255;
        out[c * plane + y * size + x] = (v - MEAN[c]) / STD[c];
      }
    }
  }

  return out;
}

/**
 * Загварын гаралтыг дэвсгэрийн маск болгоно.
 *
 * Гурван алхам:
 *   1. **normPRED** — U²-Net-ийн албан ёсны код гаралтыг min–max-аар
 *      хэвийн болгодог. Үүнгүйгээр босго зураг болгонд өөр болно.
 *   2. **Урвуулах** — загвар нь ХҮНийг тэмдэглэдэг, бидэнд ДЭВСГЭР хэрэгтэй.
 *   3. **Буцааж томруулах** — 320×320-оос эх хэмжээ рүү хоёр шугамаар.
 */
export function postprocess(
  raw: Float32Array,
  size: number,
  width: number,
  height: number,
): Uint8Array {
  let min = Infinity;
  let max = -Infinity;
  for (const v of raw) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min;

  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const sy = Math.min(size - 1, Math.max(0, ((y + 0.5) * size) / height - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(size - 1, y0 + 1);
    const fy = sy - y0;

    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(size - 1, Math.max(0, ((x + 0.5) * size) / width - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(size - 1, x0 + 1);
      const fx = sx - x0;

      const norm = (i: number) => (span > 1e-6 ? (raw[i] - min) / span : 0);
      const top = norm(y0 * size + x0) * (1 - fx) + norm(y0 * size + x1) * fx;
      const bottom = norm(y1 * size + x0) * (1 - fx) + norm(y1 * size + x1) * fx;
      const person = top * (1 - fy) + bottom * fy;

      // Урвуулна: загвар хүнийг тэмдэглэсэн, бидэнд дэвсгэр хэрэгтэй.
      mask[y * width + x] = Math.round(255 * (1 - Math.min(1, Math.max(0, person))));
    }
  }

  return mask;
}

/* ── Загвар ачаалах ──────────────────────────────────────────────── */

type Session = {
  inputNames: readonly string[];
  outputNames: readonly string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array }>>;
};

let sessionPromise: Promise<Session | null> | null = null;

/**
 * Загварын файл ҮНЭХЭЭР байгаа эсэх.
 *
 * ⚠️ Өмнө нь энэ нь `fetch(MODEL_URL, {method:'HEAD'})` байсан бөгөөд
 * `head.ok`-ийг шалгадаг байв. Тэр нь SPA дээр ХЭЗЭЭ Ч ажиллахгүй:
 * `vercel.json` дотор `"source": "/((?!api/).*)"` гэсэн rewrite байгаа тул
 * `/models/u2netp.onnx` хүсэлт `index.html`-ийг **200 статустай** буцаадаг.
 * Улмаар `head.ok` үргэлж үнэн болж, `onnxruntime-web` татагдаж —
 * **25.6 MB WASM + 0.4 MB JS** — дараа нь HTML дээр задарч чадалгүй
 * чимээгүйхэн унана. Загвар суулгаагүй байхад ч хэрэглэгч бүр энэ 26 MB-ыг
 * дэмий татдаг байв.
 *
 * Одоо эхний 4 байтыг татаж, ONNX-ийн (protobuf) гарын үсгийг шалгана.
 * `index.html` нь `<` (0x3C) тэмдэгтээр эхэлдэг тул шууд илэрнэ.
 */
async function modelFilePresent(): Promise<boolean> {
  try {
    const probe = await fetch(MODEL_URL, { headers: { range: 'bytes=0-3' } });
    if (!probe.ok) return false;

    // HTML буцаасан бол энэ нь rewrite — загвар алга.
    const type = probe.headers.get('content-type') ?? '';
    if (type.includes('text/html')) return false;

    const head = new Uint8Array(await probe.arrayBuffer());
    if (head.length === 0) return false;

    /*
     * ONNX нь protobuf. Эхний байт нь талбарын шошго — бодит u2netp файл
     * `0x08` (ir_version) эсвэл `0x12`-ээр эхэлдэг. Хамгийн гол нь `<`
     * (HTML) болон `{` (JSON алдааны хариу) БИШ гэдгийг батлах явдал.
     */
    return head[0] !== 0x3c && head[0] !== 0x7b;
  } catch {
    return false;
  }
}

/**
 * Загварыг НЭГ УДАА ачаална.
 *
 * Файл байхгүй бол `onnxruntime-web`-ийг ОГТ татахгүй — динамик import хүртэл
 * хүрэхгүй. Ингэснээр загвар суулгаагүй дэлгүүрт нэмэлт байт очихгүй.
 */
async function loadSession(): Promise<Session | null> {
  try {
    if (!(await modelFilePresent())) return null;

    const ort = await import('onnxruntime-web');
    const session = await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    return session as unknown as Session;
  } catch {
    /*
     * Сүлжээ тасарсан, WASM дэмжигдээгүй, загвар эвдэрсэн — аль нь ч
     * ажилтныг зогсоох ёсгүй. Силуэтийн арга ажилласаар байна.
     */
    return null;
  }
}

/**
 * Загвар бэлэн эсэх — интерфейст «аль хөдөлгүүр ажиллав» гэж харуулна.
 *
 * Worker дотроос ч дуудагдана: `fetch` болон динамик `import` хоёулаа
 * тэнд ажилладаг тул нэмэлт заслага хэрэггүй.
 */
export function modelReady(): Promise<boolean> {
  sessionPromise ??= loadSession();
  return sessionPromise.then((s) => s !== null);
}

/**
 * ONNX-д тулгуурласан салгагч.
 *
 * Загвар байхгүй эсвэл алдаа гарвал `null` — дуудагч тал силуэт руу
 * буцна. Хэзээ ч алдаа шиднэ гэж бодох хэрэггүй.
 */
export const segmentWithModel: Segmenter = async (data, width, height) => {
  sessionPromise ??= loadSession();
  const session = await sessionPromise;
  if (!session) return null;

  try {
    const ort = await import('onnxruntime-web');
    const input = preprocess(data, width, height);
    const tensor = new ort.Tensor('float32', input, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    const result = await session.run({ [session.inputNames[0]]: tensor });
    const first = result[session.outputNames[0]];
    if (!first?.data) return null;

    return postprocess(first.data, INPUT_SIZE, width, height);
  } catch {
    return null;
  }
};
