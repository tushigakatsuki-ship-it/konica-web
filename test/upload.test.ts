import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Байршуулалтын тэсвэр.
 *
 * ⚠️ Яагаад эх кодыг уншиж шалгадаг вэ: `uploadBasketPhotos` нь `XMLHttpRequest`,
 * `Blob`, `canvas` гурвыг шаарддаг тул Node дотор ажиллуулах боломжгүй. Бүтэн
 * туршилт нь браузер дээр (`verify-upload.js`) явдаг. Энд бүтцийн баталгааг
 * барина — эдгээр нь эргэж алдагдвал хэрэглэгч хэдэн арван MB дахин илгээнэ.
 */

// `npm test` нь төслийн язгуураас ажилладаг (бусад тестүүдтэй ижил).
const root = process.cwd();
const upload = readFileSync(path.join(root, 'src/lib/upload.ts'), 'utf8');
const code = upload.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('нэг файл унахад БҮХНИЙГ хаядаггүй', () => {
  /*
   * Гар утасны сүлжээн дээрх хамгийн түгээмэл бүтэлгүйтэл: 20 зурагтай
   * захиалгын 19 дэх нь уначихвал өмнөх 18 нь ч хамт хаягдана. Хэрэглэгч
   * 45 MB илгээчихээд эхнээс нь эхэлнэ.
   */
  assert.ok(code.includes('const failed: number[] = []'), 'унасныг тэмдэглэдэггүй');
  assert.ok(
    /if \(!\(await sendOne\(index\)\)\) failed\.push\(index\)/.test(code),
    'эхний давталт алдаа дээр шууд зогсож байна',
  );
  assert.ok(code.includes('stillFailed'), 'хоёр дахь давталт алга');
  assert.ok(
    code.indexOf('SECOND_PASS_DELAY_MS') < code.indexOf('stillFailed'),
    'дахин оролдохын өмнө амсхийхгүй байна',
  );
});

test('дахин оролдохдоо ИЖИЛ presigned хаягийг ашиглана', () => {
  /*
   * `/api/upload` руу дахин хандвал ШИНЭ `uploadId` гарна: аль хэдийн орсон
   * файлууд хуучин зам дээрээ үлдэж, manifest шинэ зам заана — ажилтанд
   * хагас захиалга харагдана. Presigned URL 20 минут хүчинтэй тул ижил хаяг
   * руу үргэлжлүүлэх нь зөв.
   */
  const secondPass = code.slice(code.indexOf('stillFailed'));
  assert.ok(!secondPass.includes("fetch('/api/upload'"), 'шинэ хаяг гуйж байна');
  assert.ok(secondPass.includes('sendOne('), 'ижил илгээгчийг ашиглаагүй');
});

test('амжилтгүй болвол ХЭДЭН файл дутсаныг хэлнэ', () => {
  /*
   * «Алдаа гарлаа» гэдэг нь хэрэглэгчид юу ч хэлэхгүй. «19 файлаас 2 нь
   * илгээгдсэнгүй» гэвэл сүлжээгээ соливол болно гэдгээ ойлгоно.
   */
  assert.match(code, /\$\{planned\.length\} файлаас \$\{stillFailed\.length\}/, 'тоо хэлэхгүй');
});

test('дахин оролдох хүлээлт нь сүлжээний тасалдлыг даана', () => {
  /*
   * 0.5с → 1с (нийт 1.5с) нь автобус, лифт, подвалын 10–20 секундын
   * тасалдлыг даахгүй. Presigned URL 20 минут амьдардаг тул хүлээх нь үнэгүй.
   */
  const attempts = Number(code.match(/RETRY_ATTEMPTS = (\d+)/)?.[1]);
  const base = Number(code.match(/RETRY_BASE_MS = ([\d_]+)/)?.[1].replace(/_/g, ''));

  assert.ok(attempts >= 4, `оролдлого цөөн: ${attempts}`);
  assert.ok(base >= 1000, `суурь хүлээлт богино: ${base}ms`);

  // Нийт хүлээлт нь presigned URL-ийн хугацаанаас хамаагүй богино байх ёстой.
  const total = Array.from({ length: attempts - 1 }, (_, i) => base * 2 ** i).reduce(
    (a, b) => a + b,
    0,
  );
  assert.ok(total >= 5_000, `нийт хүлээлт хэтэрхий богино: ${total}ms`);
  assert.ok(total < 60_000, `нийт хүлээлт хэтэрхий урт: ${total}ms`);
});

test('4xx алдаанд дахин оролддоггүй', () => {
  /*
   * Гарын үсэг хүчингүй, хугацаа дууссан — давтаад ижил хариу ирнэ. Дахин
   * оролдох нь зөвхөн хэрэглэгчийн хүлээлтийг л уртасгана.
   */
  assert.match(code, /permanent \|\| attempt >= attempts\) throw error/, 'байнгын алдааг ялгаагүй');
  assert.match(code, /xhr\.status >= 400 && xhr\.status < 500/, '4xx-ыг тэмдэглээгүй');
});

test('ЭХ файл болон хэвлэх файл ХОЁУЛАА илгээгдэнэ', () => {
  /*
   * Ажилтан бүх засварыг гараар хийдэг болсон тул эх файл нь зайлшгүй.
   * Зөвхөн `print` очвол буруу тайралтыг засах аргагүй.
   */
  assert.ok(code.includes("kind: 'original'"), 'эх файл алга');
  assert.ok(code.includes("kind: 'print'"), 'хэвлэх файл алга');
  assert.ok(code.includes('blob: original,'), 'эх файлын оронд өөр зүйл');
});

test('хэрэглэгчийн тайралт хэвлэх файлд дамжина', () => {
  assert.match(
    code,
    /renderPrintBlob\(original, size, item\.value\.crop \?\? DEFAULT_CROP\)/,
    'тайралт алдагдаж байна',
  );
});
