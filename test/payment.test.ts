import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isPaid,
  pendingPayment,
  readBankInstructions,
  type PaymentInfo,
} from '../api/_payment';
import { readQPayConfig } from '../api/_qpay';

test('шинэ захиалга үргэлж төлөгдөөгүй байдалтай эхэлнэ', () => {
  const payment = pendingPayment(12_000);
  assert.equal(payment.status, 'pending');
  assert.equal(payment.amount, 12_000);
  assert.equal(payment.method, null);
  assert.equal(isPaid(payment), false);
});

test('isPaid нь зөвхөн тодорхой "paid" төлөвт үнэн', () => {
  assert.equal(isPaid(undefined), false);
  assert.equal(isPaid({ status: 'pending', amount: 1, method: null }), false);
  assert.equal(isPaid({ status: 'paid', amount: 1, method: 'manual' }), true);

  // Хуучин, төлбөрийн талбаргүй manifest — төлөгдөөгүй гэж үзнэ.
  const legacy = undefined as PaymentInfo | undefined;
  assert.equal(isPaid(legacy), false);
});

test('банкны заавар — дутуу тохиргоотой бол null', () => {
  assert.equal(readBankInstructions({}, 'PMN-260806-4821', 5000), null);
  assert.equal(
    readBankInstructions({ BANK_NAME: 'Хаан банк' }, 'PMN-260806-4821', 5000),
    null,
  );
});

test('банкны зааврын гүйлгээний утга нь ЗААВАЛ захиалгын дугаар', () => {
  const bank = readBankInstructions(
    { BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567', BANK_HOLDER: 'Принтмн ХХК' },
    'PMN-260806-4821',
    12_000,
  );
  assert.deepEqual(bank, {
    bank: 'Хаан банк',
    account: '5001234567',
    holder: 'Принтмн ХХК',
    iban: '',
    reference: 'PMN-260806-4821',
    amount: 12_000,
  });
});

test('IBAN нь ЗААВАЛ БИШ — хоосон бол хоосон мөр буцна', () => {
  /*
   * Дотоодын шилжүүлэгт IBAN хэрэггүй. `BANK_IBAN` тохируулаагүй байхад
   * `undefined` буцаавал интерфейс дээр «undefined» гэсэн үг хэвлэгдэх
   * эрсдэлтэй тул үргэлж мөр буцаана.
   */
  const bank = readBankInstructions(
    { BANK_NAME: 'Хаан банк', BANK_ACCOUNT: '5001234567' },
    'PMN-260806-48213',
    5_000,
  );
  assert.equal(bank?.iban, '');
});

test('IBAN-ы зайг нягтруулж, том үсэг болгоно', () => {
  /*
   * Банкны аппаас хуулахад `MN95 0005 0050 3529 8851` гэж бүлэглэсэн
   * хэлбэрээр ирдэг. Зарим банкны апп зайтай утгыг хүлээж авдаггүй тул
   * хэрэглэгч хуулаад буулгахад алдаа өгнө.
   */
  const bank = readBankInstructions(
    {
      BANK_NAME: 'Хаан банк',
      BANK_ACCOUNT: '5035298851',
      BANK_IBAN: 'mn95 0005 0050 3529 8851',
    },
    'PMN-260806-48213',
    5_000,
  );
  assert.equal(bank?.iban, 'MN950005005035298851');
  assert.equal(bank?.iban.length, 20, 'Монголын IBAN 20 тэмдэгт байх ёстой');
});

test('QPay тохиргоо — гурван талбар бүрэн байж л идэвхжинэ', () => {
  assert.equal(readQPayConfig({}), null);
  assert.equal(readQPayConfig({ QPAY_USERNAME: 'u', QPAY_PASSWORD: 'p' }), null);

  const config = readQPayConfig({
    QPAY_USERNAME: 'u',
    QPAY_PASSWORD: 'p',
    QPAY_INVOICE_CODE: 'PRINTMN_INVOICE',
  })!;
  // Анхдагчаар үйлдвэрлэлийн орчин.
  assert.equal(config.baseUrl, 'https://merchant.qpay.mn');
  assert.equal(config.invoiceCode, 'PRINTMN_INVOICE');
});

test('QPAY_BASE_URL-ийн төгсгөлийн ташуу зураас арилна', () => {
  const config = readQPayConfig({
    QPAY_USERNAME: 'u',
    QPAY_PASSWORD: 'p',
    QPAY_INVOICE_CODE: 'c',
    QPAY_BASE_URL: 'https://merchant-sandbox.qpay.mn/',
  })!;
  assert.equal(config.baseUrl, 'https://merchant-sandbox.qpay.mn');
});
