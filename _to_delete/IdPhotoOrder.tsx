import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { IconAlert, IconArrowRight, IconCheck, IconImage } from './icons';
import { ID_SIZES, cmToPx, type IdSize } from '../lib/idPhoto';
import { isPrintReady, worstLevel, type Check } from '../lib/quality';
import { processPhoto } from '../lib/processPhoto';
import { friendlyReason } from '../lib/batch';
import { SERVICES } from '../data/catalog';
import { formatCurrency, parsePrice } from '../lib/price';
import { useBasket } from '../state/basket';

/**
 * Цээж зургийг ОНЛАЙНААР захиалах.
 *
 * ── Яагаад энэ нь одоо аюулгүй болов ─────────────────────────────
 *
 * Эхэндээ цээж зургийг зөвхөн салбар дээр авдаг байсан: гэрээсээ
 * илгээсэн зураг стандарт хангахгүй тул буцаагдана, мөнгө авчихаад
 * буцаах нь хэрэглэгчийг хуурсан хэрэг гэж үзсэн.
 *
 * Тэр эсэргүүцэл нь **чанарын шалгалт байхгүй** байсантай холбоотой.
 * Одоо `lib/quality.ts` нь нүүр, тод байдал, гэрэлтэлт, толгойн байрлалыг
 * шалгадаг тул мөнгө авахААС ӨМНӨ зургийг үнэлж чадна.
 *
 * ⚠️ **Тиймээс хаалт нь энэ бүхний утга учир.** `isPrintReady` худал бол
 * сагсанд нэмэх товч ИДЭВХГҮЙ. Энэ хаалтыг сулруулбал анхны эсэргүүцэл
 * буцаад ирнэ. `test/customer-web.test.ts` түгжсэн.
 */

const priceOf = (size: IdSize) =>
  parsePrice(SERVICES.find((s) => s.id === size.serviceId)?.price ?? '0₮');

type Stage = 'idle' | 'working' | 'done';

export default function IdPhotoOrder() {
  const basket = useBasket();

  const [size, setSize] = useState<IdSize>(ID_SIZES[0]);
  const [stage, setStage] = useState<Stage>('idle');
  const [checks, setChecks] = useState<Check[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const blobRef = useRef<Blob | null>(null);
  const urlRef = useRef<string | null>(null);

  const clearPreview = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  }, []);

  useEffect(() => clearPreview, [clearPreview]);

  const run = async (file: File | undefined) => {
    if (!file) return;

    setStage('working');
    setProblem(null);
    setAdded(false);
    clearPreview();
    setPreview(null);

    try {
      const result = await processPhoto({
        id: 0,
        blob: file,
        sizeIndex: ID_SIZES.indexOf(size),
        background: { r: 255, g: 255, b: 255 },
        tolerance: 60,
        outHeight: cmToPx(size.h),
      });

      if (!result.ok || !result.blob) {
        setProblem(result.reason ?? 'Боловсруулж чадсангүй');
        setStage('idle');
        return;
      }

      blobRef.current = result.blob;
      urlRef.current = URL.createObjectURL(result.blob);
      setPreview(urlRef.current);
      setChecks(result.checks ?? []);
      setStage('done');
    } catch (error) {
      console.error('[цээж зураг] боловсруулалт амжилтгүй', error);
      setProblem(friendlyReason(error));
      setStage('idle');
    }
  };

  const ready = stage === 'done' && isPrintReady(checks);

  const addToBasket = () => {
    const service = SERVICES.find((s) => s.id === size.serviceId);
    const blob = blobRef.current;
    if (!service || !blob || !ready) return;

    /*
     * Сагсанд ЭХ файл биш, БОЛОВСРУУЛСАН файл орно. Ажилтан дахин
     * тайрах шаардлагагүй — 300dpi, стандартын дагуу бэлэн.
     */
    const file = new File([blob], `tseej-${size.label.replace(/[^\w]/g, '')}.jpg`, {
      type: 'image/jpeg',
    });

    basket.add(service, {
      qty: 1,
      file,
      fileName: file.name,
      preview: urlRef.current,
      natural: { w: Math.round(cmToPx(size.w)), h: cmToPx(size.h) },
    });

    /*
     * ⚠️ ЭЗЭМШИЛ сагс руу шилжлээ.
     *
     * `urlRef`-ийг тэглэхгүй бол дараагийн `clearPreview()` дуудалт нь
     * сагсанд өгсөн ЯГ ТЭР `objectURL`-ыг устгана. Сагс болон захиалгын
     * хуудсан дээр зураг нь эвдэрч харагдана — алдаа шидэхгүй, зүгээр л
     * хоосон дөрвөлжин үлдэнэ.
     *
     * Тэглэсний дараа энэ компонент түүнийг цэвэрлэхээ болино; сагснаас
     * хасах үед л чөлөөлөгдөнө.
     */
    urlRef.current = null;
    setAdded(true);
  };

  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Онлайнаар захиалах</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        Зургаа оруулахад нүүрийг олж, дэвсгэрийг цагаан болгож, стандартын
        дагуу тайрна. Хэвлэхэд тохирох эсэхийг шалгаад л сагсанд нэмнэ.
      </p>

      {/* 1. Хэмжээ */}
      <div className="mt-5 flex flex-wrap gap-2">
        {ID_SIZES.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setSize(item);
              setStage('idle');
              clearPreview();
              setPreview(null);
            }}
            className={`rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${
              item.label === size.label
                ? 'bg-brand-500 text-white'
                : 'bg-brand-50 text-ink-soft hover:bg-brand-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs font-bold text-brand-500">
        {formatCurrency(priceOf(size))}
      </p>

      {/* 2. Зураг */}
      <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hairline p-5 text-center transition-colors hover:border-brand-500">
        <IconImage className="size-7 text-muted" />
        <span className="text-sm font-semibold">
          {stage === 'working' ? 'Боловсруулж байна…' : 'Зургаа сонгох'}
        </span>
        <span className="text-[11px] leading-relaxed text-muted">
          Жигд дэвсгэр дээр, урдаас, гэрэлтэй авсан зураг
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            void run(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>

      {stage === 'working' && <div className="skeleton mt-4 h-40 w-full" aria-hidden />}

      {problem && (
        <p className="mt-4 flex items-start gap-2 rounded-md bg-accent/10 p-3 text-xs leading-relaxed text-accent-strong">
          <IconAlert className="mt-px size-4 shrink-0" />
          {problem} Жигд дэвсгэр дээр, урдаас авсан зураг сонгоод дахин
          оролдоно уу.
        </p>
      )}

      {/* 3. Үр дүн ба хаалт */}
      {stage === 'done' && preview && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[140px_1fr]">
          <img
            src={preview}
            alt="Бэлтгэсэн цээж зураг"
            className="w-full rounded-md border border-hairline"
          />

          <div>
            <p
              className={`flex items-center gap-2 text-sm font-bold ${
                ready ? 'text-ok-strong' : 'text-accent-strong'
              }`}
            >
              {ready ? <IconCheck className="size-4" /> : <IconAlert className="size-4" />}
              {ready
                ? worstLevel(checks) === 'ok'
                  ? 'Хэвлэхэд бэлэн'
                  : 'Захиалж болно — доорхийг шалгана уу'
                : 'Энэ зураг тохирохгүй'}
            </p>

            <ul className="mt-2 space-y-1.5">
              {checks
                .filter((c) => c.level !== 'ok' || worstLevel(checks) === 'ok')
                .map((check) => (
                  <li
                    key={check.key}
                    className={`flex items-start gap-2 text-[11px] leading-relaxed ${
                      check.level === 'ok' ? 'text-muted' : 'text-accent-strong'
                    }`}
                  >
                    {check.level === 'ok' ? (
                      <IconCheck className="mt-px size-3.5 shrink-0 text-ok-strong" />
                    ) : (
                      <IconAlert className="mt-px size-3.5 shrink-0" />
                    )}
                    {check.message}
                  </li>
                ))}
            </ul>

            {/*
              * ⚠️ ХААЛТ. Шалгалт унасан зургийг сагсанд оруулахгүй.
              *
              * Онлайнаар цээж зураг авах боломжтой болсны цорын ганц
              * үндэслэл нь энэ хаалт. Үүнийг сулруулбал стандарт хангахгүй
              * зураг хэвлэгдэж, буцаагдаж, мөнгө нь дэлгүүрээс гарна.
              */}
            {/*
              * ⚠️ Нэмсний дараа юу болохыг ЗААВАЛ хэлнэ.
              *
              * Эхний хувилбар зөвхөн товчийг «Сагсанд нэмэгдлээ» болгодог
              * байсан нь хангалтгүй байв: сагсны интерфейс энэ хуудсанд
              * байдаггүй тул хэрэглэгч юу ч өөрчлөгдөөгүй мэт харж, сагсаа
              * хаанаас үзэхээ ч мэдэхгүй байсан.
              */}
            {added ? (
              <div className="mt-4 rounded-md bg-brand-50 p-3.5">
                <p className="flex items-center gap-2 text-sm font-bold text-brand-500">
                  <IconCheck className="size-4" /> Сагсанд нэмэгдлээ
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                  Сагс нь толгойд харагдана. Өөр хэмжээ нэмэх бол хэмжээгээ
                  сонгоод дахин зураг оруулна уу.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/zakhialga" className="btn-brand !px-4 !py-2 !text-xs">
                    Захиалга үргэлжлүүлэх
                    <IconArrowRight className="size-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setAdded(false);
                      setStage('idle');
                      clearPreview();
                      setPreview(null);
                    }}
                    className="btn-outline !px-4 !py-2 !text-xs"
                  >
                    Өөр зураг нэмэх
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={addToBasket}
                disabled={!ready}
                className="btn-brand mt-4 w-full !py-2.5 !text-sm"
              >
                Сагсанд нэмэх
              </button>
            )}

            {!ready && !added && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted">
                Дээрх асуудлыг зассан зураг оруулна уу. Эсвэл салбар дээр
                ирээд авахуулж болно.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
