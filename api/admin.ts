import {
  GET_EXPIRES_SEC,
  parseManifestKey,
  type WebOrderManifest,
} from './_files';
import { getObject, listKeys, presign, putObject, readR2Config } from './_r2';

/**
 * /api/admin — ажилтны хуудсыг тэжээнэ.
 *
 *   GET  ?days=7   → сүүлийн захиалгууд + зураг татах түр линкүүд
 *   POST {action:'mark', manifestKey, printed} → хэвлэсэн гэж тэмдэглэх
 *
 * ⚠️ Нэвтрэлт: `x-admin-token` толгой нь `ADMIN_TOKEN`-той таарах ёстой.
 * Зөвхөн энэ function л R2-ийн түлхүүрийг мэднэ — браузер нь зөвхөн 1 цаг
 * амьдардаг presigned линк хүлээж авна. Тиймээс линк алдагдсан ч бүхэл сан
 * задрахгүй.
 */

export const config = { runtime: 'edge' };

const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/**
 * Тогтмол хугацаатай харьцуулалт.
 *
 * `a === b` нь эхний зөрүү дээр шууд зогсдог тул хариу ирэх хугацаагаар
 * токеныг тэмдэгт тэмдэгтээр нь таах онолын боломж үлддэг.
 */
const sameToken = (given: string, expected: string): boolean => {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
};

/** Улаанбаатарын огноогоор сүүлийн `days` өдрийн `YYYY-MM-DD` жагсаалт. */
const recentDates = (days: number, now = new Date()): string[] => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return Array.from({ length: days }, (_, i) =>
    formatter.format(new Date(now.getTime() - i * 86_400_000)),
  );
};

export default async function handler(request: Request): Promise<Response> {
  if (!ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN тохируулаагүй байна.' }, 503);

  const given = request.headers.get('x-admin-token') ?? '';
  if (!sameToken(given, ADMIN_TOKEN)) return json({ error: 'Нууц үг буруу байна.' }, 401);

  const r2 = readR2Config(process.env as Record<string, string | undefined>);
  if (!r2) return json({ error: 'Зургийн сан тохируулагдаагүй байна.' }, 503);

  // ── Хэвлэсэн гэж тэмдэглэх ───────────────────────────────────────
  if (request.method === 'POST') {
    let body: { action?: string; manifestKey?: string; printed?: boolean };
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'Өгөгдөл JSON биш байна.' }, 400);
    }

    const key = String(body.manifestKey ?? '');
    if (body.action !== 'mark' || !parseManifestKey(key))
      return json({ error: 'Хүсэлт буруу байна.' }, 400);

    const raw = await getObject(r2, key);
    if (!raw) return json({ error: 'Захиалга олдсонгүй.' }, 404);

    const manifest = JSON.parse(raw) as WebOrderManifest;
    if (body.printed) manifest.printedAt = Date.now();
    else delete manifest.printedAt;

    const ok = await putObject(r2, key, JSON.stringify(manifest));
    return ok
      ? json({ printedAt: manifest.printedAt ?? null }, 200)
      : json({ error: 'Хадгалж чадсангүй.' }, 502);
  }

  if (request.method !== 'GET') return json({ error: 'GET эсвэл POST.' }, 405);

  // ── Захиалгуудыг жагсаах ─────────────────────────────────────────
  const url = new URL(request.url);
  const days = Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7));

  const keys = (
    await Promise.all(
      recentDates(days).map((date) => listKeys(r2, `manifests/${date}/`, 200)),
    )
  ).flat();

  const manifests = (
    await Promise.all(
      keys.map(async (key) => {
        const raw = await getObject(r2, key);
        if (!raw) return null;
        try {
          const manifest = JSON.parse(raw) as WebOrderManifest;
          const files = await Promise.all(
            manifest.files.map(async (file) => ({
              ...file,
              url: await presign(r2, 'GET', file.key, GET_EXPIRES_SEC),
            })),
          );
          return { ...manifest, manifestKey: key, files };
        } catch {
          return null;
        }
      }),
    )
  ).filter((m): m is NonNullable<typeof m> => m !== null);

  // Хамгийн сүүлийн захиалга дээд талд.
  manifests.sort((a, b) => b.createdAt - a.createdAt);

  return json({ orders: manifests }, 200);
}
