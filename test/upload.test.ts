import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PREPARE_SHARE, createProgress, slotIndex } from '../src/lib/uploadProgress';

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

test('нэг зураг унахад БҮХНИЙГ хаядаггүй', () => {
  /*
   * Гар утасны сүлжээн дээрх хамгийн түгээмэл бүтэлгүйтэл: 20 зурагтай
   * захиалгын 19 дэх нь уначихвал өмнөх 18 нь ч хамт хаягдана. Хэрэглэгч
   * 45 MB илгээчихээд эхнээс нь эхэлнэ.
   *
   * Одоо: эхний давталт бүх зургийг оролдож, унасныг нь ТЭМДЭГЛЭЖ авна.
   * Дараа нь хэдэн секунд амраад зөвхөн УНАСАН зургийг дахин илгээнэ.
   */
  assert.ok(code.includes('const retry: Planned[] = []'), 'унасныг тэмдэглэдэггүй');
  assert.match(
    code,
    /if \(!\(await sendPhoto\(files, photo\)\)\) retry\.push\(\.\.\.files\)/,
    'эхний давталт алдаа дээр шууд зогсож байна',
  );
  assert.ok(code.includes('stillFailed'), 'хоёр дахь давталт алга');
  assert.ok(
    code.indexOf('SECOND_PASS_DELAY_MS') < code.indexOf('stillFailed'),
    'дахин оролдохын өмнө амсхийхгүй байна',
  );
});

test('унасан зургийн БЭЛДСЭН файлыг хадгална', () => {
  /*
   * ⚠️ Сольж явуулах горимын нарийн ширийн: хэвлэлийн файлыг санах ойд
   * үүсгэдэг тул илгээж дуусмагц алга болно. Унасан зургийнхыг хаячихвал
   * хоёр дахь давталт дахин ЗУРАГ БЭЛДЭХ шаардлагатай болно — эсвэл бүр
   * чимээгүй алгасна.
   *
   * `retry.push(...files)` нь яг тэр файлуудыг барьж үлдээнэ. Зөвхөн унасан
   * нь үлддэг тул санах ой ч хэмнэгдэнэ.
   */
  const secondPass = code.slice(code.indexOf('if (retry.length > 0)'));
  assert.ok(secondPass.includes('sendPhoto('), 'ижил илгээгчийг ашиглаагүй');
  assert.ok(!secondPass.includes('preparePhoto('), 'дахин бэлдэж байна');
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
});

test('амжилтгүй болвол ХЭДЭН ЗУРАГ дутсаныг хэлнэ', () => {
  /*
   * «Алдаа гарлаа» гэдэг нь хэрэглэгчид юу ч хэлэхгүй. «19 зургаас 2 нь
   * илгээгдсэнгүй» гэвэл сүлжээгээ соливол болно гэдгээ ойлгоно.
   *
   * ⚠️ ЗУРГААР хэлнэ, файлаар биш — «60 файлаас 4 нь» гэвэл хэрэглэгч
   * хэдэн зураг дахин оруулахаа мэдэхгүй.
   */
  assert.match(code, /\$\{total\} зургаас \$\{lost\}/, 'тоо хэлэхгүй');
  assert.match(
    code,
    /new Set\(stillFailed\.map\(\(file\) => file\.photo\)\)\.size/,
    'файлыг зураг гэж давхар тоолж байна',
  );
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
    /renderPrintBlob\(\s*original,\s*size,\s*item\.value\.crop \?\? DEFAULT_CROP,/,
    'тайралт алдагдаж байна',
  );
});

/*
 * ── Явцын мөр: НЭГ үе шат ────────────────────────────────────────────
 *
 * Урьд нь бэлтгэл, илгээлт хоёр тусдаа үе шат байсан тул мөр 30/30 болоод
 * 0/30 руу буцдаг байв. 4G дээр 30 зураг 10–25 минут илгээгддэг — тэр урт
 * хугацаанд буцаж татсан мөр нь «эхнээс нь эхэллээ юү?» гэсэн эргэлзээ
 * төрүүлж, дундуур нь цуцлах эрсдэл үүсгэнэ. Цуцалсан захиалга = алдагдсан
 * орлого, тиймээс энэ нь гоо сайхны асуудал биш.
 */

test('мөр ХЭЗЭЭ Ч буцахгүй — дахин оролдох үед ч', () => {
  const p = createProgress(3);

  p.prepared(0);
  const high = p.sending(0, 0.9).ratio;

  // Файл унаад дахин эхлэв — илгээсэн байт тэглэгдэнэ.
  const after = p.sending(0, 0).ratio;

  assert.ok(after >= high, `мөр буцлаа: ${high} → ${after}`);
});

test('тоолуур зөвхөн БҮРЭН орсон зургийг тоолно', () => {
  const p = createProgress(3);

  p.prepared(0);
  assert.equal(p.sending(0, 0.99).done, 0, 'дуусаагүй зургийг тоолж байна');
  assert.equal(p.finished(0).done, 1);
  assert.equal(p.finished(1).done, 2);
});

test('нийт дүн нь ЗУРГИЙН тоо — файлын тоо БИШ', () => {
  /*
   * 30 зураг = 60 файл. Файлаар тоолвол хэрэглэгч «24/60» гэж хардаг байв.
   */
  const p = createProgress(30);
  assert.equal(p.snapshot().total, 30);
});

test('бүх зураг дуусахад мөр яг 100% болно', () => {
  const p = createProgress(4);
  for (let photo = 0; photo < 4; photo += 1) {
    p.prepared(photo);
    p.sending(photo, 1);
    p.finished(photo);
  }
  assert.equal(p.snapshot().ratio, 1);
  assert.equal(p.snapshot().done, 4);
});

test('эхний зураг бэлдэгдмэгц мөр хөдөлнө', () => {
  /*
   * Хөдөлгөөнгүй 0% нь «гацсан юм биш үү» гэсэн сэтгэгдэл төрүүлнэ. Урьд нь
   * бэлтгэл 20 секунд үргэлжилдэг байсан ч илгээлт эхлэх хүртэл сүлжээ хоосон
   * зогсдог байв.
   */
  const p = createProgress(10);
  const ratio = p.prepared(0).ratio;

  assert.ok(ratio > 0, 'мөр огт хөдөлсөнгүй');
  assert.equal(ratio, PREPARE_SHARE / 10);
});

test('зураггүй захиалгад тэглэлээр хуваахгүй', () => {
  const p = createProgress(0);
  assert.equal(p.snapshot().total, 0);
  assert.equal(p.snapshot().ratio, 1, 'NaN эсвэл 0/0 гарлаа');
});

test('хаягийн байр: зураг бүрт print эхэлж, дараа нь original', () => {
  /*
   * Хаягуудыг бэлтгэлээс ӨМНӨ, зураг бүрт хоёр байраар урьдчилан захиалдаг.
   * Байрлал андуурвал хэвлэх файл эх файлын хаяг руу бичигдэж, ажилтан буруу
   * файл татна — R2 дээр алдаа ч гарахгүй тул чимээгүй эвдрэл болно.
   */
  assert.equal(slotIndex(0, 'print'), 0);
  assert.equal(slotIndex(0, 'original'), 1);
  assert.equal(slotIndex(5, 'print'), 10);
  assert.equal(slotIndex(5, 'original'), 11);

  // 30 зураг = 60 байр — MAX_FILES-тай яг таарна.
  assert.equal(slotIndex(29, 'original') + 1, 60);
});

test('бэлтгэл, илгээлт хоёр СОЛЬЖ явна — хоёр дамжлага үлдээгүй', () => {
  /*
   * Кодын бүтцийн баталгаа: `planFiles` бүх зургийг урьдчилан бэлддэг байсныг
   * авч хаясан. Эргэж орвол мөр дахин хоёр удаа дүүрнэ.
   */
  assert.ok(!code.includes('planFiles'), 'бүгдийг урьдчилан бэлдэх горим буцаж орсон');
  assert.ok(code.includes('preparePhoto('), 'зураг тус бүрийн бэлтгэл алга');
  assert.match(code, /ahead = next/, 'дараагийн зургийг зэрэг бэлддэггүй');
});

test('интерфейст нэг мөр, нэг шошго үлдсэн', () => {
  const order = readFileSync(path.join(root, 'src/pages/Order.tsx'), 'utf8');
  assert.match(order, /progress\.done\}\/\{progress\.total\} зураг/, 'тоолуур алга');
  assert.ok(!order.includes("progress.phase"), 'хоёр үе шатны салаа буцаж орсон');
});

test('adjust (brightness/blur/sharpen/дэвсгэр) print-д ордог, original-ыг хөндөхгүй', () => {
  /*
   * Цээж зургийн харилцагчийн засварын хэрэгсэл: `item.value.adjust`-ыг
   * `renderPrintBlob`-т ЗААВАЛ дамжуулна, эс тэгвээс дэлгэц дээр тохируулсан
   * brightness/blur/sharpen/дэвсгэр зөвхөн preview дээр үлдэж, ХЭВЛЭХ файлд
   * огт ордоггүй болно.
   *
   * `original`-ийн мөр нь `item.value.file`-г шууд, ямар ч хувиргалтгүй
   * дамжуулдаг хэвээр байх ёстой — adjust ЗӨВХӨН `print`-д нөлөөлнө. Эх
   * файл өөрчлөгдвөл ажилтан буруу тохируулгаас буцаж сэргээх боломжгүй
   * болно (README-ийн «Цээж зураг — шийдвэр ЭРГЭСЭН» түүхэн 3 алдааны
   * гурав дахь нь яг үүнээс болсон).
   */
  assert.match(
    code,
    /renderPrintBlob\(\s*original,\s*size,\s*item\.value\.crop \?\? DEFAULT_CROP,\s*item\.value\.adjust \?\? DEFAULT_ADJUST,?\s*\)/,
    'adjust-ыг renderPrintBlob руу дамжуулаагүй байна',
  );

  const originalEntry = code.slice(code.indexOf("kind: 'original'"), code.indexOf("kind: 'original'") + 200);
  assert.ok(
    !originalEntry.includes('adjust') && !originalEntry.includes('renderPrintBlob'),
    'original файлыг adjust/renderPrintBlob-оор дамжуулж байна — эх файл өөрчлөгдөх эрсдэлтэй',
  );
  assert.match(code, /blob: original,\s*\n\s*photo,\s*\n\s*meta: \{\s*\n\s*kind: 'original'/, 'original blob шууд дамжаагүй байна');
});
