/**
 * Олон зураг нэг дор боловсруулах — Worker сан дээр.
 *
 * ── Хоёр зам, НЭГ логик ──────────────────────────────────────────
 *
 * Worker дэмждэг хөтөч дээр ажил тусдаа урсгалд явна. Дэмждэггүй бол
 * үндсэн урсгалаас `processPhoto` шууд дуудагдана. Хоёр тохиолдолд ЯГ
 * ижил функц ажиллана — үр дүн зөрөх боломжгүй.
 *
 * Fallback нь интерфейсийг царцаана, гэхдээ ажиллана. Ажиллахгүй байхаас
 * удаан ажилласан нь дээр.
 */

import { runBatch, type BatchEntry, type BatchOptions } from './batch';
import { processPhoto, type ProcessRequest, type ProcessResponse } from './processPhoto';

/** Нэг зурагт ногдох тохиргоо — файл болон дугаараас бусад нь ижил. */
export type PhotoSettings = Omit<ProcessRequest, 'id' | 'blob'>;

/**
 * Зэрэг ажиллах Worker-ийн тоо.
 *
 * Цөмийн тоог бүтнээр нь идэх нь буруу: хөтөч өөрөө, зурагдалт, дуу
 * зэрэгт цөм хэрэгтэй. Мөн Worker бүр ONNX загварыг ТУСДАА санах ойд
 * ачаалдаг тул олон Worker нь санах ойг үржүүлнэ.
 */
export const workerCount = (): number => {
  const cores = typeof navigator === 'undefined' ? 2 : (navigator.hardwareConcurrency ?? 2);
  return Math.max(1, Math.min(3, cores - 1));
};

const workersSupported = (): boolean =>
  typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';

/** Ажлын дараалалд хүлээгдэж буй хариунууд. */
type Pending = Map<number, (response: ProcessResponse) => void>;

class Pool {
  private workers: Worker[] = [];
  private free: Worker[] = [];
  private pending: Pending = new Map();
  private nextId = 0;

  constructor(size: number) {
    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(new URL('../workers/photo.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (event: MessageEvent<ProcessResponse>) => {
        const resolve = this.pending.get(event.data.id);
        this.pending.delete(event.data.id);
        this.free.push(worker);
        resolve?.(event.data);
      };
      this.workers.push(worker);
      this.free.push(worker);
    }
  }

  async run(blob: Blob, settings: PhotoSettings): Promise<ProcessResponse> {
    const worker = this.free.pop();
    /*
     * `runBatch`-ийн зэрэгцээлт нь сангийн хэмжээтэй тэнцүү тул энэ нь
     * гарах ёсгүй. Гарвал чимээгүй буруу ажиллахаас илт унасан нь дээр.
     */
    if (!worker) throw new Error('Боловсруулах орчин завгүй байна.');

    const id = this.nextId;
    this.nextId += 1;

    return new Promise<ProcessResponse>((resolve) => {
      this.pending.set(id, resolve);
      worker.postMessage({ ...settings, id, blob } satisfies ProcessRequest);
    });
  }

  dispose(): void {
    for (const worker of this.workers) worker.terminate();
    this.workers = [];
    this.free = [];
    this.pending.clear();
  }
}

export interface PhotoBatchOptions
  extends Pick<BatchOptions<ProcessResponse>, 'signal' | 'onProgress'> {
  settings: PhotoSettings;
}

/**
 * Файлуудыг багцаар боловсруулна.
 *
 * Амжилтгүй зураг нь БАГЦЫГ ЗОГСООХГҮЙ — тухайн мөр нь шалтгаантайгаа
 * тэмдэглэгдэж, бусад нь үргэлжилнэ.
 */
export async function processFiles(
  files: readonly File[],
  options: PhotoBatchOptions,
): Promise<BatchEntry<ProcessResponse>[]> {
  const concurrency = workersSupported() ? workerCount() : 1;
  const pool = workersSupported() ? new Pool(concurrency) : null;

  try {
    return await runBatch(
      files,
      (file) => file.name,
      async (file, index) => {
        const response = pool
          ? await pool.run(file, options.settings)
          : await processPhoto({ ...options.settings, id: index, blob: file });

        /*
         * «Нүүр олдсонгүй» гэдэг нь ПРОГРАМЫН алдаа биш, зургийн шинж.
         * Гэхдээ багцын мөр дээр улаанаар тэмдэглэгдэх ёстой тул шидэж,
         * `runBatch` барина. Мессеж нь монголоор тул хэрэглэгчид шууд
         * харагдана (`friendlyReason`-ыг үз).
         */
        if (!response.ok) throw new Error(response.reason ?? 'Боловсруулж чадсангүй');
        return response;
      },
      { concurrency, signal: options.signal, onProgress: options.onProgress },
    );
  } finally {
    pool?.dispose();
  }
}
