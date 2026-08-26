/**
 * Байршуулалтын явцын тооцоо.
 *
 * ⚠️ Яагаад `upload.ts`-аас тусдаа файл вэ: `upload.ts` нь `../state/basket`
 * (`.tsx`) руу хэлхээтэй тул тест дотроос импортлоход `tsc -b` нь `--jsx`
 * тохируулаагүй гэж унадаг. Энэ логик нь `Blob`, `XMLHttpRequest`, React
 * гурвын алинд ч хамаагүй цэвэр тоо бодолт учир тусад нь байрлаж, эх кодыг
 * regex-ээр уншдаггүй ЖИНХЭНЭ тестээр хучигдана.
 */

/** Зураг бүрийн ажлаас бэлтгэлд ногдох хувь; үлдсэн нь илгээлтэд. */
export const PREPARE_SHARE = 0.15;

export interface UploadProgress {
  /** 0–1. ХЭЗЭЭ Ч буурахгүй. */
  ratio: number;
  /**
   * ⚠️ Хоёул ЗУРГИЙН тоо, файлын тоо БИШ.
   *
   * Зураг бүрээс хоёр файл (`print` + `original`) гардаг тул файлаар тоолвол
   * 30 зураг оруулсан хэрэглэгч «24/60» гэж хардаг байв — тэр 60 нь хаанаас
   * гарсныг ойлгох боломжгүй.
   */
  done: number;
  total: number;
}

/**
 * Зураг бүрээс гарах файлууд — ЭНЭ ДАРААЛЛААР хаяг захиалагдана.
 *
 * ⚠️ ЭНЭ БОЛ ГАНЦ ЭХ СУРВАЛЖ. `upload.ts` хаягуудыг захиалахдаа энэ жагсаалтыг
 * ашиглах ба `slotIndex` мөн эндээс тоолно.
 *
 * Яагаад ийм болгосон бэ: урьд нь дараалал ХОЁР газар бичигдсэн байв —
 * `upload.ts` дотор `[print, original]` гэсэн жагсаалт, энд `kind === 'print'
 * ? 0 : 1` гэсэн тооцоо. Хэн нэг нь `upload.ts`-ийн дарааллыг сольвол
 * `slotIndex` чимээгүй буруу тоо буцааж, ХЭВЛЭХ файл нь ЭХ ФАЙЛЫН хаяг руу
 * илгээгдэнэ. R2 алдаа өгөхгүй — тэр хоёулаа хүчинтэй хаяг. Ажилтан хэвлэх
 * файл нээхэд эх файл гарч ирнэ.
 *
 * Telegram-ийн товч яг ийм давхардлаас болж эвдэрсэн. Тэр сургамжаар нэгтгэв.
 */
export const FILE_KINDS = ['print', 'original'] as const;

export type FileKind = (typeof FILE_KINDS)[number];

/** Тухайн зургийн тухайн төрлийн файл хаягийн жагсаалтын хэддүгээрт байх вэ. */
export const slotIndex = (photo: number, kind: FileKind): number =>
  photo * FILE_KINDS.length + FILE_KINDS.indexOf(kind);

/**
 * Явцын төлөв.
 *
 * ⚠️ Мөр ХЭЗЭЭ Ч буцаж татагдахгүй (`shown` нь зөвхөн өснө). Дахин оролдох үед
 * илгээсэн байт тэглэгддэг тул түүхий тооцоо бодитоор буурдаг — гэхдээ буцсан
 * мөр нь хэрэглэгчид «алдаа гарлаа, эхнээс нь эхэллээ» гэсэн худал дохио өгнө.
 * Зогссон мөр нь буцсан мөрөөс дээр.
 *
 * `done` нь зөвхөн БҮРЭН орсон зургийг тоолдог тул өөрөө буцах боломжгүй.
 */
export const createProgress = (total: number) => {
  const weight = new Array<number>(Math.max(0, total)).fill(0);
  let done = 0;
  let shown = 0;

  const snapshot = (): UploadProgress => {
    const raw =
      total === 0 ? 1 : weight.reduce((sum, value) => sum + value, 0) / total;
    shown = Math.max(shown, raw);
    return { ratio: shown, done, total };
  };

  return {
    /** Зураг бэлдэгдэж дуусав — илгээлт хараахан эхлээгүй. */
    prepared(photo: number): UploadProgress {
      weight[photo] = Math.max(weight[photo], PREPARE_SHARE);
      return snapshot();
    },

    /** Тухайн зургийн файлуудын `fraction` хувь нь сүлжээгээр гарав. */
    sending(photo: number, fraction: number): UploadProgress {
      weight[photo] = PREPARE_SHARE + (1 - PREPARE_SHARE) * fraction;
      return snapshot();
    },

    /**
     * Зургийн БҮХ файл амжилттай орлоо.
     *
     * Зөвхөн `print` нь орсон зургийг тоолж болохгүй: ажилтанд эх файл
     * очихгүй бол буруу тайралт, өнгө засах аргагүй тул тэр зураг практикт
     * бүтэн ирээгүйтэй адил.
     */
    finished(photo: number): UploadProgress {
      weight[photo] = 1;
      done += 1;
      return snapshot();
    },

    snapshot,
  };
};
