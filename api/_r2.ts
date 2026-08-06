/**
 * Cloudflare R2 (S3-тэй нийцтэй) руу хандах AWS SigV4 гарын үсэг.
 *
 * Яагаад SDK биш вэ: `@aws-sdk/*` нь edge bundle-д хэдэн зуун KB нэмдэг бөгөөд
 * бидэнд ердөө гурван үйлдэл хэрэгтэй — presigned PUT/GET URL үүсгэх, мөн
 * ListObjectsV2 / PutObject-ыг серверээс дуудах. Vercel edge runtime WebCrypto-той
 * тул бүгдийг 150 орчим мөрөнд багтаана.
 *
 * ⚠️ `R2_SECRET_ACCESS_KEY` бол бүрэн эрх. Зөвхөн серверийн орчинд амьдарна —
 * `VITE_` угтвартай нэрээр ХЭЗЭЭ Ч бүү тавь.
 */

const ALGORITHM = 'AWS4-HMAC-SHA256';
const SERVICE = 's3';
const REGION = 'auto';
const UNSIGNED = 'UNSIGNED-PAYLOAD';
/** Хоосон биеийн SHA-256 — GET/HEAD хүсэлтэд хэрэглэнэ. */
const EMPTY_SHA256 =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

const encoder = new TextEncoder();

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export const readR2Config = (env: Record<string, string | undefined>): R2Config | null => {
  const accountId = env.R2_ACCOUNT_ID ?? '';
  const bucket = env.R2_BUCKET ?? '';
  const accessKeyId = env.R2_ACCESS_KEY_ID ?? '';
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY ?? '';
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { accountId, bucket, accessKeyId, secretAccessKey };
};

export const endpointHost = (config: R2Config): string =>
  `${config.accountId}.r2.cloudflarestorage.com`;

// ── Криптографийн туслахууд ────────────────────────────────────────

const hex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const sha256Hex = async (data: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', encoder.encode(data)));

const hmac = async (key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
};

/**
 * RFC 3986 кодчилол.
 *
 * `encodeURIComponent` нь `!'()*`-ыг орхидог ба AWS-ийн canonical хэлбэрт
 * эдгээрийг заавал кодлох ёстой — эс тэгвэл гарын үсэг таарахгүй.
 */
export const rfc3986 = (value: string): string =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/** Түлхүүрийн зам — `/` тусгаарлагчийг хэвээр үлдээж, сегмент бүрийг кодлоно. */
export const encodeKey = (key: string): string => key.split('/').map(rfc3986).join('/');

/** `20260806T041500Z` ба `20260806`. */
export const amzDates = (now: Date): { amzDate: string; dateStamp: string } => {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
};

const signingKey = async (
  secret: string,
  dateStamp: string,
): Promise<ArrayBuffer> => {
  let key: ArrayBuffer | Uint8Array = encoder.encode(`AWS4${secret}`);
  for (const part of [dateStamp, REGION, SERVICE, 'aws4_request']) {
    key = await hmac(key, part);
  }
  return key as ArrayBuffer;
};

const canonicalQuery = (params: Record<string, string>): string =>
  Object.keys(params)
    .sort()
    .map((name) => `${rfc3986(name)}=${rfc3986(params[name])}`)
    .join('&');

// ── 1. Presigned URL (query-string гарын үсэг) ─────────────────────

/**
 * Браузер шууд ашиглах боломжтой түр зуурын URL.
 *
 * `PUT` — хэрэглэгч зургаа R2 руу шууд илгээнэ. Ингэснээр Vercel function-ий
 * 4.5MB биеийн хязгаарт огт хүрэхгүй бөгөөд том зураг ч дамжина.
 * `GET`  — ажилтан admin хуудаснаас татахад.
 */
export async function presign(
  config: R2Config,
  method: 'PUT' | 'GET',
  key: string,
  expiresIn: number,
  now: Date = new Date(),
): Promise<string> {
  const host = endpointHost(config);
  const { amzDate, dateStamp } = amzDates(now);
  const credential = `${config.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`;

  const params: Record<string, string> = {
    'X-Amz-Algorithm': ALGORITHM,
    'X-Amz-Credential': credential,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };

  const path = `/${config.bucket}/${encodeKey(key)}`;
  const query = canonicalQuery(params);

  const canonicalRequest = [
    method,
    path,
    query,
    `host:${host}\n`,
    'host',
    UNSIGNED,
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = hex(await hmac(await signingKey(config.secretAccessKey, dateStamp), stringToSign));

  return `https://${host}${path}?${query}&X-Amz-Signature=${signature}`;
}

// ── 2. Серверээс хийх гарын үсэгтэй хүсэлт (Authorization толгой) ──

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * `ListObjectsV2`, `PutObject` зэргийг серверээс дуудахад бэлдэнэ.
 * `body` өгвөл түүний хэшийг гарын үсэгт оруулна (R2 payload-ыг шалгадаг).
 */
export async function signRequest(
  config: R2Config,
  method: string,
  key: string,
  options: {
    query?: Record<string, string>;
    body?: string;
    contentType?: string;
    now?: Date;
  } = {},
): Promise<SignedRequest> {
  const now = options.now ?? new Date();
  const host = endpointHost(config);
  const { amzDate, dateStamp } = amzDates(now);
  const payloadHash = options.body ? await sha256Hex(options.body) : EMPTY_SHA256;

  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (options.contentType) headers['content-type'] = options.contentType;

  const signedHeaders = Object.keys(headers).sort();
  const path = key ? `/${config.bucket}/${encodeKey(key)}` : `/${config.bucket}`;
  const query = canonicalQuery(options.query ?? {});

  const canonicalRequest = [
    method,
    path,
    query,
    `${signedHeaders.map((name) => `${name}:${headers[name].trim()}`).join('\n')}\n`,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');

  const stringToSign = [
    ALGORITHM,
    amzDate,
    `${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = hex(
    await hmac(await signingKey(config.secretAccessKey, dateStamp), stringToSign),
  );

  return {
    url: `https://${host}${path}${query ? `?${query}` : ''}`,
    headers: {
      ...headers,
      Authorization:
        `${ALGORITHM} Credential=${config.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request, ` +
        `SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`,
    },
  };
}

/** R2 руу жижиг объект (manifest) бичнэ. */
export async function putObject(
  config: R2Config,
  key: string,
  body: string,
  contentType = 'application/json; charset=utf-8',
): Promise<boolean> {
  const signed = await signRequest(config, 'PUT', key, { body, contentType });
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: signed.headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export async function getObject(config: R2Config, key: string): Promise<string | null> {
  const signed = await signRequest(config, 'GET', key);
  const response = await fetch(signed.url, {
    headers: signed.headers,
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok ? response.text() : null;
}

/**
 * XML хариунаас `<Key>` утгуудыг гаргана.
 *
 * Бүрэн XML задлагч оруулах шалтгаан алга: ListObjectsV2-ийн хариу нь тогтмол
 * бүтэцтэй бөгөөд бидэнд зөвхөн түлхүүрийн жагсаалт хэрэгтэй. Түлхүүрүүдийг
 * бид өөрсдөө үүсгэдэг тул `&`, `<` зэрэг тэмдэгт орох боломжгүй.
 */
export const parseKeys = (xml: string): string[] =>
  Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g), (m) => m[1]);

export async function listKeys(
  config: R2Config,
  prefix: string,
  maxKeys = 200,
): Promise<string[]> {
  const signed = await signRequest(config, 'GET', '', {
    query: { 'list-type': '2', prefix, 'max-keys': String(maxKeys) },
  });
  const response = await fetch(signed.url, {
    headers: signed.headers,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];
  return parseKeys(await response.text());
}
