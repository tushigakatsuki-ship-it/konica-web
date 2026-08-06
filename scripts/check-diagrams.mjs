/**
 * docs/*.md доторх Mermaid блокуудыг mermaid-ийн ӨӨРИЙНХ нь parser-ээр шалгана.
 *
 * Диаграм эвдэрсэн эсэхийг нүдээр харах хүртэл мэдэхгүй байх нь амархан:
 * GitHub зүгээр л улаан хайрцаг үзүүлээд өнгөрдөг. Энэ шалгалт CI дээр л
 * барина.
 *
 * Хэрэглээ:  node scripts/check-diagrams.mjs docs/ARCHITECTURE.md
 */

import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.SVGElement = dom.window.SVGElement;
// `navigator` нь зөвхөн getter-тэй тул шууд оноож болохгүй.
Object.defineProperty(globalThis, 'navigator', {
  value: dom.window.navigator,
  configurable: true,
});

const { default: mermaid } = await import('mermaid');
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Хэрэглээ: node scripts/check-diagrams.mjs <файл.md> …');
  process.exit(2);
}

let total = 0;
let failed = 0;

for (const file of files) {
  const blocks = [
    ...fs.readFileSync(file, 'utf8').matchAll(/```mermaid\n([\s\S]*?)```/g),
  ].map((match) => match[1]);

  console.log(`\n${file} — ${blocks.length} диаграм`);

  for (const [index, code] of blocks.entries()) {
    total++;
    const kind = code.trim().split(/\s|\n/)[0];
    try {
      await mermaid.parse(code);
      console.log(`  OK    #${index + 1} ${kind}`);
    } catch (error) {
      failed++;
      const first = String(error?.message ?? error).split('\n')[0];
      console.log(`  FAIL  #${index + 1} ${kind}\n        ${first}`);
    }
  }
}

console.log(`\n${total - failed}/${total} диаграм зөв`);
process.exit(failed === 0 ? 0 : 1);
