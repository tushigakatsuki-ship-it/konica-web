/**
 * Төлбөрийн төлөв.
 *
 * Дүрэм: **төлбөр баталгаажтал зураг ажилтанд харагдахгүй.** Файл нь R2 руу
 * шууд байршдаг (тэгэхгүй бол хэрэглэгч банкны апп руу шилжих үед браузер
 * хаагдвал зураг алдагдана), гэхдээ `/api/admin` төлөөгүй захиалганд татах
 * линк ОГТ буцаадаггүй. Өөрөөр хэлбэл түгжээ нь сан дээр биш, линк олгох
 * үе шат дээр байна — энэ нь алдаанд илүү тэсвэртэй: manifest уншиж чадаагүй
 * ч линк үүсэхгүй.
 */

export type PaymentStatus = 'pending' | 'paid';
export type PaymentMethod = 'qpay' | 'manual';

export interface PaymentInfo {
  status: PaymentStatus;
  /** Төлөх ёстой дүн — серверийн тооцоолсон утга. */
  amount: number;
  method: PaymentMethod | null;
  /** QPay-ийн нэхэмжлэлийн id — callback ирэхэд шалгахад. */
  invoiceId?: string;
  paidAt?: number;
  /** Гараар баталгаажуулсан ажилтны тэмдэглэл. */
  note?: string;
}

export const pendingPayment = (amount: number): PaymentInfo => ({
  status: 'pending',
  amount,
  method: null,
});

export const isPaid = (payment: PaymentInfo | undefined): boolean =>
  payment?.status === 'paid';

/** Дансаар шилжүүлэх заавар — QPay тохируулаагүй эсвэл хэрэглэгч сонгоогүй үед. */
export interface BankInstructions {
  bank: string;
  account: string;
  holder: string;
  /**
   * IBAN — ЗААВАЛ БИШ.
   *
   * Дотоодын шилжүүлэгт ердийн дансны дугаар хангалттай тул ихэнх
   * үйлчлүүлэгчид энэ хэрэггүй. Байгууллагын нягтлан, банк хооронд
   * шилжүүлэг хийдэг хүнд л хэрэгтэй болдог. `BANK_IBAN` хоосон бол
   * интерфейст энэ мөр огт гарахгүй.
   */
  iban: string;
  /** Гүйлгээний утга — ЗААВАЛ захиалгын дугаар байх ёстой. */
  reference: string;
  amount: number;
}

export const readBankInstructions = (
  env: Record<string, string | undefined>,
  orderNumber: string,
  amount: number,
): BankInstructions | null => {
  const bank = env.BANK_NAME ?? '';
  const account = env.BANK_ACCOUNT ?? '';
  const holder = env.BANK_HOLDER ?? '';
  /*
   * Зайг зайлуулна: IBAN-ыг банкны аппаас хуулахад `MN95 0005 0050 3529 8851`
   * гэсэн бүлэглэсэн хэлбэрээр ирдэг. Хэрэглэгч түүнийг хуулж аппдаа буулгахад
   * зарим банк зайтай утгыг хүлээж авдаггүй — тиймээс нягт хэлбэрээр хадгална.
   */
  const iban = (env.BANK_IBAN ?? '').replace(/\s+/g, '').toUpperCase();
  if (!bank || !account) return null;
  return { bank, account, holder, iban, reference: orderNumber, amount };
};
