import { presign, readR2Config } from './_r2';
import {
  PUT_EXPIRES_SEC,
  makeUploadId,
  uploadKey,
  validateUploadRequest,
} from './_files';
import { ValidationError, mongolianToday } from './_shared';

/**
 * POST /api/upload — зураг байршуулах түр зуурын хаягуудыг олгоно.
 *
 * ⚠️ Яагаад файлыг энэ function-оор дамжуулдаггүй вэ: Vercel-ийн хүсэлтийн бие
 * 4.5MB-аар хязгаарлагдсан бөгөөд утсаар авсан нэг зураг л ихэвчлэн үүнээс том.
 * Тиймээс сервер зөвхөн presigned URL үүсгэж, браузер R2 руу ШУУД PUT хийнэ.
 * Ингэснээр нууц түлхүүр серверт үлдэж, том файл ч дамжина.
 *
 * Түлхүүрийг ЗӨВХӨН сервер тодорхойлно — клиентээс ирсэн замд итгэвэл дурын
 * хүн бусдын зургийг дарж бичих боломжтой болно.
 */

export const config = { runtime: 'edge' };

/*
 * ⚠️ Хязгаар нь `order.ts`-ийнхаас ӨНДӨР байх ёстой: хэрэглэгч зургаа
 * сонгоод байршуулах хаяг авах бүрд энд ирдэг ч, захиалга нэг л удаа
 * илгээгддэг. Тэнцүү тавьвал байршуулалт нь захиалгаас өмнө хаагдана.
 *
 * 30 гэсэн тоо нь CGNAT-ыг тооцсон: Монголын операторууд олон хэрэглэгчийг
 * нэг нийтийн IP-ийн ард байрлуулдаг тул «нэг IP» ≠ «нэг хүн».
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear();
  return recent.length > MAX_PER_WINDOW;
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST')
    return json({ error: 'POST хүсэлт л хүлээн авна.' }, 405);

  const r2 = readR2Config(process.env as Record<string, string | undefined>);
  if (!r2) return json({ error: 'Зураг хүлээн авах сан тохируулагдаагүй байна.' }, 503);

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip))
    return json({ error: 'Хэт олон хүсэлт. Хэсэг хүлээгээд дахин оролдоно уу.' }, 429);

  let payload: unknown;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return json({ error: 'Өгөгдөл JSON биш байна.' }, 400);
  }

  let files;
  try {
    files = validateUploadRequest(payload);
  } catch (error) {
    if (error instanceof ValidationError) return json({ error: error.message }, 400);
    throw error;
  }

  const date = mongolianToday();
  const uploadId = makeUploadId();
  const now = new Date();

  const urls = await Promise.all(
    files.map(async (file, index) => {
      const key = uploadKey(date, uploadId, index, file.kind, file.ext);
      return { key, url: await presign(r2, 'PUT', key, PUT_EXPIRES_SEC, now) };
    }),
  );

  return json({ uploadId, date, expiresIn: PUT_EXPIRES_SEC, urls }, 200);
}
