import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { formatCurrency } from '../lib/price';
import { createZip, downloadBlob, type ZipEntry } from '../lib/zip';

/**
 * Ажилтны хуудас — вэбээр ирсэн зургийг татаж, зургийн машин руу оруулна.
 *
 * Нууц үг нь `sessionStorage`-д л хадгалагдана (localStorage биш): нийтийн
 * компьютер дээр таб хаагдмагц устана. Түлхүүр өөрөө сервер дээр байдаг тул
 * энд байгаа зүйл бол зөвхөн нэвтрэх токен.
 */

const TOKEN_KEY = 'printmn-admin-token';

interface AdminFile {
  key: string;
  kind: 'print' | 'original';
  name: string;
  size: number;
  sizeLabel: string;
  qty: number;
  /** Төлбөр баталгаажаагүй бол сервер линк ОГТ буцаадаггүй. */
  url: string | null;
}

interface AdminPayment {
  status: 'pending' | 'paid';
  amount: number;
  method: 'qpay' | 'manual' | null;
  paidAt?: number;
  note?: string;
}

interface AdminOrder {
  manifestKey: string;
  orderNumber: string;
  date: string;
  createdAt: number;
  customer: { name: string; phone: string; email: string; note: string };
  total: number;
  lines: { name: string; qty: number; total: number }[];
  files: AdminFile[];
  payment?: AdminPayment;
  printedAt?: number;
}

const isPaid = (order: AdminOrder): boolean => order.payment?.status === 'paid';

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

const timeLabel = (ms: number): string =>
  new Intl.DateTimeFormat('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

export default function Admin() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY) ?? '',
  );
  const [input, setInput] = useState('');
  const [days, setDays] = useState(7);
  const [orders, setOrders] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin?days=${days}`, {
        headers: { 'x-admin-token': token },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Уншиж чадсангүй.');
      setOrders(body.orders as AdminOrder[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа.');
      if (String(e).includes('Нууц үг')) {
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
      }
    } finally {
      setLoading(false);
    }
  }, [days, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const signIn = (event: FormEvent) => {
    event.preventDefault();
    sessionStorage.setItem(TOKEN_KEY, input.trim());
    setToken(input.trim());
    setInput('');
  };

  /**
   * Захиалгын бүх файлыг нэг ZIP болгож татна.
   *
   * Хөтөч 10-аас олон файлыг дараалан татахыг хориглодог тул нэг бүрчлэн
   * татах нь 20 зурагтай захиалганд ажиллахгүй.
   */
  const downloadAll = async (order: AdminOrder, kind?: 'print' | 'original') => {
    const wanted = (kind ? order.files.filter((f) => f.kind === kind) : order.files).filter(
      (f): f is AdminFile & { url: string } => Boolean(f.url),
    );
    if (wanted.length === 0) return;

    setBusy(order.manifestKey);
    try {
      const entries: ZipEntry[] = [];
      for (const file of wanted) {
        const response = await fetch(file.url);
        if (!response.ok) throw new Error(`${file.name} татагдсангүй.`);
        entries.push({
          name: `${order.orderNumber}/${file.name}`,
          data: new Uint8Array(await response.arrayBuffer()),
        });
      }
      downloadBlob(
        createZip(entries),
        `${order.orderNumber}${kind ? `-${kind}` : ''}.zip`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Татахад алдаа гарлаа.');
    } finally {
      setBusy(null);
    }
  };

  /** Захиалгын аль нэг талбарыг сервер дээр өөрчлөөд хариуг нь тусгана. */
  const patchOrder = async (order: AdminOrder, body: Record<string, unknown>) => {
    setBusy(order.manifestKey);
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ ...body, manifestKey: order.manifestKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? 'Хадгалж чадсангүй.');

      setOrders(
        (list) =>
          list?.map((o) =>
            o.manifestKey === order.manifestKey
              ? {
                  ...o,
                  printedAt: result.printedAt ?? undefined,
                  payment: result.payment ?? o.payment,
                  // Төлбөр баталгаажсаны дараа сервер шинэ линкүүд буцаадаг.
                  files: (result.files as AdminFile[] | undefined) ?? o.files,
                }
              : o,
          ) ?? null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа.');
    } finally {
      setBusy(null);
    }
  };

  /**
   * Гараар төлбөр баталгаажуулах — данс руу шилжүүлэг орсныг ажилтан харсан үед.
   * QPay-ээр төлсөн бол callback өөрөө тэмдэглэсэн байна.
   */
  const setPaid = (order: AdminOrder, paid: boolean) =>
    patchOrder(order, { action: 'pay', paid });

  const togglePrinted = (order: AdminOrder) =>
    patchOrder(order, { action: 'mark', printed: !order.printedAt });

  // ── Нэвтрэх ──────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20">
        <h1 className="text-2xl font-black">Ажилтны хэсэг</h1>
        <p className="mt-2 text-sm text-muted">
          Вэбээр ирсэн зургийг татахын тулд нууц үгээ оруулна уу.
        </p>
        <form onSubmit={signIn} className="mt-6">
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="field"
            placeholder="Нууц үг"
            autoComplete="current-password"
          />
          <button type="submit" className="btn-brand mt-3 w-full">
            Нэвтрэх
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black sm:text-3xl">Вэбийн захиалга</h1>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-md border border-hairline px-3 py-2 text-sm"
          >
            <option value={1}>Өнөөдөр</option>
            <option value={3}>3 хоног</option>
            <option value={7}>7 хоног</option>
            <option value={31}>31 хоног</option>
          </select>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-outline !px-4 !py-2 !text-sm"
          >
            ↻ Шинэчлэх
          </button>
          <button
            type="button"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              setToken('');
              setOrders(null);
            }}
            className="text-sm text-muted hover:text-ink"
          >
            Гарах
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {loading && <p className="mt-8 text-sm text-muted">Уншиж байна…</p>}

      {!loading && orders?.length === 0 && (
        <p className="mt-8 rounded-lg bg-brand-50 px-4 py-10 text-center text-sm text-muted">
          Энэ хугацаанд зурагтай захиалга ирээгүй байна.
        </p>
      )}

      <div className="mt-6 space-y-5">
        {orders?.map((order) => (
          <article
            key={order.manifestKey}
            className={`card p-4 sm:p-5 ${order.printedAt ? 'opacity-70' : ''}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-black">
                  {order.orderNumber}
                  {isPaid(order) ? (
                    <span className="ml-2 rounded-sm bg-ok/15 px-2 py-0.5 text-[11px] font-bold text-ok-strong">
                      төлсөн
                      {order.payment?.method === 'qpay' && ' · QPay'}
                    </span>
                  ) : (
                    <span className="ml-2 rounded-sm bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-strong">
                      ⏳ төлбөр хүлээгдэж байна
                    </span>
                  )}
                  {order.printedAt && (
                    <span className="ml-2 rounded-sm bg-ok/15 px-2 py-0.5 text-[11px] font-bold text-ok-strong">
                      хэвлэсэн
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {order.customer.name} ·{' '}
                  <a href={`tel:${order.customer.phone}`} className="text-brand-500">
                    {order.customer.phone}
                  </a>{' '}
                  · {timeLabel(order.createdAt)}
                </p>
                <p className="mt-0.5 text-sm font-bold">{formatCurrency(order.total)}</p>
                {order.customer.note && (
                  <p className="mt-1 text-xs text-muted">📝 {order.customer.note}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isPaid(order) ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === order.manifestKey}
                      onClick={() => void downloadAll(order, 'print')}
                      className="btn-accent !px-4 !py-2 !text-xs"
                    >
                      ⬇ Хэвлэх файлууд
                    </button>
                    <button
                      type="button"
                      disabled={busy === order.manifestKey}
                      onClick={() => void downloadAll(order)}
                      className="btn-outline !px-4 !py-2 !text-xs"
                    >
                      Бүгд ZIP
                    </button>
                    <button
                      type="button"
                      disabled={busy === order.manifestKey}
                      onClick={() => void togglePrinted(order)}
                      className="btn-outline !px-4 !py-2 !text-xs"
                    >
                      {order.printedAt ? '↩ Буцаах' : '✓ Хэвлэсэн'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={busy === order.manifestKey}
                    onClick={() => void setPaid(order, true)}
                    className="btn-accent !px-4 !py-2 !text-xs"
                  >
                    ✓ Төлбөр орсон
                  </button>
                )}
              </div>
            </div>

            {isPaid(order) && order.payment?.method === 'manual' && (
              <button
                type="button"
                disabled={busy === order.manifestKey}
                onClick={() => void setPaid(order, false)}
                className="mt-2 text-xs text-muted hover:text-ink"
              >
                Төлбөрийн тэмдэглэгээг буцаах
              </button>
            )}

            {busy === order.manifestKey && (
              <p className="mt-3 text-xs text-muted">Ажиллаж байна…</p>
            )}

            {!isPaid(order) && (
              <p className="mt-3 rounded-md bg-accent/10 px-3 py-2.5 text-xs leading-relaxed text-accent-strong">
                🔒 {order.files.filter((f) => f.kind === 'print').length} зураг ирсэн ч
                төлбөр баталгаажаагүй тул татах боломжгүй. Данс руу шилжүүлэг орсныг
                хараад «Төлбөр орсон» дарна уу. QPay-ээр төлсөн бол автоматаар нээгдэнэ.
              </p>
            )}

            <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {order.files
                .filter((file) => file.kind === 'print')
                .map((file) => {
                  // `01_10x15_2sh_print.jpg` ↔ `01_10x15_2sh_original.jpg`
                  const stem = file.name.replace(/_print\.[a-z]+$/, '');
                  const original = order.files.find(
                    (f) => f.kind === 'original' && f.name.startsWith(`${stem}_original`),
                  );
                  return (
                    <li key={file.key} className="card p-2">
                      {file.url ? (
                        <a href={file.url} download={file.name} className="block">
                          <img
                            src={file.url}
                            alt={file.name}
                            loading="lazy"
                            className="aspect-square w-full rounded-sm bg-brand-50 object-cover"
                          />
                        </a>
                      ) : (
                        <span className="grid aspect-square w-full place-items-center rounded-sm bg-brand-50 text-2xl">
                          <span aria-hidden>🔒</span>
                        </span>
                      )}
                      <p className="mt-1.5 text-xs font-bold">
                        {file.sizeLabel} × {file.qty}
                      </p>
                      <p className="text-[11px] text-muted">{mb(file.size)}</p>
                      {file.url && (
                        <div className="mt-1 flex gap-2 text-[11px] font-semibold">
                          <a href={file.url} download={file.name} className="text-brand-500">
                            Хэвлэх
                          </a>
                          {original?.url && (
                            <a
                              href={original.url}
                              download={original.name}
                              className="text-muted hover:text-ink"
                            >
                              Эх
                            </a>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
