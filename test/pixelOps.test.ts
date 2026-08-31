import assert from 'node:assert/strict';
import test from 'node:test';
import { sharpenKernel3x3 } from '../src/lib/pixelOps';

const w = 5;
const h = 5;

test('sharpenKernel3x3: хавтгай хэсэгт identity (өөрчлөгдөхгүй)', () => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p += 1) {
    data[p * 4] = 128;
    data[p * 4 + 1] = 128;
    data[p * 4 + 2] = 128;
    data[p * 4 + 3] = 255;
  }

  const out = sharpenKernel3x3(data, w, h);
  for (let i = 0; i < data.length; i += 1) assert.equal(out[i], data[i]);
});

test('sharpenKernel3x3: ирмэг дээр контраст нэмэгдүүлнэ', () => {
  const data = new Uint8ClampedArray(w * h * 4);
  // Зүүн 2 багана бараан (50), баруун талд цайвар (200) — босоо ирмэг.
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const p = (y * w + x) * 4;
      const v = x < 2 ? 50 : 200;
      data[p] = v;
      data[p + 1] = v;
      data[p + 2] = v;
      data[p + 3] = 255;
    }
  }

  const out = sharpenKernel3x3(data, w, h);

  // Ирмэгт ойрхон цайвар пиксел (x=2,y=2): 5×200 − 200(дээш) − 200(доош)
  // − 50(зүүн, бараан хөрш) − 200(баруун) = 350 → 255-д clamp хийгдэнэ.
  const edgeIdx = (2 * w + 2) * 4;
  assert.equal(out[edgeIdx], 255);
  assert.ok(out[edgeIdx] > data[edgeIdx], 'ирмэгийн контраст нэмэгдээгүй');

  // Хавтгай (ирмэгээс хол) бараан хэсэг өөрчлөгдөхгүй.
  const flatIdx = (2 * w + 0) * 4;
  assert.equal(out[flatIdx], data[flatIdx]);

  // Альфа суваг хөндөгдөөгүй.
  assert.equal(out[edgeIdx + 3], 255);
});
