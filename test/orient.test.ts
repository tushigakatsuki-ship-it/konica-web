import assert from 'node:assert/strict';
import test from 'node:test';
import { orientSize, sizeOf } from '../src/lib/photoSize';

/**
 * Цаасны чиглэлийг зургийн чиглэлд тохируулах дүрэм.
 *
 * ── Ямар алдааг зассан бэ ────────────────────────────────────────
 *
 * Каталогийн нэрс `10*15` гэж бичигдсэн тул хэмжээ нь ҮРГЭЛЖ босоо гарч
 * байв. Утасны ердийн зураг хэвтээ (4032×3024). Хэвтээ зургийг босоо
 * хүрээнд `cover`-оор багтаахад өргөний ЯГ ТАЛ хаягдаж, бүлэг зурагт
 * хоёр талын хүмүүс тасардаг байв.
 *
 * Headless Chromium дээр бодит зураг хөрвүүлж баталсан: засварын дараа
 * хэвтээ зураг 1772×1181 болж, хоёр талын өнгөт зурвас бүтэн үлдсэн.
 */

const PAPER = sizeOf('Зураг угаалт 10*15');

test('каталогийн 10*15 нь БОСОО гэж уншигдана', () => {
  // Дүрмийн эхлэл цэг. Энэ өөрчлөгдвөл доорх бүх тест утгаа алдана.
  assert.equal(PAPER.w, 10);
  assert.equal(PAPER.h, 15);
});

test('ХЭВТЭЭ зураг → цаас хэвтээ болж эргэнэ', () => {
  const oriented = orientSize(PAPER, { width: 4032, height: 3024 });
  assert.equal(oriented.w, 15);
  assert.equal(oriented.h, 10);
});

test('БОСОО зураг → цаас хэвээрээ', () => {
  const oriented = orientSize(PAPER, { width: 3024, height: 4032 });
  assert.equal(oriented.w, 10);
  assert.equal(oriented.h, 15);
});

test('ДӨРВӨЛЖИН зураг юу ч эргүүлэхгүй', () => {
  /*
   * Дөрвөлжин зураг аль ч чиглэлд ижилхэн тайрагдана — эргүүлэх нь
   * хэрэглэгчийн хувьд ямар ч ялгаагүй, зөвхөн хайрцаг үсрэх болно.
   */
  const oriented = orientSize(PAPER, { width: 3000, height: 3000 });
  assert.equal(oriented.w, 10);
  assert.equal(oriented.h, 15);
});

test('ХЭВТЭЭ цаас + босоо зураг → цаас босоо болно', () => {
  // Дүрэм нь хоёр тийш ажиллах ёстой, зөвхөн нэг тийш биш.
  const wide = { w: 15, h: 10, label: '15×10 см' };
  const oriented = orientSize(wide, { width: 3024, height: 4032 });
  assert.equal(oriented.w, 10);
  assert.equal(oriented.h, 15);
});

test('шошго ХЭВЭЭР үлдэнэ — бүтээгдэхүүний нэр эргэдэггүй', () => {
  /*
   * ⚠️ `label` нь каталог, үнэ, ажлын захиалгын мөртэй холбоотой. Эргүүлээд
   * «15×10 см» гэж бичвэл ажилтан өөр үйлчилгээ гэж эндүүрэх, тайланд хоёр
   * тусдаа мөр болж харагдах эрсдэлтэй. Чиглэлийг файл өөрөө хэлж өгнө.
   */
  const oriented = orientSize(PAPER, { width: 4032, height: 3024 });
  assert.equal(oriented.label, PAPER.label);
  assert.equal(oriented.label, '10×15 см');
});

test('зураг хараахан уншигдаагүй бол каталогийн чиглэлээр', () => {
  /*
   * Зураг сонгосон болон уншигдсаны хооронд хэдэн зуун миллисекунд байдаг.
   * Тэр үед `null` ирнэ — унах биш, өгөгдмөл чиглэлээ барих ёстой.
   */
  assert.deepEqual(orientSize(PAPER, null), PAPER);
  assert.deepEqual(orientSize(PAPER, undefined), PAPER);
  assert.deepEqual(orientSize(PAPER, { width: 0, height: 0 }), PAPER);
});

test('A4 ч мөн адил эргэнэ', () => {
  const a4 = sizeOf('Хэвлэл: Фото цаас А4 200гр');
  assert.equal(a4.w, 21);
  assert.equal(a4.h, 29.7);

  const oriented = orientSize(a4, { width: 4032, height: 3024 });
  assert.equal(oriented.w, 29.7);
  assert.equal(oriented.h, 21);
});
