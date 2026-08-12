/**
 * Багц боловсруулалтын дараалал.
 *
 * ── Яагаад тусдаа файл вэ ────────────────────────────────────────
 *
 * Дараалал нь ЧИМЭЭГҮЙ алддаг код: үр дүн эмх замбараагүй эрэмбээр
 * буцах, явцын тоо давхардах, цуцлахад ажил үргэлжлэх, нэг зураг унахад
 * бүх багц зогсох. Эдгээрийн аль нь ч алдаа шиддэггүй — зүгээр л буруу
 * ажиллана.
 *
 * DOM-гүй, Worker-гүй цэвэр функц тул `test/batch.test.ts` шууд шалгана.
 *
 * ── Баталгаанууд ────────────────────────────────────────────────
 *
 *   1. Үр дүн нь ОРОЛТЫН эрэмбээр буцна (IMG_001 эхэнд).
 *   2. Зэрэг ажиллах тоо `concurrency`-оос ХЭТРЭХГҮЙ.
 *   3. Нэг зураг унахад бусад нь үргэлжилнэ.
 *   4. Цуцлахад ШИНЭ ажил эхлэхгүй, дуусаагүйг нь `cancelled` гэж тэмдэглэнэ.
 *   5. Явцын тоо яг нэг удаа нэмэгдэнэ.
 */

export type BatchStatus = 'pending' | 'running' | 'done' | 'error' | 'cancelled';

export interface BatchEntry<R> {
  /** Оролтын дугаар — эрэмбэ хадгалахад. */
  index: number;
  /** Хэрэглэгчид харуулах нэр (файлын нэр). */
  name: string;
  status: BatchStatus;
  result?: R;
  /** Хэрэглэгчид харуулах ЭНГИЙН шалтгаан. Техникийн мессеж биш. */
  reason?: string;
}

export interface BatchOptions<R> {
  /** Зэрэг хэдэн ажил явуулах вэ. Анхдагч 2. */
  concurrency?: number;
  signal?: AbortSignal;
  /** Ажил бүр дуусах бүрд дуудагдана — явц харуулахад. */
  onProgress?: (done: number, total: number, entry: BatchEntry<R>) => void;
}

/** Техникийн алдааг хэрэглэгчийн өгүүлбэр болгоно. */
export const friendlyReason = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    /*
     * Зориуд шидсэн, монголоор бичсэн мессежийг дамжуулна. Кирилл үсэг
     * агуулж байвал энэ нь хэрэглэгчид зориулсан гэсэн үг.
     */
    if (/[Ѐ-ӿ]/.test(error.message)) return error.message;
  }
  return 'Боловсруулж чадсангүй. Өөр зураг оруулна уу.';
};

/**
 * Ажлуудыг хязгаарлагдмал зэрэгцээлтэйгээр гүйцэтгэнэ.
 *
 * `Promise.all` ашиглаж болохгүй: тэр нь БҮГДийг зэрэг эхлүүлнэ. 30 зураг
 * зэрэг задлах гэж оролдвол санах ой дүүрч, таб унана. Мөн эхний алдаа
 * бүхэл багцыг зогсооно.
 */
export async function runBatch<I, R>(
  items: readonly I[],
  nameOf: (item: I, index: number) => string,
  work: (item: I, index: number) => Promise<R>,
  options: BatchOptions<R> = {},
): Promise<BatchEntry<R>[]> {
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const { signal, onProgress } = options;

  const entries: BatchEntry<R>[] = items.map((item, index) => ({
    index,
    name: nameOf(item, index),
    status: 'pending',
  }));

  let next = 0;
  let done = 0;

  const runOne = async (): Promise<void> => {
    for (;;) {
      /*
       * Дугаарыг ХУВААРИЛАХ ба ӨСГӨХ хоёрын хооронд `await` байхгүй —
       * тиймээс хоёр ажилтан ижил дугаар авахгүй. `await`-ыг энд оруулбал
       * нэг зураг хоёр удаа боловсруулагдана.
       */
      const index = next;
      next += 1;
      if (index >= entries.length) return;

      const entry = entries[index];

      if (signal?.aborted) {
        entry.status = 'cancelled';
        continue;
      }

      entry.status = 'running';
      try {
        entry.result = await work(items[index], index);
        entry.status = 'done';
      } catch (error) {
        // Нэг зураг унах нь багцыг зогсоох ёсгүй.
        console.error(`[багц] ${entry.name} боловсруулалт амжилтгүй`, error);
        entry.status = 'error';
        entry.reason = friendlyReason(error);
      }

      done += 1;
      onProgress?.(done, entries.length, entry);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, entries.length) }, runOne));

  return entries;
}

/** Багцын товч дүн — хэрэглэгчид нэг мөрөөр харуулахад. */
export interface BatchSummary {
  total: number;
  done: number;
  failed: number;
  cancelled: number;
}

export const summarize = <R>(entries: readonly BatchEntry<R>[]): BatchSummary => ({
  total: entries.length,
  done: entries.filter((e) => e.status === 'done').length,
  failed: entries.filter((e) => e.status === 'error').length,
  cancelled: entries.filter((e) => e.status === 'cancelled').length,
});
