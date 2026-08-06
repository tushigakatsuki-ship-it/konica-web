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
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';

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

/** Telegram мэдэгдэл амжилтгүй болсон ч захиалга хадгалагдсан хэвээр байна. */
async function notify(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: 'HTML' }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    // best-effort
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
  let manifestSaved = true;
  if (files.length > 0) {
    const r2 = readR2Config(process.env as Record<string, string | undefined>);
    if (!r2) {
      manifestSaved = false;
    } else {
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
      };
      try {
        manifestSaved = await putObject(
          r2,
          manifestKey(uploadDate, built.orderNumber, uploadId),
          JSON.stringify(manifest),
        );
      } catch {
        manifestSaved = false;
      }
    }
  }

  const photoLine =
    files.length === 0
      ? ''
      : manifestSaved
        ? `\n🖼 ${photoCount} зураг — /admin дээрээс тат`
        : '\n⚠️ Зураг ирсэн ч бүртгэгдсэнгүй — утсаар холбогдоно уу';

  await notify(alertText(built, name, phone) + photoLine);

  return json(
    { orderNumber: built.orderNumber, total: built.total, filesSaved: manifestSaved },
    201,
  );
}
