import {
  ValidationError,
  alertText,
  buildOrder,
  mongolianToday,
  numberWorkLogs,
} from './_shared';
import {
  isDateStamp,
  isUploadId,
  manifestKey,
  validateManifestFiles,
  type ManifestFile,
  type WebOrderManifest,
} from './_files';
import { putObject, readR2Config } from './_r2';
import { pendingPayment, readBankInstructions } from './_payment';
import { createInvoice, readQPayConfig, type QPayInvoice } from './_qpay';
import { notify } from './_notify';

/**
 * POST /api/order — вэбийн захиалгыг native app-ын Firebase руу бичнэ.
 *
 * ⚠️ Яагаад function хэрэгтэй вэ: `RTDB_AUTH` бол Firebase-ийн database secret,
 * өөрөөр хэлбэл бүрэн admin эрх. Үүнийг browser bundle-д хийвэл сайт нээсэн хэн
 * ч DevTools-оос уншиж аваад `pmn` доторх бүхнийг — ажилтны PIN, орлого, чат —
 * харах, устгах боломжтой болно. Тиймээс token зөвхөн энд, серверийн орчинд
 * амьдарна.
 */

export const config = { runtime: 'edge' };

const RTDB_URL = (
  process.env.RTDB_URL ?? 'https://printmn-c0d28-default-rtdb.firebaseio.com/pmn'
).replace(/\/$/, '');
const RTDB_AUTH = process.env.RTDB_AUTH ?? '';
const REQUEST_TIMEOUT_MS = 15_000;
/** 60 файлын мэдээлэл ~15KB. Зураг өөрөө энд ирдэггүй (`/api/upload`-ыг үз). */
const MAX_BODY_BYTES = 64_000;

/**
 * Хамгийн энгийн урсгал хязгаарлалт.
 *
 * Edge instance бүр өөрийн санах ойтой тул энэ нь баталгаа биш — зүгээр л
 * нэг IP-ээс секунд тутам хэдэн зуун захиалга ирэхээс сэргийлнэ. Жинхэнэ
 * хамгаалалт хэрэгтэй бол Upstash Redis эсвэл Vercel Firewall хэрэглэнэ.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear(); // санах ой хязгааргүй өсөхөөс сэргийлнэ
  return recent.length > MAX_PER_WINDOW;
}

/**
 * Давхар захиалгаас хамгаалах (idempotency).
 *
 * Бодит тохиолдол: хэрэглэгч «Илгээх» дараад сүлжээ нь удаашрахад дахин дардаг,
 * эсвэл гар утас сүлжээгээ солиход хүсэлт нь хоёр удаа очдог. Хамгаалалтгүй бол
 * ижил захиалга Firebase-д ХОЁР удаа бичигдэж, өдрийн касс, ажлын самбар
 * хоёулаа давхардана — ажилтан хоёр удаа хэвлэх эрсдэлтэй.
 *
 * Клиент оролдлого бүрт нэг `requestId` үүсгэж, дахин илгээхдээ ижлийг явуулна.
 * Сервер тухайн id-г аль хэдийн боловсруулсан бол ШИНЭ захиалга үүсгэхгүй,
 * өмнөх хариугаа буцаана.
 *
 * ⚠️ Edge instance бүр өөрийн санах ойтой тул энэ нь бүрэн баталгаа биш —
 * хоёр хүсэлт өөр instance рүү унавал хамгаалахгүй. Гэхдээ хамгийн түгээмэл
 * тохиолдол (нэг хэрэглэгч хэдхэн секундын дотор дахин дарах) нь ихэвчлэн нэг
 * instance дээр буудаг. Бүрэн баталгаа хэрэгтэй бол Upstash Redis.
 */
const IDEMPOTENCY_TTL_MS = 10 * 60_000;
const seen = new Map<string, { at: number; body: unknown }>();

const rememberedResponse = (requestId: string): unknown | null => {
  const hit = seen.get(requestId);
  if (!hit) return null;
  if (Date.now() - hit.at > IDEMPOTENCY_TTL_MS) {
    seen.delete(requestId);
    return null;
  }
  return hit.body;
};

const remember = (requestId: string, body: unknown): void => {
  if (!requestId) return;
  seen.set(requestId, { at: Date.now(), body });
  if (seen.size > 2_000) seen.clear();
};

/** `req_` угтвартай 8–64 тэмдэгт — клиентээс ирсэн дурын мөрөнд итгэхгүй. */
const isRequestId = (value: unknown): value is string =>
  typeof value === 'string' && /^[\w-]{8,64}$/.test(value);

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

/**
 * Өнөөдөр бүртгэгдсэн worklog-ийн тоо — шинэ мөрийн `no` дугаар үүнээс эхэлнэ.
 *
 * `workLogLogic.ts → newestFirst` эхлээд `no`-гоор эрэмбэлдэг тул дугааргүй мөр
 * жагсаалтын доод талд ороод, ажилтан шинэ захиалгыг олж харахгүй өнгөрөх эрсдэлтэй.
 *
 * `date` талбар нь rules дээр `.indexOn`-той тул асуулт хямд. Уналт нь захиалгыг
 * унагах шалтгаан биш — `null` буцаавал зүгээр л дугаарлахгүй.
 *
 * Хоёр захиалга зэрэг ирвэл ижил `no` авч болзошгүй. Апп өөрөө ч яг ийм
 * тооллоор дугаарладаг (`buildQuickOrder`) тул шинэ эрсдэл нэмэгдэхгүй, эрэмбэ
 * нь id руу шилжинэ.
 */
async function countTodaysLogs(now: Date): Promise<number | null> {
  const today = mongolianToday(now);
  const url =
    `${RTDB_URL}/worklogs.json?auth=${encodeURIComponent(RTDB_AUTH)}` +
    `&orderBy=${encodeURIComponent('"date"')}&equalTo=${encodeURIComponent(`"${today}"`)}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const rows = (await response.json()) as Record<string, unknown> | null;
    return rows ? Object.keys(rows).length : 0;
  } catch {
    return null;
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST')
    return json({ error: 'POST хүсэлт л хүлээн авна.' }, 405);

  if (!RTDB_AUTH)
    return json({ error: 'Сервер тохируулагдаагүй байна.' }, 503);

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip))
    return json({ error: 'Хэт олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.' }, 429);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES)
    return json({ error: 'Захиалга хэт том байна.' }, 413);

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: 'Өгөгдөл JSON биш байна.' }, 400);
  }

  /*
   * Давтагдсан хүсэлтийг ЭХЛЭЭД шалгана — баталгаажуулалт, Firebase рүү
   * хандахаас ч өмнө. Ингэснээр давхар дарсан хүсэлт огт ажил үүсгэхгүй.
   */
  const rawRequestId = (payload as { requestId?: unknown })?.requestId;
  const requestId = isRequestId(rawRequestId) ? rawRequestId : '';
  if (requestId) {
    const previous = rememberedResponse(requestId);
    if (previous) return json(previous, 201);
  }

  const now = new Date();
  let built;
  let files: ManifestFile[] = [];
  const upload = (payload as { uploadId?: unknown; date?: unknown }) ?? {};
  const uploadId = typeof upload.uploadId === 'string' ? upload.uploadId : '';
  const uploadDate = typeof upload.date === 'string' ? upload.date : '';

  try {
    built = buildOrder(payload, now);
    if (uploadId || uploadDate) {
      if (!isUploadId(uploadId) || !isDateStamp(uploadDate))
        throw new ValidationError('Байршуулалтын мэдээлэл буруу байна.');
      files = validateManifestFiles(
        (payload as { files?: unknown }).files,
        uploadDate,
        uploadId,
      );
    }
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  // Тоолол нь баталгаажуулалтын ДАРАА — хог өгөгдөлд Firebase рүү хандахгүй.
  numberWorkLogs(built, await countTodaysLogs(now));

  /**
   * Зурагтай захиалгыг апп дээр ялгаж харуулна.
   *
   * Ажилтан worklog-оос шууд "энэ захиалгад файл байна" гэдгийг мэдэхгүй бол
   * admin хуудсыг шалгахаа мартаж, хэвлэх зураггүй үлдэх эрсдэлтэй.
   */
  const photoCount = files.filter((f) => f.kind === 'print').length;
  if (photoCount > 0) {
    for (const log of Object.values(built.worklogs)) {
      log.note = `${log.note} 🖼 ${photoCount} зураг вэбээр ирсэн`.trim();
    }
  }

  /**
   * Нэг PATCH-аар олон замыг зэрэг бичнэ.
   *
   * Order болон WorkLog хоёрыг тусад нь PUT хийвэл эхнийх нь амжилттай,
   * дараагийнх нь унах боломжтой — тэгвэл орлого бүртгэгдэхгүй үлдэнэ.
   * Multi-path update нь атомик тул ийм хагас төлөв үүсэхгүй.
   */
  const updates: Record<string, unknown> = {};
  for (const [id, order] of Object.entries(built.orders)) updates[`orders/${id}`] = order;
  for (const [id, log] of Object.entries(built.worklogs)) updates[`worklogs/${id}`] = log;

  let response: Response;
  try {
    response = await fetch(
      `${RTDB_URL}/.json?auth=${encodeURIComponent(RTDB_AUTH)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(updates),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );
  } catch {
    return json({ error: 'Сервер рүү холбогдож чадсангүй. Дахин оролдоно уу.' }, 502);
  }

  if (!response.ok) {
    // 401/403 нь сүлжээний асуудал биш — rules татгалзсан гэсэн үг, дахин
    // оролдоод ашиггүй тул хэрэглэгчид өөр зөвлөгөө өгнө.
    const denied = response.status === 401 || response.status === 403;
    return json(
      {
        error: denied
          ? 'Захиалга хадгалагдсангүй. Утсаар холбогдоно уу.'
          : 'Түр зуурын алдаа гарлаа. Дахин оролдоно уу.',
      },
      denied ? 500 : 502,
    );
  }

  const customer = (
    payload as {
      customer: { name: string; phone: string; email?: string; note?: string };
    }
  ).customer;
  const name = customer.name.trim();
  const phone = customer.phone.trim();

  /**
   * Зургийн manifest-ыг R2 руу бичнэ.
   *
   * Яагаад Firebase биш вэ: native app-ын `database.rules.json` нь бидний
   * мэдэлд байдаггүй тул шинэ зангилаа нэмэх нь rules-ээс татгалзах эрсдэлтэй.
   * Мөн зураг өөрөө R2-д байгаа тул индексийг нь тэндээ хадгалах нь нэг
   * эх сурвалжтай, хямд бөгөөд admin хуудсанд хангалттай.
   *
   * Захиалга АЛЬ ХЭДИЙН хадгалагдсан тул энд алдаа гарлаа ч 201 буцаана —
   * хэрэглэгчийг дахин илгээхэд хүргэвэл орлого давхардана.
   */
  const env = process.env as Record<string, string | undefined>;
  const r2 = readR2Config(env);

  /**
   * Зургийн төлөв гурван утгатай:
   *   `none`        — зураггүй захиалга
   *   `saved`       — зураг санд орж, manifest бичигдсэн
   *   `unavailable` — сан тохируулаагүй эсвэл бичилт унасан
   *
   * `unavailable` нь АЛДАА биш: сан хараахан холбогдоогүй байхад ч захиалга
   * хэвийн үүсэх ёстой. Ажилтан хэрэглэгч рүү залгаж зургийг нь өөр замаар
   * авна. Ингэснээр R2/NAS-ыг хожим асаах хүртэл вэб бүрэн ажиллана.
   */
  let photos: 'none' | 'saved' | 'unavailable' = files.length === 0 ? 'none' : 'saved';
  let invoice: QPayInvoice | null = null;

  /*
   * Дансны заавар нь ямар ч сангаас хамаардаггүй тул ҮРГЭЛЖ буцна —
   * зураггүй захиалганд ч, R2 унтарсан үед ч хэрэглэгч төлж чадна.
   */
  const bank = readBankInstructions(env, built.orderNumber, built.total);

  if (files.length > 0) {
    if (!r2) {
      photos = 'unavailable';
    } else {
      const payment = pendingPayment(built.total);

      /*
       * QPay нэхэмжлэлийг manifest бичихээс ӨМНӨ үүсгэнэ — `invoiceId`-г
       * manifest дотор хадгалах ёстой, эс тэгвээс callback ирэхэд аль
       * нэхэмжлэлийн тухай яриад байгааг шалгах аргагүй болно.
       */
      const qpay = readQPayConfig(env);
      if (qpay) {
        const origin = new URL(request.url).origin;
        invoice = await createInvoice(qpay, {
          orderNumber: built.orderNumber,
          amount: built.total,
          description: `Printmn ${built.orderNumber}`,
          receiver: phone,
          callbackUrl:
            `${origin}/api/qpay-callback` +
            `?order=${encodeURIComponent(built.orderNumber)}` +
            `&date=${encodeURIComponent(uploadDate)}&u=${encodeURIComponent(uploadId)}`,
        });
        if (invoice) {
          payment.method = 'qpay';
          payment.invoiceId = invoice.invoiceId;
        }
      }

      const manifest: WebOrderManifest = {
        orderNumber: built.orderNumber,
        uploadId,
        date: uploadDate,
        createdAt: now.getTime(),
        customer: {
          name,
          phone,
          email: (customer.email ?? '').trim(),
          note: (customer.note ?? '').trim(),
        },
        total: built.total,
        lines: built.lines.map((l) => ({ name: l.name, qty: l.qty, total: l.total })),
        files,
        payment,
      };
      try {
        if (
          !(await putObject(
            r2,
            manifestKey(uploadDate, built.orderNumber, uploadId),
            JSON.stringify(manifest),
          ))
        ) {
          photos = 'unavailable';
        }
      } catch {
        photos = 'unavailable';
      }
    }
  }

  const photoLine =
    photos === 'none'
      ? ''
      : photos === 'saved'
        ? `\n🖼 ${photoCount} зураг — ⏳ төлбөр хүлээгдэж байна`
        : `\n⚠️ ${photoCount} зураг ирсэн ч сан руу орсонгүй — утсаар холбогдоно уу`;

  await notify(alertText(built, name, phone) + photoLine);

  const body = {
    orderNumber: built.orderNumber,
    total: built.total,
    photos,
    payment: {
      amount: built.total,
      qpay: invoice,
      bank,
      /**
       * Төлбөрийн төлвийг автоматаар хянах «түлхүүр».
       *
       * `uploadId` нь 16 тэмдэгт санамсаргүй мөр — хэрэглэгч түүгээрээ
       * `/api/payment` дээр төлвөө шалгана. Мөн `/zakhialga/<дугаар>` төлөв
       * хуудсанд буцаж орох линкийг үүнээс угсарна. Manifest байхгүй бол
       * хянах зүйл ч байхгүй тул `null`.
       */
      tracking: photos === 'saved' ? { date: uploadDate, uploadId } : null,
    },
  };

  remember(requestId, body);
  return json(body, 201);
}
