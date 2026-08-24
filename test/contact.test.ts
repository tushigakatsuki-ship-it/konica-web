import assert from 'node:assert/strict';
import test from 'node:test';
import { joinContact, splitContact } from '../src/lib/contact';

/**
 * НЭГ талбарт бичсэн холбоо барих утга.
 *
 * ⚠️ Сервер тал ХУВААГДСАН хэвээр: Konica апп дээрх `WorkLog.phone` нь
 * тусдаа талбар бөгөөд ажилтан түүгээр шүүж, дарж залгадаг. И-мэйлийг тэнд
 * хийвэл залгах товч ажиллахгүй болно. Тиймээс задлалт зөв байх нь зөвхөн
 * гоо сайхны асуудал биш.
 */

test('@ агуулсан бүхэн и-мэйл рүү очно', () => {
  assert.deepEqual(splitContact('name@example.com'), {
    phone: '',
    email: 'name@example.com',
  });
  assert.deepEqual(splitContact('  test@mail.mn  '), { phone: '', email: 'test@mail.mn' });
});

test('утаснаас цифр БИШ бүхнийг зайлуулна', () => {
  /*
   * Хэрэглэгч `9900-1234`, `(99) 001234` гэх мэтээр бичих нь энгийн зүйл.
   * Татгалзвал ЗӨВ дугаартай хүн маягтаа дуусгаж чадахгүй.
   */
  assert.equal(splitContact('9900-1234').phone, '99001234');
  assert.equal(splitContact('(99) 00 12 34').phone, '99001234');
  assert.equal(splitContact('99 00 12 34').phone, '99001234');
});

test('+976 улсын кодыг зөв салгана', () => {
  assert.equal(splitContact('+976 9900 1234').phone, '99001234');
  assert.equal(splitContact('+97699001234').phone, '99001234');
  assert.equal(splitContact('976 99001234').phone, '99001234');
});

test('976-аар ЭХЭЛСЭН 8 оронтой дугаарыг таслахгүй', () => {
  /*
   * ⚠️ `97612345` бол өөрөө хүчинтэй 8 оронтой дугаар (Мобиком). Улсын
   * кодыг «эхний 976» гэж болзолгүй таславал энэ дугаар `12345` болж
   * эвдэрнэ. Тиймээс зөвхөн нийт урт нь 11 болсон үед л таслана.
   */
  assert.equal(splitContact('97612345').phone, '97612345');
  assert.equal(splitContact('9761234').phone, '9761234', 'богино дугаарыг ч хөндөв');
});

test('хоосон утга хоёуланг нь хоосон болгоно', () => {
  assert.deepEqual(splitContact(''), { phone: '', email: '' });
  assert.deepEqual(splitContact('    '), { phone: '', email: '' });
});

test('и-мэйл нь утаснаас ДАВУУ — хоёулаа үлдэхгүй', () => {
  /*
   * Хоёулаа бөглөгдвөл аль нь жинхэнэ болох нь тодорхойгүй болно. Талбар
   * НЭГ л ширхэг тул утга ч нэг л төрөлтэй байх ёстой.
   */
  const result = splitContact('99001234@mail.mn');
  assert.equal(result.phone, '');
  assert.equal(result.email, '99001234@mail.mn');
});

test('буцааж нэгтгэхэд и-мэйл эхэлнэ', () => {
  assert.equal(joinContact({ phone: '', email: 'a@b.mn' }), 'a@b.mn');
  assert.equal(joinContact({ phone: '99001234', email: '' }), '99001234');
  assert.equal(joinContact({ phone: '', email: '' }), '');
});

test('задалж нэгтгэхэд утга алдагдахгүй', () => {
  for (const input of ['99001234', 'name@example.com', '']) {
    assert.equal(joinContact(splitContact(input)), input, `${input} эргэж ирсэнгүй`);
  }
});

test('задалсныг БУЦААЖ талбарт хийвэл и-мэйл бичих боломжгүй болно', () => {
  /*
   * ⚠️ БОДИТ АЛДААНЫ ТҮГЖЭЭ — энэ тест АЛДААТАЙ зан төлөвийг баримтжуулна.
   *
   * Эхний хувилбар нь талбарын утгыг `joinContact(splitContact(бичсэн))`
   * гэж гаргадаг байсан. Үр дүнд нь и-мэйл бичих БОЛОМЖГҮЙ байв: `@`
   * бичигдэх хүртэл үсэг бүр «цифр биш» гэж хаягдана.
   *
   * Доорх давталт нь яг тэр эвдрэлийг харуулна — «name» хэсэг бүхэлдээ
   * алга болж, хэрэглэгч «@example.com» гэсэн утгатай үлдэнэ.
   *
   * Тиймээс `Order.tsx` нь бичсэн ТҮҮХИЙ мөрийг тусад нь хадгална
   * (`contactText`), `splitContact`-ыг зөвхөн сервер рүү явуулах утгад
   * хэрэглэнэ. Түүнийг `customer-web.test.ts` түгжсэн.
   */
  let looped = '';
  for (const ch of 'name@example.com') {
    looped = joinContact(splitContact(looped + ch));
  }
  assert.equal(looped, '@example.com', 'эвдрэлийн шинж өөрчлөгдсөн — тайлбарыг шинэчил');

  // Харин ТҮҮХИЙ мөрөөс нэг удаа задлахад бүрэн зөв.
  assert.deepEqual(splitContact('name@example.com'), {
    phone: '',
    email: 'name@example.com',
  });
});

test('и-мэйл бичиж эхлэхэд утас гэж таамаглахгүй', () => {
  /*
   * `@` ороогүй байхад цифр биш гэж хаях нь ЗӨВ — тэр үед үнэхээр утас
   * бичиж байгаа мэт харагдана. Гол нь энэ хаялт нь ХАРАГДАХ утгад
   * нөлөөлөхгүй байх ёстой (`Order.tsx` дахь `contactText`).
   */
  assert.deepEqual(splitContact('name'), { phone: '', email: '' });
  assert.deepEqual(splitContact('name@'), { phone: '', email: 'name@' });
});
