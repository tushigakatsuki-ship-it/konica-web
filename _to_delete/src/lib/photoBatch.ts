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
type Pending = Map<number, { resolve: (r: ProcessResponse) => void; reject: (e: Error) => void }>;

/** Сан эвдэрсэн үед шидэгдэнэ — дуудагч тал үндсэн урсгал руу буцна. */
class PoolFailure extends Error {}

class Pool {
  private workers: Worker[] = [];
  private free: Worker[] = [];
  private pending: Pending = new Map();
  private nextId = 0;
  /** Нэг ч worker унасан бол сан бүхэлдээ найдваргүй гэж үзнэ. */
  private broken = false;

  constructor(size: number) {
    for (let i = 0; i < size; i += 1) {
      const worker = new Worker(new URL('../workers/photo.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (event: MessageEvent<ProcessResponse>) => {
        const waiting = this.pending.get(event.data.id);
        this.pending.delete(event.data.id);
        this.free.push(worker);
        waiting?.resolve(event.data);
      };

      /*
       * ⚠️ ГАЦАХААС сэргийлэх.
       *
       * `onerror` барихгүй бол worker ачаалагдаж чадаагүй үед (модуль worker
       * дэмждэггүй хуучин хөтөч, сүлжээ тасарсан, chunk олдоогүй) `run`-ийн
       * promise ХЭЗЭЭ Ч шийдэгдэхгүй. Хэрэглэгч «боловсруулж байна…»
       * гэсэн бичгийг үүрд хардаг — алдаа ч гарахгүй, явц ч урагшлахгүй.
       *
       * Энэ бол чимээгүй гацалт: тестээр барихад хэцүү, хэрэглэгч гомдоллох
       * хүртэл мэдэгдэхгүй.
       */
      worker.onerror = (event) => {
        console.error('[worker] ачаалж чадсангүй', event);
        this.broken = true;
        for (const waiting of this.pending.values()) {
          waiting.reject(new PoolFailure('Worker ачаалагдсангүй'));
        }
        this.pending.clear();
      };

      this.workers.push(worker);
      this.free.push(worker);
    }
  }

  get usable(): boolean {
    return !this.broken;
  }

  async run(blob: Blob, settings: PhotoSettings): Promise<ProcessResponse> {
    if (this.broken) throw new PoolFailure('Сан эвдэрсэн');

    const worker = this.free.pop();
    /*
     * `runBatch`-ийн зэрэгцээлт нь сангийн хэмжээтэй тэнцүү тул энэ нь
     * гарах ёсгүй. Гарвал чимээгүй буруу ажиллахаас илт унасан нь дээр.
     */
    if (!worker) throw new PoolFailure('Боловсруулах орчин завгүй байна');

    const id = this.nextId;
    this.nextId += 1;

    return new Promise<ProcessResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
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
        /*
         * Worker ажиллахгүй бол ҮНДСЭН УРСГАЛ руу буцна.
         *
         * Интерфейс царцах ч ажиллана. Ажиллахгүй байхаас удаан ажилласан
         * нь дээр — ялангуяа модуль worker дэмждэггүй хуучин хөтөч дээр
         * `workersSupported()` шалгалт үүнийг урьдчилж мэдэж чадахгүй.
         */
        const direct = () =>
          processPhoto({ ...options.settings, id: index, blob: file });

        let response: ProcessResponse;
        if (pool?.usable) {
          try {
            response = await pool.run(file, options.settings);
          } catch (error) {
            if (!(error instanceof PoolFailure)) throw error;
            response = await direct();
          }
        } else {
          response = await direct();
        }

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
