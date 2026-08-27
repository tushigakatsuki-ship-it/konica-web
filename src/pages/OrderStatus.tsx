import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import PageHero from '../components/PageHero';
import { PRIMARY_PHONE } from '../data/site';
import { fetchOrderStatus, type OrderStatus } from '../lib/api';
import { clearReceipt, saveReceipt } from '../lib/lastOrder';
import { formatCurrency } from '../lib/price';
import { IconCheck, IconCheckCircle, IconClock, IconLink } from '../components/icons';

/**
 * `/zakhialga/PMN-260806-4821?d=…&u=…` — захиалгын төлөв.
 *
 * Захиалгын вэбүүдийн стандарт зан төлөв: баталгаажуулалт бол түр зуурын
 * дэлгэц биш, **буцаж орж болдог хаяг**. Ингэснээр:
 *   • хуудсаа сэргээхэд захиалга алдагдахгүй
 *   • төлбөрөө маргааш төлж болно
 *   • линкээ хуваалцаж, өөр хүнээр төлүүлж болно
 *
 * Хаягийг мэдэх нь хангалтгүй — `u` (uploadId) байхгүй бол сервер өгөгдөл
 * буцаадаггүй тул дугаарыг таасан ч өөр хүний захиалгыг харах боломжгүй.
 */

const dateTime = (ms: number): string =>
  new Intl.DateTimeFormat('mn-MN', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

export default function OrderStatusPage() {
  const { orderNumber = '' } = useParams();
  const [params] = useSearchParams();
  const date = params.get('d') ?? '';
  const uploadId = params.get('u') ?? '';

  const [status, setStatus] = useState<OrderStatus | null>(null);
  /*
   * Дутуу линкийг ЭХНИЙ зурагдалтад шууд илрүүлнэ.
   *
   * Шалгалтыг эффект дотор хийвэл хэрэглэгч эхлээд «Уншиж байна…» хараад
   * дараа нь алдаа руу үсрэх бөгөөд линк буруу байсныг ойлгоход удаана.
   */
  const [error, setError] = useState<string | null>(() =>
    orderNumber && date && uploadId
      ? null
      : 'Линк бүрэн бус байна. Захиалгын баримтаа шалгана уу.',
  );
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!orderNumber || !date || !uploadId) return;
    try {
      setStatus(await fetchOrderStatus(orderNumber, date, uploadId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа.');
    }
  }, [date, orderNumber, uploadId]);

  /* Линкээр шууд орсон хүн ч дараа нь буцаж олохын тулд баримтаа хадгална. */
  useEffect(() => {
    if (orderNumber && date && uploadId) saveReceipt({ orderNumber, date, uploadId });
  }, [date, orderNumber, uploadId]);

  /*
   * Төлөгдөх хүртэл 5 секунд тутам шалгана. Төлөгдсөний дараа зогсоно —
   * цаашид өөрчлөгдөх зүйл алга. Хуудас нуугдсан үед (хэрэглэгч банкны
   * аппдаа байгаа) асуухаа больж, буцаж ирмэгц шууд нэг удаа асууна.
   */
  useEffect(() => {
    void load();
    if (status?.status === 'paid') return;

    const tick = () => {
      if (!document.hidden) void load();
    };
    const timer = setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load, status?.status]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard эрх байхгүй — хэрэглэгч хаягийн мөрөөс хуулна.
    }
  };

  if (error) {
    return (
      <>
        <PageHero eyebrow="Захиалга" title="Захиалга олдсонгүй" />
        <div className="mx-auto max-w-lg px-4 py-14 text-center sm:px-6">
          <p className="text-sm leading-relaxed text-muted">{error}</p>
          <p className="mt-4 text-sm text-muted">
            Асуух зүйл байвал{' '}
            <a href={PRIMARY_PHONE.href} className="font-semibold text-accent">
              {PRIMARY_PHONE.label}
            </a>{' '}
            дугаарт холбогдоно уу.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/hevlel" className="btn-brand">
              Шинэ захиалга өгөх
            </Link>
            <button
              type="button"
              onClick={() => {
                clearReceipt();
                window.location.href = '/';
              }}
              className="btn-outline"
            >
              Нүүр хуудас
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!status) {
    return (
      <>
        <PageHero eyebrow="Захиалга" title={orderNumber || 'Уншиж байна…'} />
        <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
          <p className="text-sm text-muted">Уншиж байна…</p>
        </div>
      </>
    );
  }

  const paid = status.status === 'paid';

  return (
    <>
      <PageHero
        eyebrow="Захиалга"
        title={status.orderNumber}
        subtitle={`${dateTime(status.createdAt)} · ${formatCurrency(status.amount)}`}
      />

      <div className="mx-auto max-w-lg px-4 py-8 sm:px-6 sm:py-14">
        {/* Явцын заагч — захиалгын вэбүүдийн стандарт */}
        <ol className="flex items-center gap-1 text-center text-[11px] font-semibold">
          {[
            { label: 'Хүлээн авсан', done: true },
            { label: 'Төлбөр', done: paid },
            { label: 'Хэвлэсэн', done: Boolean(status.printedAt) },
          ].map((step, index) => (
            <li key={step.label} className="flex flex-1 items-center gap-1">
              {index > 0 && (
                <span
                  aria-hidden
                  className={`h-0.5 flex-1 ${step.done ? 'bg-ok' : 'bg-hairline'}`}
                />
              )}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 ${
                  step.done ? 'bg-ok/15 text-ok-strong' : 'bg-brand-50 text-muted'
                }`}
              >
                {step.done && <IconCheck className="size-3" />}
                {step.label}
              </span>
            </li>
          ))}
        </ol>

        <div
          className={`mt-6 rounded-lg border p-5 ${
            paid ? 'border-ok/40 bg-ok/10' : 'border-accent/40 bg-accent/10'
          }`}
        >
          <p className="flex items-center gap-2 text-base font-black">
            {paid ? (
              <>
                <IconCheckCircle className="size-5 text-ok-strong" /> Захиалга
                амжилттай баталгаажлаа
              </>
            ) : (
              <>
                <IconClock className="size-5 text-accent-strong" /> Төлбөр хүлээгдэж
                байна
              </>
            )}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            {paid
              ? status.photoCount > 0
                ? `${status.photoCount} зураг хэвлэлтэд орсон. Бэлэн болмогц утсаар мэдэгдэнэ.`
                : 'Захиалга хэвлэлтэд орсон. Бэлэн болмогц утсаар мэдэгдэнэ.'
              : 'Төлбөр орсны дараа ажилтанд дамжиж, хэвлэлтэд орно. Дансны мэдээллийг захиалга өгөх үед харуулсан — олдохгүй бол утсаар холбогдоно уу.'}
          </p>
          {paid && status.paidAt && (
            <p className="mt-2 text-xs text-muted">{dateTime(status.paidAt)}</p>
          )}
        </div>

        {status.lines.length > 0 && (
          <dl className="mt-6 divide-y divide-hairline rounded-lg border border-hairline text-sm">
            {status.lines.map((line) => (
              <div key={line.name} className="flex justify-between gap-3 px-4 py-3">
                <dt className="min-w-0 text-muted">
                  {line.name} × {line.qty}
                </dt>
                <dd className="shrink-0 font-semibold">{formatCurrency(line.total)}</dd>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3 text-base font-black">
              <dt>Нийт</dt>
              <dd className="text-brand-500">{formatCurrency(status.amount)}</dd>
            </div>
          </dl>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => void copyLink()} className="btn-outline flex-1">
            {copied ? (
              <>
                <IconCheck className="size-4" /> Хууллаа
              </>
            ) : (
              <>
                <IconLink className="size-4" /> Линк хуулах
              </>
            )}
          </button>
          <Link to="/hevlel" className="btn-brand flex-1">
            Шинэ захиалга
          </Link>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted">
          Энэ хаягийг хадгалж аваарай — хэзээ ч буцаж орж төлбөр, бэлэн байдлаа
          шалгаж болно.
          <br />
          Асуух зүйл байвал{' '}
          <a href={PRIMARY_PHONE.href} className="font-semibold text-accent">
            {PRIMARY_PHONE.label}
          </a>
        </p>
      </div>
    </>
  );
}
