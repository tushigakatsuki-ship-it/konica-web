import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ADJUST,
  brightnessFilterValue,
  isDefaultAdjust,
  scaledBlurPx,
  type Adjust,
} from '../src/lib/adjust';

/**
 * ⚠️ `isDefaultAdjust` бол `photoRender.ts`-ийн `applyAdjust`-ийн эрт гарах
 * нөхцөл — `DEFAULT_ADJUST`-тай (Цээж зурагтай БУС бүх 11 ангилал үргэлж
 * үүнийг дамжуулна) энэ функц `true` буцаагаагүй бол тэдгээрийн гаралт
 * дэмий нэмэлт canvas дамжлагаар дайрч, өнгө/чанар хэдийн ч бага зэрэг
 * өөрчлөгдөх эрсдэлтэй болно.
 */

test('DEFAULT_ADJUST бол isDefaultAdjust true', () => {
  assert.equal(isDefaultAdjust(DEFAULT_ADJUST), true);
});

test('brightness/blur/sharpen/bg аль нэг нь өөрчлөгдвөл isDefaultAdjust false', () => {
  const variants: Adjust[] = [
    { ...DEFAULT_ADJUST, brightness: 10 },
    { ...DEFAULT_ADJUST, blur: 1 },
    { ...DEFAULT_ADJUST, sharpen: true },
    { ...DEFAULT_ADJUST, bg: 'white' },
  ];
  for (const variant of variants) assert.equal(isDefaultAdjust(variant), false);
});

test('brightnessFilterValue: 0 үед яг 1 (өөрчлөлтгүй)', () => {
  assert.equal(brightnessFilterValue(0), 1);
});

test('brightnessFilterValue: -40..40 хязгаарт 0.7..1.3 руу шугаман', () => {
  assert.equal(brightnessFilterValue(40), 1.3);
  assert.equal(brightnessFilterValue(-40), 0.7);
});

test('scaledBlurPx: гаралтын нягтралаар шугаман хэмжээлнэ', () => {
  // Эталон нягтралтай тэнцүү бол өөрчлөгдөхгүй.
  assert.equal(scaledBlurPx(2, 640, 640), 2);
  // 5 дахин том canvas дээр 5 дахин илүү blur — эс тэгвээс preview дээрх
  // «2px» хэвлэлийн canvas дээр бараг үл ажиглагдана.
  assert.equal(scaledBlurPx(2, 3200, 640), 10);
});
