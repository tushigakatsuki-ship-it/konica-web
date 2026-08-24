import { useEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown, IconClose } from './icons';
import { addDays, isClosedDay, todayInUB } from '../lib/pickup';

/**
 * Монгол хуанли — `<input type="date">`-ийг ОРЛОНО.
 *
 * ── Яагаад төрөлх талбарыг орлов ─────────────────────────────────
 *
 * Хөтөчийн төрөлх хуанли нь найдвартай ч ХЯЗГААРЛАГДМАЛ:
 *   • Хаалттай өдрийг (Мягмар) унтраах боломжгүй — стандартад байхгүй.
 *     Тиймээс хэрэглэгч сонгоод л, дараа нь алдаа хардаг байв.
 *   • Хэлбэр нь үйлдлийн системийн хэлээр гардаг: монгол хуудсан дээр
 *     `mm/dd/yyyy` гэж харагдана.
 *   • Загварыг нь өөрчлөх боломжгүй.
 *
 * ── Юуг нь АЛДААГҮЙ хадгалав ─────────────────────────────────────
 *
 * Утга нь `YYYY-MM-DD` мөр хэвээр — `pickup.ts`-ийн бүх дүрэм өөрчлөгдөөгүй.
 * Гараар удирдах, `Escape`-ээр хаах, дэлгэц уншигчид зарлах гурвыг гараар
 * хийсэн: төрөлх талбарын үнэ цэнэ нь голдуу ЭНЭ гурав байдаг тул орлохдоо
 * хамт авчрахгүй бол доройтол болно.
 */

interface Props {
  id: string;
  /** `YYYY-MM-DD` эсвэл хоосон. */
  value: string;
  onChange(value: string): void;
  /** Сонгож болох хамгийн эрт өдөр, `YYYY-MM-DD`. */
  min: string;
  /** Сонгож болох хамгийн сүүлийн өдөр, `YYYY-MM-DD`. */
  max: string;
  invalid?: boolean;
  describedBy?: string;
}

/** Даваагаар эхэлсэн долоо хоног — монгол хуанлийн уламжлал. */
const WEEKDAYS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'] as const;

const MONTHS = [
  '1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар',
  '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар',
] as const;

/** `YYYY-MM-DD` → тухайн сарын эхний өдөр. */
const monthStart = (iso: string): string => `${iso.slice(0, 7)}-01`;

/** Сар нэмэх/хасах — өдрийг нь үргэлж 1 болгож барина. */
const shiftMonth = (iso: string, by: number): string => {
  const at = new Date(`${monthStart(iso)}T00:00:00Z`);
  at.setUTCMonth(at.getUTCMonth() + by);
  return at.toISOString().slice(0, 10);
};

/**
 * Тухайн сарын торны 42 нүд (6 мөр × 7 хоног).
 *
 * Тогтмол 42 нүд байлгаж байгаа шалтгаан: сар солиход торны өндөр
 * өөрчлөгдвөл доорх товч үсэрч, хэрэглэгч буруу зүйл дарна.
 */
const buildGrid = (monthIso: string): string[] => {
  const first = new Date(`${monthStart(monthIso)}T00:00:00Z`);
  // `getUTCDay()`: Ням = 0. Даваагаар эхлүүлэхийн тулд шилжүүлнэ.
  const lead = (first.getUTCDay() + 6) % 7;
  const start = addDays(first.toISOString().slice(0, 10), -lead);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

const dayOf = (iso: string): number => Number(iso.slice(8, 10));
const monthOf = (iso: string): string => iso.slice(0, 7);

/** `2026-08-26` → `2026 оны 8-р сарын 26` */
export const formatLong = (iso: string): string =>
  `${iso.slice(0, 4)} оны ${MONTHS[Number(iso.slice(5, 7)) - 1]}ын ${dayOf(iso)}`;

export default function DatePicker({
  id,
  value,
  onChange,
  min,
  max,
  invalid,
  describedBy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => monthStart(value || min));
  const boxRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => todayInUB(), []);

  /* Гаднах даралт, `Escape` хоёроор хаана. */
  useEffect(() => {
    if (!open) return;

    /*
     * ⚠️ `mousedown` — `click` БИШ. `click` дээр сонсвол хуанлийн доторх
     * товч дарагдмагц React дахин зурж, дараа нь `click` бөмбөрцөглөж
     * ирэхэд элемент нь аль хэдийн шинэ болсон байдаг тул `contains()`
     * худал `false` буцааж, хуанли санамсаргүй хаагдана.
     */
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Нээх бүрт сонгосон сар руу буцна — хэрэглэгч хаана байсныг санана. */
  useEffect(() => {
    if (open) setMonth(monthStart(value || todayInUB()));
  }, [open, value]);

  const grid = useMemo(() => buildGrid(month), [month]);
  const canPrev = monthOf(month) > monthOf(min);
  const canNext = monthOf(month) < monthOf(max);

  /** Сонгож БОЛОХГҮЙ өдөр үү, тэгвэл яагаад. */
  const blocked = (iso: string): string | null => {
    if (iso < min) return 'өнгөрсөн';
    if (iso > max) return 'хэт хол';
    if (isClosedDay(iso)) return 'хаалттай';
    return null;
  };

  return (
    <div ref={boxRef}>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-calendar`}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`field flex items-center justify-between text-left ${
          value ? 'text-ink' : 'text-muted'
        }`}
      >
        <span>{value ? formatLong(value) : 'Өдрөө сонгоно уу'}</span>
        <span className="flex items-center gap-1">
          {value && (
            /*
             * ⚠️ `<span role="button">` — `<button>` БИШ.
             * Товч дотор товч байрлуулах нь HTML-д хүчингүй бөгөөд хөтөч
             * бүр өөрөөр засдаг тул зарим дээр цэвэрлэх товч огт
             * дарагддаггүй болно.
             */
            <span
              role="button"
              tabIndex={0}
              aria-label="Сонгосон өдрийг арилгах"
              onClick={(event) => {
                event.stopPropagation();
                onChange('');
                setOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                event.stopPropagation();
                onChange('');
                setOpen(false);
              }}
              className="grid size-6 place-items-center rounded-sm text-muted hover:bg-sunken hover:text-ink"
            >
              <IconClose className="size-3.5" />
            </span>
          )}
          <IconChevronDown
            className={`size-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        /*
         * ⚠️ Хөвөгч цонх (`absolute`) БИШ, урсгал дотор нээгдэнэ.
         *
         * Энэ маягт `.card` дотор сууна; `.card` нь буланг цэвэрхэн
         * дугуйруулахын тулд `overflow-hidden`-тэй. Хөвүүлбэл хуанлийн
         * эхний мөрөөс бусад нь ТАСАРЧ, хэрэглэгч 27–2 гэсэн долоон нүд л
         * хардаг байв.
         *
         * Урсгал дотор нээх нь утсан дээр ч дээр: хөвөгч цонх дэлгэцийн
         * ирмэгээс халиад, гүйлгэх шаардлагатай болдог.
         */
        <div
          id={`${id}-calendar`}
          role="group"
          aria-label="Хүлээж авах өдөр сонгох"
          className="mt-2 rounded-lg border border-hairline bg-sunken p-3 sm:max-w-xs"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              disabled={!canPrev}
              aria-label="Өмнөх сар"
              className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconChevronDown className="size-4 rotate-90" />
            </button>

            <p className="text-sm font-bold" aria-live="polite">
              {month.slice(0, 4)} оны {MONTHS[Number(month.slice(5, 7)) - 1]}
            </p>

            <button
              type="button"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={!canNext}
              aria-label="Дараах сар"
              className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-sunken disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <IconChevronDown className="size-4 -rotate-90" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-muted">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((iso) => {
              const why = blocked(iso);
              const outside = monthOf(iso) !== monthOf(month);
              const picked = iso === value;

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={Boolean(why)}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  aria-current={iso === today ? 'date' : undefined}
                  aria-label={
                    why === 'хаалттай' ? `${formatLong(iso)} — хаалттай` : formatLong(iso)
                  }
                  className={[
                    'grid h-9 place-items-center rounded-md text-sm transition-colors',
                    picked
                      ? 'bg-brand-500 font-bold text-white'
                      : why
                        ? 'cursor-not-allowed text-muted/40 line-through'
                        : outside
                          ? 'text-muted hover:bg-sunken'
                          : 'font-medium text-ink hover:bg-brand-50',
                    !picked && iso === today ? 'ring-1 ring-brand-500' : '',
                  ].join(' ')}
                >
                  {dayOf(iso)}
                </button>
              );
            })}
          </div>

          {/*
            Хаалттай өдөр яагаад зураастай байгааг ТАЙЛБАРЛАНА. Тайлбаргүй
            бол хэрэглэгч «сайт эвдэрсэн байна» гэж бодно.
          */}
          <p className="mt-2 border-t border-hairline pt-2 text-[11px] text-muted">
            <span className="line-through">Зураастай</span> өдөр — Мягмар
            гарагт дэлгүүр хаалттай.
          </p>
        </div>
      )}
    </div>
  );
}
