import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_ADJUST,
  cssFilterFor,
  isDefaultAdjust,
  normalizeAdjust,
} from '../src/lib/adjust';

test('гажсан утгыг аюулгүй болгоно', () => {
  assert.deepEqual(normalizeAdjust(null), DEFAULT_ADJUST);
  assert.deepEqual(normalizeAdjust(undefined), DEFAULT_ADJUST);
  assert.deepEqual(normalizeAdjust({}), DEFAULT_ADJUST);

  assert.equal(normalizeAdjust({ rotate: 45 } as never).rotate, 0);
  assert.equal(normalizeAdjust({ rotate: 180 }).rotate, 180);
  assert.equal(normalizeAdjust({ brightness: NaN }).brightness, 0);
  assert.equal(normalizeAdjust({ brightness: 999 }).brightness, 100);
  assert.equal(normalizeAdjust({ brightness: -999 }).brightness, -100);
  assert.equal(normalizeAdjust({ contrast: 999 }).contrast, 100);
  assert.equal(normalizeAdjust({ filter: 'sepia' } as never).filter, 'none');
  assert.equal(normalizeAdjust({ filter: 'vivid' }).filter, 'vivid');
});

test('isDefaultAdjust нь хөндөөгүйг л үнэн гэнэ', () => {
  assert.equal(isDefaultAdjust(DEFAULT_ADJUST), true);
  assert.equal(isDefaultAdjust({ rotate: 0, brightness: 0, contrast: 0, filter: 'none' }), true);
  assert.equal(isDefaultAdjust({ ...DEFAULT_ADJUST, rotate: 90 }), false);
  assert.equal(isDefaultAdjust({ ...DEFAULT_ADJUST, brightness: 1 }), false);
  assert.equal(isDefaultAdjust({ ...DEFAULT_ADJUST, contrast: -1 }), false);
  assert.equal(isDefaultAdjust({ ...DEFAULT_ADJUST, filter: 'bw' }), false);
});

test('cssFilterFor хөндөөгүй үед хоосон мөр буцаана', () => {
  assert.equal(cssFilterFor(DEFAULT_ADJUST), '');
});

test('cssFilterFor гэрэлтүүлэг/контрастыг зөв хэлхээнд оруулна', () => {
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 20, contrast: 0, filter: 'none' }),
    'brightness(1.200)',
  );
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 0, contrast: -10, filter: 'none' }),
    'contrast(0.900)',
  );
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 10, contrast: 10, filter: 'none' }),
    'brightness(1.100) contrast(1.100)',
  );
});

test('cssFilterFor загвар бүрт тогтмол хэлхээ өгнө', () => {
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 0, contrast: 0, filter: 'bw' }),
    'grayscale(1) contrast(1.08)',
  );
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 0, contrast: 0, filter: 'warm' }),
    'sepia(0.35) saturate(1.3) hue-rotate(-6deg)',
  );
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 0, contrast: 0, filter: 'cool' }),
    'saturate(1.15) hue-rotate(-12deg) brightness(1.02)',
  );
  assert.equal(
    cssFilterFor({ rotate: 0, brightness: 0, contrast: 0, filter: 'vivid' }),
    'saturate(1.45) contrast(1.1) brightness(1.02)',
  );
});

test('cssFilterFor эргүүлэлтэд хамаарахгүй — зөвхөн өнгөний тохиргоо', () => {
  const a = cssFilterFor({ rotate: 0, brightness: 5, contrast: 0, filter: 'none' });
  const b = cssFilterFor({ rotate: 180, brightness: 5, contrast: 0, filter: 'none' });
  assert.equal(a, b);
});
