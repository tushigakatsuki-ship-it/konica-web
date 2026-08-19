import { readR2Config, signRequest } from './_r2';

/**
 * GET /api/health — сервер зөв тохируулагдсан эсэхийг ХАРУУЛНА.
 *
 * Яагаад хэрэгтэй вэ: `ADMIN_TOKEN` эсвэл `R2_*` дутуу үед бүх handler 503
 * буцаадаг ч ЯМАР хувьсагч дутуугаас нь ялгаж мэдэх арга байхгүй байсан.
 * Дэлгүүрийн эзэн Vercel дээр 8 хувьсагч бөглөөд, аль нь буруу бичигдсэнийг
 * олохын тулд жинхэнэ захиалга үүсгэж туршихаас өөр аргагүй болдог. Энэ хуудас
 * тэрийг браузераас 2 секундэд шалгуулна.
 *
 *   GET /api/health           → зөвхөн «хувьсагч бөглөгдсөн үү» (нууц үггүй)
 *   GET /api/health?deep=1    → R2 руу ҮНЭХЭЭР холбогдож үзнэ (x-admin-token хэрэгтэй)
 *
 * ⚠️ Нууц утгыг ХЭЗЭЭ Ч буцаахгүй — зөвхөн `true/false`. Урт, эхний тэмдэгт
 * гэх мэт «хэсэгчилсэн» мэдээлэл ч өгөхгүй: тэр нь токен таах ажлыг хөнгөвчилдөг.
 *
 * `bucket`, `endpoint` хоёрыг харуулдаг нь санаатай — presigned PUT линк дотор
 * тэр хоёр аль хэдийн браузерт очдог тул нуух утгагүй, харин «буруу бакет руу
 * бичиж байна» гэсэн алдааг шууд илрүүлдэг.
 */

export const config = { runtime: 'edge' };

/** Гүн шалгалт R2 руу жинхэнэ хүсэлт явуулдаг тул хэт олон дуудахаас хамгаална. */
const DEEP_TIMEOUT_MS = 8_000;

interface Check {
  /** Ажиллахад ХАНГАЛТТАЙ тохируулагдсан эсэх. */
  ready: boolean;
  /** Хүнд ойлгомжтой тайлбар — шууд дэлгэцэнд гаргахад тохирно. */
  detail: string;
  /** Дутуу байгаа орчны хувьсагчид. */
  missing?: string[];
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });

/** Хоосон биш утгатай хувьсагчдыг л «бөглөсөн» гэж үзнэ (зай нь хоосонтой адил). */
const filled = (env: Record<string, string | undefined>, names: string[]): string[] =>
  names.filter((name) => (env[name] ?? '').trim() !== '');

const missingOf = (env: Record<string, string | undefined>, names: string[]): string[] =>
  names.filter((name) => (env[name] ?? '').trim() === '');

/**
 * R2 руу жинхэнэ ListObjectsV2 явуулж, түлхүүр зөв эсэхийг шалгана.
 *
 * `listKeys()`-ыг ашиглаагүй шалтгаан: тэр нь алдаа гарвал хоосон массив
 * буцаадаг тул «бакет хоосон байна» ба «түлхүүр буруу байна» хоёрыг ялгаж
 * чадахгүй. Энд HTTP статусыг нь шууд авна.
 */
async function probeStorage(
  r2: NonNullable<ReturnType<typeof readR2Config>>,
): Promise<Check> {
  let signed;
  try {
    signed = await signRequest(r2, 'GET', '', {
      query: { 'list-type': '2', 'max-keys': '1' },
    });
  } catch (error) {
    return { ready: false, detail: `Гарын үсэг зурж чадсангүй: ${String(error)}` };
  }

  try {
    const response = await fetch(signed.url, {
      headers: signed.headers,
      signal: AbortSignal.timeout(DEEP_TIMEOUT_MS),
    });

    if (response.ok) return { ready: true, detail: 'R2 хариулж байна — түлхүүр зөв.' };

    if (response.status === 403)
      return {
        ready: false,
        detail:
          'R2 403 буцаалаа — Access Key/Secret буруу, эсвэл токен энэ бакетад эрхгүй ' +
          '(«Object Read & Write» сонгосон эсэхээ шалгана уу).',
      };

    if (response.status === 404)
      return {
        ready: false,
        detail: `«${r2.bucket}» нэртэй бакет олдсонгүй — R2_BUCKET-ийн бичлэгээ шалгана уу.`,
      };

    return { ready: false, detail: `R2 ${response.status} буцаалаа.` };
  } catch (error) {
    return {
      ready: false,
      detail: `R2 руу холбогдож чадсангүй: ${String(error)}. R2_ACCOUNT_ID / S3_ENDPOINT-оо шалгана уу.`,
    };
  }
}

const sameToken = (given: string, expected: string): boolean => {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'GET хүсэлт л хүлээн авна.' }, 405);

  const env = process.env as Record<string, string | undefined>;
  const url = new URL(request.url);
  const r2 = readR2Config(env);

  const adminToken = (env.ADMIN_TOKEN ?? '').trim();

  const checks: Record<string, Check> = {
    /** Зураг хадгалах сан — үүнгүйгээр хэрэглэгч зураг ОРУУЛЖ ЧАДАХГҮЙ. */
    storage: r2
      ? {
          ready: true,
          detail: `«${r2.bucket}» бакет, ${r2.host}`,
        }
      : {
          ready: false,
          detail: 'Зураг хадгалах сан тохируулаагүй — хэрэглэгч зураг оруулж чадахгүй.',
          missing: missingOf(env, [
            'R2_BUCKET',
            'R2_ACCESS_KEY_ID',
            'R2_SECRET_ACCESS_KEY',
            ...((env.S3_ENDPOINT ?? '').trim() ? [] : ['R2_ACCOUNT_ID']),
          ]),
        },

    /** Ажилтны нэвтрэлт — үүнгүйгээр NAS татаж чадахгүй. */
    admin: adminToken
      ? { ready: true, detail: 'ADMIN_TOKEN бөглөгдсөн — NAS холбогдох боломжтой.' }
      : {
          ready: false,
          detail: 'ADMIN_TOKEN алга — /api/admin 503 буцаана, NAS зураг татаж чадахгүй.',
          missing: ['ADMIN_TOKEN'],
        },

    /** Төлбөр — QPay эсвэл дансны мэдээлэл, дор хаяж НЭГ нь байх ёстой. */
    payment: (() => {
      const qpay = filled(env, [
        'QPAY_USERNAME',
        'QPAY_PASSWORD',
        'QPAY_INVOICE_CODE',
      ]).length === 3;
      const bank = filled(env, ['BANK_NAME', 'BANK_ACCOUNT']).length === 2;
      if (qpay && bank) return { ready: true, detail: 'QPay ба дансны шилжүүлэг хоёулаа бэлэн.' };
      if (qpay) return { ready: true, detail: 'QPay бэлэн (дансны шилжүүлэг тохируулаагүй).' };
      if (bank)
        return { ready: true, detail: 'Дансны шилжүүлэг бэлэн (QPay тохируулаагүй).' };
      return {
        ready: false,
        detail:
          'Төлбөрийн ямар ч арга тохируулаагүй — захиалга үүснэ ч хэрэглэгч төлж чадахгүй.',
        missing: ['QPAY_USERNAME + QPAY_PASSWORD + QPAY_INVOICE_CODE', 'эсвэл BANK_NAME + BANK_ACCOUNT'],
      };
    })(),

    /** Telegram — заавал биш, гэхдээ байхгүй бол ажилтан төлбөр орсныг мэдэхгүй. */
    notify:
      filled(env, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']).length === 2
        ? { ready: true, detail: 'Төлбөр орох бүрд Telegram-аар мэдэгдэнэ.' }
        : {
            ready: false,
            detail:
              'Telegram мэдэгдэл унтарсан (заавал биш). Ажилтан /admin хуудсыг өөрөө сэргээж харна.',
            missing: missingOf(env, ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID']),
          },
  };

  // ── Гүн шалгалт: R2 руу ҮНЭХЭЭР холбогдож үзнэ ────────────────────
  /*
   * Токен шаардах шалтгаан: энэ нь бүртгэлтэй Class A үйлдэл зарцуулдаг тул
   * нээлттэй орхивол хэн ч дуудаж, тооцоог чинь өсгөж чадна.
   */
  if (url.searchParams.get('deep')) {
    const given = request.headers.get('x-admin-token') ?? '';
    if (!adminToken || !sameToken(given, adminToken))
      return json(
        { error: 'Гүн шалгалтад x-admin-token шаардлагатай.', checks },
        adminToken ? 401 : 503,
      );
    checks.storage = r2 ? await probeStorage(r2) : checks.storage;
  }

  /** Хэрэглэгч зураг оруулж, ажилтан татаж чадах эсэх — гол хариулт. */
  const ok = checks.storage.ready && checks.admin.ready && checks.payment.ready;

  const missing = Object.values(checks).flatMap((check) => check.missing ?? []);

  return json(
    {
      ok,
      summary: ok
        ? 'Бүх зайлшгүй тохиргоо бэлэн — NAS холбож болно.'
        : 'Тохиргоо дутуу байна. Доорх `missing` жагсаалтыг Vercel дээр бөглөөд redeploy хийнэ үү.',
      checks,
      missing,
    },
    ok ? 200 : 503,
  );
}
