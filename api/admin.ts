import { getStore, type StoredOrder } from './_store';
import { isPaid, type PaymentInfo } from './_payment';
import { notify, paidText } from './_notify';

/**
 * /api/admin — ажилтны хуудсыг тэжээнэ.
 *
 *   GET  ?days=7                              → сүүлийн захиалгууд
 *   GET  ?days=7&state=pending-sync           → NAS татаагүй, ТӨЛӨГДСӨН нь
 *   GET  ?ref=manifests/…json                 → ганц захиалга
 *   POST {action:'pay',    ref, paid}         → төлбөр баталгаажуулах
 *   POST {action:'mark',   ref, printed}      → хэвлэсэн гэж тэмдэглэх
 *   POST {action:'synced', ref, synced}       → NAS татаж дууссаныг тэмдэглэх
 *
 * ⚠️ Нэвтрэлт: `x-admin-token` толгой нь `ADMIN_TOKEN`-той таарах ёстой.
 * Зөвхөн энэ function л сангийн түлхүүрийг мэднэ — браузер нь зөвхөн 1 цаг
 * амьдардаг түр линк хүлээж авна. Тиймээс линк алдагдсан ч бүхэл сан задрахгүй.
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

export default async function handler(request: Request): Promise<Response> {
  if (!ADMIN_TOKEN) return json({ error: 'ADMIN_TOKEN тохируулаагүй байна.' }, 503);

  const given = request.headers.get('x-admin-token') ?? '';
  if (!sameToken(given, ADMIN_TOKEN)) return json({ error: 'Нууц үг буруу байна.' }, 401);

  const store = getStore();
  if (!store) return json({ error: 'Зургийн сан тохируулагдаагүй байна.' }, 503);

  /**
   * Захиалгыг клиентэд өгөх хэлбэрт оруулна.
   *
   * ⚠️ Төлбөр баталгаажаагүй бол татах линк ОГТ үүсгэхгүй. Түгжээг интерфейсийн
   * түвшинд («товчийг идэвхгүй болгох») тавьвал DevTools нээсэн хэн ч тойрч
   * гарна. Тиймээс линк нь сервер дээр, үүсгэх үе шат дээрээ таслагдана.
   */
  const shape = async (order: StoredOrder) => {
    const paid = isPaid(order.payment);
    const files = await Promise.all(
      order.files.map(async (file) => ({
        ...file,
        url: paid ? await store.fileUrl(file.key) : null,
      })),
    );
    // `manifestKey` нэр нь клиент дээр хэвээр — хадгалалт солигдоход ч тогтвортой.
    return { ...order, manifestKey: order.ref, files };
  };

  // ── Тэмдэглэх: хэвлэсэн / төлбөр орсон ───────────────────────────
  if (request.method === 'POST') {
    let body: {
      action?: string;
      /** Хуучин клиентүүд `manifestKey` нэрээр илгээдэг. */
      manifestKey?: string;
      ref?: string;
      printed?: boolean;
      paid?: boolean;
      /** `false` бол тэмдэглэгээг арилгана — NAS дахин татна. */
      synced?: boolean;
      note?: string;
    };
    try {
      body = JSON.parse(await request.text());
    } catch {
      return json({ error: 'Өгөгдөл JSON биш байна.' }, 400);
    }

    const ACTIONS = ['mark', 'pay', 'synced'] as const;
    const ref = String(body.ref ?? body.manifestKey ?? '');
    if (!ref || !(ACTIONS as readonly string[]).includes(body.action ?? ''))
      return json({ error: 'Хүсэлт буруу байна.' }, 400);

    const order = await store.getByRef(ref);
    if (!order) return json({ error: 'Захиалга олдсонгүй.' }, 404);

    const amount = order.payment?.amount ?? order.total;
    let payment: PaymentInfo | undefined;
    let printedAt: number | null | undefined;
    let syncedAt: number | null | undefined;

    if (body.action === 'synced') {
      /*
       * NAS файлыг бүрэн татсаны дараа өөрөө мэдэгдэнэ.
       *
       * ⚠️ Төлөгдөөгүй захиалгыг «татсан» гэж тэмдэглүүлэхгүй: NAS татах линк
       * авах ч боломжгүй байсан тул ийм хүсэлт ирсэн бол алдаа эсвэл хорлол.
       * Тэмдэглэчихвэл төлбөр нь дараа орох үед NAS уг захиалгыг мөнхөд
       * алгасна — зураг нь хэзээ ч ирэхгүй.
       */
      if (body.synced !== false && !isPaid(order.payment))
        return json({ error: 'Төлөгдөөгүй захиалгыг татсан гэж тэмдэглэхгүй.' }, 409);
      syncedAt = body.synced === false ? null : Date.now();
    } else if (body.action === 'pay') {
      /*
       * Гараар баталгаажуулах — данс руу шилжүүлэг хийсэн тохиолдолд.
       * QPay-ээр төлөгдсөн бол `paidAt` аль хэдийн тавигдсан байна.
       */
      payment = body.paid
        ? {
            ...(order.payment ?? { amount, method: null }),
            status: 'paid',
            method: order.payment?.method ?? 'manual',
            paidAt: Date.now(),
            note: String(body.note ?? '').slice(0, 200) || undefined,
          }
        : {
            ...(order.payment ?? { amount, method: null }),
            status: 'pending',
            paidAt: undefined,
          };
    } else {
      printedAt = body.printed ? Date.now() : null;
    }

    if (!(await store.update(ref, { payment, printedAt, syncedAt })))
      return json({ error: 'Хадгалж чадсангүй.' }, 502);

    const updated = await store.getByRef(ref);
    if (!updated) return json({ error: 'Захиалга олдсонгүй.' }, 404);

    /*
     * Гараар баталгаажуулсныг мөн Telegram руу мэдэгдэнэ — нэг ажилтан
     * дансаа шалгаж тэмдэглэхэд нөгөө нь хэвлэж эхлэх боломжтой болно.
     */
    if (body.action === 'pay' && body.paid) {
      await notify(
        paidText({
          orderNumber: updated.orderNumber,
          amount,
          photoCount: updated.files.filter((file) => file.kind === 'print').length,
          customer: updated.customer.name,
          phone: updated.customer.phone,
          method: updated.payment?.method ?? 'manual',
        }),
      );
    }

    /*
     * Төлбөр саяхан баталгаажсан бол татах линкүүдийг шууд буцаана — ажилтан
     * хуудсаа дахин ачаалах шаардлагагүй.
     *
     * `synced` үед линк үүсгэхгүй: NAS файлаа аль хэдийн татсан байгаа тул
     * 60 ширхэг presigned URL нь зөвхөн хариуг л томсгоно.
     */
    const files =
      body.action === 'synced' ? undefined : (await shape(updated)).files;

    return json(
      {
        printedAt: updated.printedAt ?? null,
        syncedAt: updated.syncedAt ?? null,
        payment: updated.payment ?? null,
        ...(files ? { files } : {}),
      },
      200,
    );
  }

  if (request.method !== 'GET') return json({ error: 'GET эсвэл POST.' }, 405);

  // ── Захиалгуудыг жагсаах ─────────────────────────────────────────
  const url = new URL(request.url);

  /* Ганц захиалга — NAS-ын `--resync`, ажилтны «дахин шалгах» товчид. */
  const single = url.searchParams.get('ref');
  if (single) {
    const order = await store.getByRef(single);
    if (!order) return json({ error: 'Захиалга олдсонгүй.' }, 404);
    return json({ orders: [await shape(order)] }, 200);
  }

  const days = Math.min(31, Math.max(1, Number(url.searchParams.get('days')) || 7));

  /*
   * Шүүлтүүр. Өгөгдмөл нь `all` — ажилтны апп бүх захиалгыг (төлөгдөөгүйг ч)
   * харах ёстой тул хуучин зан төлөв хэвээр.
   *
   * `pending-sync` нь NAS-д зориулсан: төлөгдсөн, гэхдээ хараахан татагдаагүй.
   * Шүүлтийг ЭНД, presigned линк үүсгэхЭЭС ӨМНӨ хийх нь чухал — эс тэгвээс
   * cron 10 минут тутам 7 хоногийн бүх файлд гарын үсэг зурна.
   */
  const state = url.searchParams.get('state') ?? 'all';
  const all = await store.list(days);

  const selected =
    state === 'pending-sync'
      ? all.filter((order) => isPaid(order.payment) && !order.syncedAt)
      : state === 'paid'
        ? all.filter((order) => isPaid(order.payment))
        : all;

  const orders = await Promise.all(selected.map(shape));
  return json({ orders, state, days, total: all.length }, 200);
}
