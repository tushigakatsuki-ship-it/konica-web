import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { IconAlert, IconCheck, IconClose, IconCopy } from './icons';
import { SERVICES } from '../data/catalog';
import { BANK_ACCOUNT } from '../data/site';
import type { StockItem } from '../data/stock';
import { submitOrder } from '../lib/api';
import { lineFromService } from '../lib/order';
import { formatCurrency, isValidEmail, isValidPhone } from '../lib/price';
import { plainAccount, type Quote } from '../lib/stockOrder';
import { serviceIdFor } from '../lib/price';

/**
 * Бэлэн барааны төлбөр — дансаар шилжүүлэх.
 *
 * ── ppm-ээс ЯЛГАЛТАЙ цорын ганц зүйл ─────────────────────────────
 *
 * ppm нь захиалгын дугаарыг маягт бөглөхөөс ӨМНӨ харуулдаг. Энд
 * харин дугаар нь захиалга СЕРВЕР ДЭЭР үүссэний дараа л гарна.
 *
 * Шалтгаан нь мөнгө: хэрэглэгч дугаараа хараад шилжүүлэг хийчихээд,
 * дараа нь захиалга илгээхэд алдаа гарвал дэлгүүрт ТАНИГДАХГҮЙ
 * гүйлгээний утгатай мөнгө ирнэ. Ажилтан хэнийх болохыг олохгүй,
 * хэрэглэгч мөнгөө төлчихөөд захиалгагүй үлдэнэ.
 *
 * Тиймээс дараалал нь: нэр/холбоо → захиалга үүснэ → дугаар, данс
 * гарна → шилжүүлэг. Алхмын тоо ижил, эрсдэл нь алга.
 *
 * ── «Төлбөр төлсөн» товч юу хийдэг вэ ───────────────────────────
 *
 * ⚠️ Энэ нь төлбөрийг БАТАЛГААЖУУЛАХГҮЙ. Хэрэглэгчийн хэлсэн үг
 * бөгөөд ажилтан банкны гүйлгээг гараар шалгана. Тиймээс «төлөгдлөө»
 * гэж бичихгүй — «мэдэгдлээ» гэж л бичнэ. Худал амлавал хэрэглэгч
 * бараагаа шууд авах гэж ирээд хоосон буцна.
 */

interface Props {
  item: StockItem;
  qty: number;
  vat: boolean;
  note: string;
  bill: Quote;
  onClose(): void;
}

type Stage =
  | { step: 'form' }
  | { step: 'pay'; orderNumber: string }
  | { step: 'done'; orderNumber: string };

/** Хуулах товч — амжилтыг нэг секунд харуулна. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /*
       * `clipboard` нь HTTPS бус, эсвэл зөвшөөрөлгүй орчинд шиднэ.
       * Хуудсыг зогсоох шалтгаан биш — утга нь дэлгэц дээр ил байгаа
       * тул хэрэглэгч гараар хуулж чадна.
       */
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`${label} хуулах`}
      className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-500 text-white transition-transform active:scale-90"
    >
      {copied ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
    </button>
  );
}

export default function StockPayment({ item, qty, vat, note, bill, onClose }: Props) {
  const [stage, setStage] = useState<Stage>({ step: 'form' });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const create = async () => {
    if (sending) return;

    if (!name.trim()) return setProblem('Нэрээ оруулна уу.');
    if (!isValidPhone(phone)) return setProblem('8 оронтой дугаар оруулна уу.');
    if (email.trim() && !isValidEmail(email)) return setProblem('И-мэйл хаяг буруу байна.');

    const service = SERVICES.find((s) => s.id === serviceIdFor(item, qty));
    if (!service) return setProblem('Бараа каталогт олдсонгүй. Залгана уу.');

    setProblem(null);
    setSending(true);
    try {
      const result = await submitOrder(
        {
          kind: 'person',
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          note: note.trim(),
          address: '',
          pickupDate: '',
        },
        [
          lineFromService(
            service,
            qty,
            `Бэлэн бараа: ${item.name.mn}${note.trim() ? ` · ${note.trim()}` : ''}`,
          ),
        ],
        { delivery: false, vat },
      );
      setStage({ step: 'pay', orderNumber: result.orderNumber });
    } catch (error) {
      console.error('[бэлэн бараа] захиалга үүсгэхэд алдаа', error);
      setProblem(
        error instanceof Error ? error.message : 'Захиалга илгээхэд алдаа гарлаа.',
      );
    } finally {
      setSending(false);
    }
  };

  return createPortal(
    /*
     * ── Дэвсгэр ЦАГААН, бараан биш ───────────────────────────────
     *
     * Бараан хөшиг нь зураг сонгох, тайрах зэрэг «зөвхөн үүн рүү
     * хар» гэсэн ажилд тохирно (`CropStudio`). Энд харин хэрэглэгч
     * дансны дугаар, гүйлгээний утгыг ХУУЛЖ, өөр апп руу шилжинэ —
     * тэр хооронд хуудас нь гэнэт харанхуйлж, буцахад цайх нь нүд
     * ядраана.
     *
     * ⚠️ `bg-canvas` нь сэдвийг дагана: гэрэл горимд бараг цагаан
     * (#f7f8fb), харанхуйд бараан. Хатуу `bg-white` бичвэл харанхуй
     * горимд цагаан дэвсгэр дээр цагаан бичиг үлдэнэ.
     */
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-canvas/85 p-4 backdrop-blur-sm">
      {/*
        * ⚠️ `bg-card`, `bg-surface` БИШ.
        *
        * Энэ төсөлд `--color-surface` гэсэн хувьсагч байхгүй тул
        * `bg-surface` нь утилит үүсгэдэггүй — цонх дэвсгэргүй,
        * тунгалаг үлдэж байв. Tailwind нь байхгүй классыг чимээгүй
        * орхидог: алдаа гарахгүй, зөвхөн хоосон харагдана.
        */}
      <div className="mx-auto my-8 max-w-md rounded-xl border border-hairline bg-card p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-black">
            {stage.step === 'done' ? 'Баярлалаа' : 'Захиалгын мэдээлэл'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="grid size-9 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-brand-50"
          >
            <IconClose className="size-4" />
          </button>
        </div>

        {/* ── 1. Холбоо барих ───────────────────────────────── */}
        {stage.step === 'form' && (
          <>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {item.name.mn} × {qty} — {formatCurrency(bill.total)}
            </p>

            <label className="mt-4 block">
              <span className="label">Нэр *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Таны нэр"
                className="field"
              />
            </label>

            <label className="mt-3 block">
              <span className="label">Утасны дугаар *</span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="99001234"
                className="field"
              />
            </label>

            <label className="mt-3 block">
              <span className="label">И-мэйл</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="example@email.com"
                className="field"
              />
              <span className="mt-1 block text-[11px] text-muted">Заавал биш</span>
            </label>

            {problem && (
              <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs leading-relaxed text-accent-strong">
                <IconAlert className="mt-px size-4 shrink-0" />
                {problem}
              </p>
            )}

            <button
              type="button"
              onClick={() => void create()}
              disabled={sending}
              className="btn-brand mt-5 w-full disabled:opacity-60"
            >
              {sending ? 'Илгээж байна…' : 'Захиалга үүсгэх'}
            </button>
          </>
        )}

        {/* ── 2. Шилжүүлэг ──────────────────────────────────── */}
        {stage.step === 'pay' && (
          <>
            <div className="mt-4 rounded-lg bg-sunken p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Захиалгын дугаар
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="truncate text-xl font-black">{stage.orderNumber}</p>
                <CopyButton value={stage.orderNumber} label="Захиалгын дугаар" />
              </div>
            </div>

            <div className="mt-3 rounded-lg bg-sunken p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                {BANK_ACCOUNT.bank} · {BANK_ACCOUNT.holder}
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="truncate text-lg font-black">{BANK_ACCOUNT.number}</p>
                <CopyButton
                  value={plainAccount(BANK_ACCOUNT.number)}
                  label="Дансны дугаар"
                />
              </div>
            </div>

            {/*
              * Гүйлгээний утга бол ажилтны ГАНЦ холбоос: дугааргүй
              * шилжүүлэг ирвэл хэнийх болохыг олох арга байхгүй.
              */}
            <p className="mt-3 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs font-bold leading-relaxed text-accent-strong">
              <IconAlert className="mt-px size-4 shrink-0" />
              Гүйлгээний утга дээр {stage.orderNumber} гэж ЗААВАЛ бичнэ үү.
            </p>

            <div className="mt-4 flex items-baseline justify-between rounded-lg border border-brand-500/30 bg-brand-50 p-4">
              <span className="text-sm font-bold">Нийт төлбөр</span>
              <span className="text-xl font-black text-brand-500">
                {formatCurrency(bill.total)}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setStage({ step: 'done', orderNumber: stage.orderNumber })}
              className="btn-brand mt-4 w-full"
            >
              Төлбөр төлсөн
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Шилжүүлгээ хийсний дараа энэ товчийг дарна уу.
            </p>
          </>
        )}

        {/* ── 3. Дууссан ────────────────────────────────────── */}
        {stage.step === 'done' && (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Захиалга <span className="font-bold">{stage.orderNumber}</span> бүртгэгдлээ.
            </p>

            {/*
              * ⚠️ «Төлбөр баталгаажлаа» гэж БИЧИХГҮЙ.
              *
              * Товч дарсан нь зөвхөн хэрэглэгчийн хэлсэн үг — банкны
              * гүйлгээг ажилтан гараар шалгана. Худал амлавал
              * хэрэглэгч бараагаа авахаар шууд ирээд хоосон буцна.
              */}
            <p className="mt-3 rounded-md bg-sunken p-3 text-xs leading-relaxed text-muted">
              Ажилтан гүйлгээг шалгаад баталгаажуулж залгана. Шилжүүлэг банкны
              системд ороход хэдэн минут зарцуулж болно.
            </p>

            <Link
              to={`/zakhialga/${stage.orderNumber}`}
              className="btn-brand mt-4 flex w-full justify-center"
            >
              Захиалгын явц харах
            </Link>
            <button type="button" onClick={onClose} className="btn-outline mt-2 w-full">
              Хаах
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
