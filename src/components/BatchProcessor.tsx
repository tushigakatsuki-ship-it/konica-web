import { useCallback, useEffect, useRef, useState } from 'react';
import { IconAlert, IconCheck, IconImage } from './icons';
import { summarize, type BatchEntry } from '../lib/batch';
import { processFiles, type PhotoSettings } from '../lib/photoBatch';
import { isPrintReady, worstLevel } from '../lib/quality';
import type { ProcessResponse } from '../lib/processPhoto';

/**
 * Олон зураг нэг дор боловсруулах.
 *
 * ── Хэрэглээний зураглал ─────────────────────────────────────────
 *
 * Ангийн 30 сурагчийн цээж зураг нэг өдөр ирдэг. Нэг нэгээр нь оруулж,
 * хүлээж, татаж авах нь 30 удаагийн давтагдсан ажил. Энд бүгдийг нэг дор
 * оруулаад, алдаатайг нь л гараар засна.
 *
 * ── Алдааг НУУХГҮЙ ───────────────────────────────────────────────
 *
 * Багц боловсруулалтын гол эрсдэл нь чимээгүй алдаа: 30 зургийн 3 нь
 * буруу таслагдсаныг ажилтан хэвлэсний ДАРАА мэднэ. Тиймээс мөр бүр
 * төлөвтэй, алдаатай нь шалтгаантайгаа дээр эрэмбэлэгдэнэ.
 */

interface Props {
  settings: PhotoSettings;
  /** Багцаас гарч, ганц зураг дээр ажиллах. */
  onExit: () => void;
}

type Row = BatchEntry<ProcessResponse>;

export default function BatchProcessor({ settings, onExit }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);

  /* Санах ойг чөлөөлнө — 30 зургийн objectURL нь хуримтлагдвал таб хүндэрнэ. */
  const revoke = useCallback(() => {
    for (const url of urls.current) URL.revokeObjectURL(url);
    urls.current = [];
  }, []);

  useEffect(() => () => {
    abort.current?.abort();
    revoke();
  }, [revoke]);

  const start = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    revoke();
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;

    const list = Array.from(files);
    setProgress({ done: 0, total: list.length });
    setRows(
      list.map((file, index) => ({ index, name: file.name, status: 'pending' as const })),
    );

    const done = await processFiles(list, {
      settings,
      signal: controller.signal,
      onProgress: (finished, total) => {
        setProgress({ done: finished, total });
        /*
         * Мөр бүрийг тухай бүрд нь шинэчлэхийн оронд эцэст нь нэг удаа
         * шинэчилнэ — 30 зурагт 30 удаа бүтэн жагсаалт дахин зурагдвал
         * явцын заалт өөрөө удаашрана.
         */
      },
    });

    setRows(done);
    setProgress(null);
  };

  const cancel = () => abort.current?.abort();

  const downloadAll = () => {
    for (const row of rows) {
      if (row.status !== 'done' || !row.result?.blob) continue;

      const url = URL.createObjectURL(row.result.blob);
      urls.current.push(url);

      const link = document.createElement('a');
      link.href = url;
      link.download = row.name.replace(/\.[^.]+$/, '') + '-tseej.jpg';
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const summary = summarize(rows);
  const ready = rows.filter((r) => r.status === 'done').length;

  /* Алдаатай мөрийг ДЭЭР нь — ажилтан юуг засахаа шууд харна. */
  const ordered = [...rows].sort((a, b) => {
    const rank = (row: Row) =>
      row.status === 'error' ? 0 : row.result && !isPrintReady(row.result.checks ?? []) ? 1 : 2;
    return rank(a) - rank(b) || a.index - b.index;
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Олон зураг</h2>
        <button
          type="button"
          onClick={onExit}
          className="text-[11px] font-semibold text-muted transition-colors hover:text-brand-500"
        >
          Ганц зураг руу буцах
        </button>
      </div>

      {rows.length === 0 && (
        <label className="mt-3 flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-hairline p-6 text-center transition-colors hover:border-brand-500">
          <IconImage className="size-8 text-muted" />
          <span className="text-sm font-semibold">Зургуудаа сонгох</span>
          <span className="text-[11px] leading-relaxed text-muted">
            Олон зураг нэг дор сонгож болно. Бүгдийг автоматаар тайрч,
            дэвсгэрийг цэвэрлэж, шалгана.
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(event) => void start(event.target.files)}
          />
        </label>
      )}

      {progress && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span>
              {progress.done} / {progress.total} зураг боловсруулж байна…
            </span>
            <button
              type="button"
              onClick={cancel}
              className="text-[11px] font-semibold text-muted transition-colors hover:text-accent-strong"
            >
              Зогсоох
            </button>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-50">
            <div
              className="h-full bg-brand-500 transition-[width]"
              style={{ width: `${(progress.done / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {rows.length > 0 && !progress && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold">
            {summary.done} бэлэн
            {summary.failed > 0 && `, ${summary.failed} алдаатай`}
            {summary.cancelled > 0 && `, ${summary.cancelled} зогссон`}
          </p>
          {ready > 0 && (
            <button type="button" onClick={downloadAll} className="btn-accent px-4 py-2 text-xs">
              {ready} зургийг татах
            </button>
          )}
        </div>
      )}

      {ordered.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline rounded-lg border border-hairline">
          {ordered.map((row) => {
            const checks = row.result?.checks ?? [];
            const warn = row.status === 'done' && worstLevel(checks) !== 'ok';
            const note =
              row.reason ?? checks.find((c) => c.level !== 'ok')?.message ?? 'Хэвлэхэд бэлэн';

            return (
              <li key={row.index} className="flex items-start gap-2.5 px-3 py-2.5">
                {row.status === 'error' ? (
                  <IconAlert className="mt-px size-4 shrink-0 text-accent-strong" />
                ) : row.status === 'done' ? (
                  <IconCheck
                    className={`mt-px size-4 shrink-0 ${warn ? 'text-accent-strong' : 'text-ok-strong'}`}
                  />
                ) : (
                  <span className="mt-1 size-3 shrink-0 rounded-full border border-hairline" />
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{row.name}</span>
                  {/*
                    * Хараахан боловсруулагдаагүй мөрөнд ОРЛУУЛАГЧ.
                    *
                    * «Хүлээгдэж байна» гэсэн текст нь хөдөлгөөнгүй тул вэб
                    * гацсан мэт мэдрэгддэг. Гүйдэг орлуулагч нь ажил явж
                    * байгааг харуулна.
                    */}
                  {row.status === 'pending' || row.status === 'running' ? (
                    <span className="skeleton mt-1 block h-3 w-32" aria-hidden />
                  ) : (
                    <span
                      className={`block text-[11px] leading-relaxed ${
                        row.status === 'error' || warn ? 'text-accent-strong' : 'text-muted'
                      }`}
                    >
                      {row.status === 'cancelled' ? 'Зогсоосон' : note}
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
