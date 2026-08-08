import assert from 'node:assert/strict';
import test from 'node:test';
import { paidText } from '../api/_notify';

/**
 * Төлбөр орсны мэдэгдэл бол ажлын урсгалын гол дохио — ажилтан үүнийг хараад
 * хэвлэж эхэлдэг. Тиймээс захиалгын дугаар, дүн, зургийн тоо ЗААВАЛ багтана.
 */

const base = {
  orderNumber: 'PMN-260806-4821',
  amount: 12_000,
  photoCount: 3,
  customer: 'Батболд',
  phone: '99001234',
} as const;

test('QPay төлбөрийн мэдэгдэлд шаардлагатай бүх зүйл байна', () => {
  const text = paidText({ ...base, method: 'qpay' });

  assert.ok(text.includes('PMN-260806-4821'));
  assert.ok(text.includes('12,000₮'));
  assert.ok(text.includes('QPay'));
  assert.ok(text.includes('3 зураг татахад бэлэн'));
  assert.ok(text.includes('99001234'));
});

test('гараар баталгаажуулсныг ялгаж бичнэ', () => {
  const text = paidText({ ...base, method: 'manual' });
  assert.ok(text.includes('гараар баталгаажуулсан'));
  assert.ok(!text.includes('QPay'));
});

test('зураггүй захиалганд зургийн мөр гарахгүй', () => {
  const text = paidText({ ...base, photoCount: 0, method: null });
  assert.ok(!text.includes('зураг'));
  assert.ok(text.includes('PMN-260806-4821'));
});
