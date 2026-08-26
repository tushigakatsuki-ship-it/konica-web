import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * TypeScript ↔ Python хоорондын ГЭРЭЭ.
 *
 * ── Яагаад энэ файл байгаа вэ ────────────────────────────────────
 *
 * `api/admin.ts` нь JSON гаргадаг, `scripts/nas-sync.py` нь түүнийг уншдаг.
 * Хоёулаа өөр хэлээр бичигдсэн тул TypeScript-ийн хөрвүүлэгч ч, Python ч
 * хооронд нь холбоог хардаггүй. `shape()` дотор талбарын нэр солиход:
 *
 *   • TypeScript тестүүд ногоон хэвээр,
 *   • `nas-sync-test.py` ч ногоон хэвээр (тэр өөрийн ГАРААР бичсэн загварыг
 *     уншдаг тул TypeScript өөрчлөгдсөнийг мэдэхгүй),
 *   • зөвхөн production дээр л илэрнэ: дэлгүүрийн компьютер файлаа олохоо
 *     болино, төлбөр орсон захиалгын зураг чимээгүй ирэхээ болино.
 *
 * Telegram-ийн товч яг ийм «хоёр тал тусдаа мэддэг» алдаанаас болж эвдэрсэн.
 * Энэ тест нь Python скриптийн ЖИНХЭНЭ эх кодыг уншиж, шаардаж буй талбар
 * бүр TypeScript талд байсаар байгааг шалгана.
 *
 * ⚠️ Энэ нь бүрэн баталгаа биш — нэр таарч байгааг л шалгана, утгын утга
 * учрыг биш. Гэхдээ талбар нэр солих нь хамгийн түгээмэл бөгөөд хамгийн
 * чимээгүй эвдрэл тул зөвхөн үүнийг барьсан ч үнэ цэнтэй.
 */

/*
 * Замыг `process.cwd()`-ээс барина — `import.meta.url` БИШ.
 *
 * Тестүүд esbuild-ээр CJS болж `.tmp/` дотор багцлагддаг тул `import.meta.url`
 * тэнд хүчингүй болно. Бусад тестүүд ч (`customer-web.test.ts`) ижил аргаар.
 */
const root = process.cwd();
const read = (file: string): string => readFileSync(path.join(root, file), 'utf8');

/** `scripts/nas-sync.py` уншдаг талбарууд — гараар биш, эх кодоос гаргана. */
const pythonReads = (): Set<string> => {
  const source = read('scripts/nas-sync.py');
  const names = new Set<string>();
  // `x.get("нэр")` болон `x["нэр"]` хоёуланг нь барина.
  for (const match of source.matchAll(/\.get\(\s*"([a-zA-Z]+)"/g)) names.add(match[1]);
  for (const match of source.matchAll(/\[\s*"([a-zA-Z]+)"\s*\]/g)) names.add(match[1]);
  return names;
};

test('Python скриптийн уншдаг талбарууд TypeScript талд БАЙНА', () => {
  const needed = pythonReads();

  /*
   * Python-ы уншдаг нэрсээс серверийн гэрээнд ХАМААРАХГҮЙ нь (өөрийн
   * тохиргооны түлхүүр, HTTP толгой гэх мэт) хасагдана.
   */
  const notFromServer = new Set([
    'KONICA_API_BASE', 'KONICA_ADMIN_TOKEN', 'KONICA_DEST', 'KONICA_DAYS',
    'checks', 'ready', 'detail', 'missing', 'orders', 'total', 'error',
    'action', 'ref', 'synced',
  ]);

  const contract = [...needed].filter((name) => !notFromServer.has(name));

  const shared = read('api/_shared.ts');
  const files = read('api/_files.ts');
  const admin = read('api/admin.ts');
  const store = read('api/_store/types.ts');
  const haystack = shared + files + admin + store;

  const missing = contract.filter((name) => !new RegExp(`\\b${name}\\b`).test(haystack));

  assert.deepEqual(
    missing,
    [],
    `Python эдгээр талбарыг уншдаг ч TypeScript талд олдсонгүй: ${missing.join(', ')}`,
  );
});

test('нэр солих нь ЭНЭ тестийг унагаана — хамгаалалт ажиллаж байгааг батлав', () => {
  /*
   * Дээрх тест үнэхээр ажиллаж байгаа эсэхийг батлах хамгаалалт. Хэрэв
   * `pythonReads()` хоосон буцвал дээрх тест ҮРГЭЛЖ өнгөрч, хамгаалалт
   * байгаа мэт хуурах болно.
   */
  const needed = pythonReads();
  assert.ok(needed.size > 5, `Python-оос талбар олдсонгүй (${needed.size}) — задлагч эвдэрсэн`);
  assert.ok(needed.has('orderNumber'), 'orderNumber олдоогүй — задлагч эвдэрсэн');
  assert.ok(needed.has('files'), 'files олдоогүй — задлагч эвдэрсэн');
  assert.ok(needed.has('kind'), 'kind олдоогүй — задлагч эвдэрсэн');
});

test('Python тестүүд `npm run verify` дотор ажилладаг', () => {
  /*
   * `scripts/nas-sync-test.py` бичигдсэн боловч `npm test` түүнийг дууддаггүй
   * байв — өөрөөр хэлбэл дэлгүүрийн скриптийн тестүүд хэн ч ажиллуулдаггүй,
   * зөвхөн байдаг. Ажиллуулагдахгүй тест бол тест биш.
   */
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.verify, /test:py/, 'verify нь Python тестийг алгасч байна');
  assert.match(pkg.scripts['test:py'], /nas-sync-test\.py/);
});
