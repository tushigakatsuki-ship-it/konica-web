import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { STOCK, stockById } from '../src/data/stock';
import { SERVICES } from '../src/data/catalog';
import { needsPhoto } from '../src/lib/order';
import { parsePrice, serviceIdFor } from '../src/lib/price';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

/**
 * Бараа материал — тавиур дээр бэлэн бүтээгдэхүүн.
 *
 * Энэ хуудасны гол амлалт нь ҮЛДЭГДЭЛ. Тоо харуулаад түүнийгээ
 * хэрэгсэхгүй байх нь тоо огт харуулахгүй байхаас ДОР.
 */

test('барааны үнэ каталогоос уншигдана', () => {
  /*
   * ⚠️ Үнийг `stock.ts` дотор ДАВХАРДУУЛЖ болохгүй.
   *
   * Ажилтан каталогийн үнээ зассан атлаа энд мартвал вэб хоёр өөр үнэ
   * харуулна. Тиймээс энд зөвхөн `serviceId` байна — мөнгө нь ганц
   * эх сурвалжтай.
   */
  const source = read('src/data/stock.ts');
  assert.ok(!/₮/.test(source), 'stock.ts дотор үнэ хатуу бичигдсэн');

  const ids = new Set(SERVICES.map((s) => s.id));
  for (const item of STOCK) {
    assert.ok(ids.has(item.serviceId), `${item.id}: serviceId каталогт алга`);
    assert.ok(parsePrice(SERVICES.find((s) => s.id === item.serviceId)?.price) > 0,
      `${item.id}: каталогийн үнэ 0`);

    const { bulk } = item;
    if (!bulk) continue;
    assert.ok(ids.has(bulk.serviceId), `${item.id}: олны мөр каталогт алга`);
    assert.ok(bulk.from > 1, `${item.id}: олны хил 1 байж болохгүй`);

    const few = parsePrice(SERVICES.find((s) => s.id === serviceIdFor(item, 1))?.price);
    const many = parsePrice(SERVICES.find((s) => s.id === serviceIdFor(item, bulk.from))?.price);
    assert.ok(many < few, `${item.id}: олны үнэ хямд биш (${many} ≥ ${few})`);
  }
});

test('бэлэн бараа ЗУРАГГҮЙ захиалагдана', () => {
  /*
   * ⚠️ Хамгийн амархан давтагдах алдаа.
   *
   * `Order.tsx` нь зураггүй мөрийг хаадаг. Бэлэн бараанд зураг байхгүй
   * тул `needsPhoto` үүнийг чөлөөлөх ёстой. Өөр ангилалд харьяалагдах
   * бараа нэмэх юм бол захиалга нь чимээгүй хаагдана — хэрэглэгч
   * бүгдийг бөглөөд «Зураггүй мөр байна» гэж уншина.
   */
  for (const item of STOCK) {
    const service = SERVICES.find((s) => s.id === item.serviceId);
    assert.ok(service, `${item.id}: үйлчилгээ алга`);
    assert.equal(
      needsPhoto(service),
      false,
      `${item.id}: «${service.category}» зураг шаарддаг тул захиалга хаагдана`,
    );
  }
});

test('үлдэгдэл нь эерэг БҮХЭЛ тоо', () => {
  for (const item of STOCK) {
    assert.ok(Number.isInteger(item.stock), `${item.id}: үлдэгдэл бүхэл биш`);
    assert.ok(item.stock >= 0, `${item.id}: үлдэгдэл сөрөг`);
  }
});

test('id ба нэр давхардахгүй', () => {
  const ids = STOCK.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'давхардсан id');

  for (const item of STOCK) {
    assert.equal(stockById(item.id)?.id, item.id, `${item.id}: хайлтаар олдсонгүй`);
    assert.ok(item.name.mn.trim() !== '' && item.name.en.trim() !== '', `${item.id}: нэр хоосон`);
    assert.ok(item.blurb.mn.trim() !== '', `${item.id}: тайлбар хоосон`);
  }
  assert.equal(stockById('байхгүй-бараа'), undefined, 'байхгүй id утга буцаав');
});

test('НӨӨЦӨӨС ИЛҮҮ тоо санал болгохгүй', async () => {
  /*
   * ⚠️ Үлдэгдлийн тоо бол АМЛАЛТ.
   *
   * «40 байна» гэж бичээд 100-г сонгуулах нь итгэл алдуулна: ажилтан
   * залгаж «үнэндээ байхгүй» гэж хэлэх нь тоо огт харуулаагүйгээс дор.
   */
  const { quantityChoices } = await import('../src/lib/stockOrder');

  for (const stock of [1, 3, 7, 40, 500, 1000]) {
    const choices = quantityChoices(stock);
    assert.ok(choices.length > 0, `${stock}: сонголт хоосон`);
    assert.ok(choices.every((n) => n >= 1 && n <= stock), `${stock}: нөөцөөс хэтэрсэн`);
    // Өсөх дараалалтай — жагсаалт үсэрвэл хэрэглэгч эргэлзэнэ.
    assert.deepEqual([...choices].sort((a, b) => a - b), choices, `${stock}: эрэмбэ буруу`);
    assert.equal(new Set(choices).size, choices.length, `${stock}: давхардсан тоо`);
    // «Бүгдийг нь авах» боломж ҮРГЭЛЖ байна.
    assert.ok(choices.includes(stock), `${stock}: бүх үлдэгдлийг сонгох аргагүй`);
  }

  // Дууссан бараанд сонголт байхгүй — товч ч гарахгүй.
  assert.deepEqual(quantityChoices(0), [], 'дууссан атлаа тоо санал болгов');
  assert.deepEqual(quantityChoices(-5), [], 'сөрөг нөөц дээр тоо гаргав');
});

test('дүн нь НӨАТ, хүргэлтийг СЕРВЕРТЭЙ ижил дүрмээр бодно', async () => {
  /*
   * ⚠️ Сервер нь НӨАТ-ыг бараа + хүргэлтийн НИЙЛБЭР дээр бодно
   * (`api/_shared.ts`). Клиент өөрөөр бодвол хэрэглэгч дэлгэц дээр нэг
   * тоо хараад данс руу ӨӨР дүн шилжүүлнэ — ажилтан дутуу төлбөр
   * хараад залгах хэрэг гарна.
   */
  const { quote } = await import('../src/lib/stockOrder');
  const { VAT_RATE } = await import('../src/lib/price');
  const { DELIVERY_FEE } = await import('../src/lib/order');

  const item = STOCK[0];
  const opts = { deliveryFee: DELIVERY_FEE, vatRate: VAT_RATE };

  const plain = quote(item, 2, { ...opts, delivery: false, vat: false });
  assert.equal(plain.subtotal, plain.unit * 2);
  assert.equal(plain.tax, 0, 'НӨАТ сонгоогүй атлаа нэмэгдэв');
  assert.equal(plain.total, plain.subtotal);

  const full = quote(item, 2, { ...opts, delivery: true, vat: true });
  assert.equal(full.delivery, DELIVERY_FEE);
  assert.equal(
    full.tax,
    Math.round((full.subtotal + DELIVERY_FEE) * VAT_RATE),
    'НӨАТ хүргэлтийг оруулаагүй — сервертэй зөрнө',
  );
  assert.equal(full.total, full.subtotal + full.delivery + full.tax);
});

test('дансны дугаарыг ЗАЙГҮЙ хуулна', async () => {
  /*
   * Банкны апп зайтай дугаарыг «буруу данс» гэж татгалздаг. Дэлгэц
   * дээр зайтай нь уншихад амар тул харагдац, хуулбар хоёр өөр.
   */
  const { plainAccount } = await import('../src/lib/stockOrder');
  assert.equal(plainAccount('5000 0000 0000'), '500000000000');
  assert.equal(plainAccount('5000000000'), '5000000000');

  const modal = read('src/components/StockPayment.tsx');
  assert.match(modal, /plainAccount\(BANK_ACCOUNT\.number\)/, 'зайтай дугаар хуулж байна');
});

test('захиалгын дугаар СЕРВЕРЭЭС гарна', () => {
  /*
   * ⚠️ ppm нь дугаарыг маягт бөглөхөөс ӨМНӨ харуулдаг. Энд тэгэхгүй.
   *
   * Хэрэглэгч дугаараа хараад шилжүүлэг хийчихээд, дараа нь захиалга
   * илгээхэд алдаа гарвал дэлгүүрт ТАНИГДАХГҮЙ гүйлгээний утгатай
   * мөнгө ирнэ. Ажилтан хэнийх болохыг олохгүй, хэрэглэгч мөнгөө
   * төлчихөөд захиалгагүй үлдэнэ.
   */
  const modal = read('src/components/StockPayment.tsx');

  assert.match(modal, /result\.orderNumber/, 'дугаар серверээс уншигдахгүй');
  assert.ok(
    !/Math\.random|Date\.now\(\)[^)]*orderNumber/.test(modal),
    'дугаарыг клиент дээр зохиож байна',
  );
  // Данс нь захиалга үүссэний ДАРАА л харагдана.
  const pay = modal.indexOf("step: 'pay'");
  const form = modal.indexOf("step: 'form'");
  assert.ok(form >= 0 && pay > form, 'маягтын өмнө данс харуулж байна');
});

test('«Төлбөр төлсөн» нь баталгаа гэж ХЭЛЭХГҮЙ', () => {
  /*
   * ⚠️ Товч дарсан нь зөвхөн хэрэглэгчийн хэлсэн үг — банкны гүйлгээг
   * ажилтан гараар шалгана. «Төлбөр баталгаажлаа» гэж бичвэл
   * хэрэглэгч бараагаа авахаар шууд ирээд хоосон буцна.
   */
  const modal = read('src/components/StockPayment.tsx');
  const shown = modal.replace(/\/\*[\s\S]*?\*\//g, '');

  assert.ok(!/баталгаажлаа|төлөгдлөө/.test(shown), 'төлбөрийг баталгаажсан гэж зарлав');
  assert.match(shown, /гараар шалгана|баталгаажуулж залгана/, 'гараар шалгахыг хэлээгүй');
});

test('нөөц харуулах нь ЗӨВХӨН интерфейсийн хязгаар гэдгийг мэдэж байна', () => {
  /*
   * Сервер нь үлдэгдлийг мэдэхгүй — `catalog.ts` дотор ийм ойлголт алга.
   * Тэгээд ч ижил `serviceId` нь `/medal` дээр ЗАХИАЛГААР хязгааргүй
   * тоогоор явдаг тул серверт таслах юм бол тэр урсгалыг эвдэнэ.
   *
   * Энэ нь мөнгөний эрсдэл ҮҮСГЭХГҮЙ: үнийг сервер каталогоос дахин
   * боддог тул хэт их тоо захиалсан ч үнэ нь зөв тооцогдоно, ажилтан
   * баталгаажуулах үедээ засна.
   *
   * ⚠️ Хэрэв хожим нөөцийг серверт хүчинтэй болгох бол мөрөнд «энэ нь
   * тавиурын бараа» гэсэн тэмдэг хэрэгтэй — `serviceId`-аар таслах нь
   * `/medal`-ийн захиалгыг санамсаргүй хаана.
   */
  const shared = read('api/_shared.ts');
  assert.ok(!shared.includes('stock'), 'сервер нөөцийг мэддэг болжээ — тестээ шинэчил');
});

test('бараа материал руу орох зам бий', () => {
  assert.match(read('src/App.tsx'), /path="baraa"/, 'маршрут бүртгэгдээгүй');
  assert.match(read('src/App.tsx'), /path="baraa\/:id"/, 'дэлгэрэнгүйн маршрут алга');

  /*
   * ⚠️ Нүүрний товч бол ЦОРЫН ГАНЦ орц.
   *
   * Бараа материал нь үйлчилгээний тороос (`/hevlel`) зориуд
   * хасагдсан: тэр тор нь ажил хийгдэж байж бий болдог ҮЙЛЧИЛГЭЭний
   * жагсаалт, бэлэн бараа нь худалдаа. Хольвол хэрэглэгч аль нь
   * захиалга, аль нь тавиур дээрх бараа болохыг ялгахаа болино.
   *
   * Гэхдээ үүний үр дагавар нь: нүүрний холбоос алга болбол хуудас
   * бүрмөсөн хүрэхгүй болно.
   */
  assert.match(read('src/pages/Home.tsx'), /to="\/baraa"/, 'нүүрнээс холбоос алга');
  assert.ok(
    !read('src/components/CategoryGrid.tsx').includes('/baraa'),
    'үйлчилгээний торонд бараа материал буцаж орсон',
  );
});

test('нүүрэнд ЯГ ХОЁР гарц', () => {
  /*
   * ⚠️ Эхний дэлгэц дээр гарц нэмэх бүрт бусдын жин буурдаг.
   *
   * Хэвлэл ба Бараа материал хоёр л үлдэнэ. Медаль нь загвар сонгох,
   * бичвэрээ бодох олон алхамтай тул `/hevlel` доторх ангиллын тороос
   * орно — тэр ажлыг хийхээр ирсэн хүн хайж олно.
   */
  const home = read('src/pages/Home.tsx');

  assert.match(home, /to="\/hevlel"/, 'хэвлэлийн гарц алга');
  assert.match(home, /to="\/baraa"/, 'бараа материалын гарц алга');
  assert.ok(!home.includes('to="/medal"'), 'медаль нүүрэнд буцаж ирсэн');
});

test('дэлгэрэнгүй хуудас нь СОНГОЛТУУДЫГ хариуцна', () => {
  /*
   * ppm-ийн урсгал: карт → дэлгэрэнгүй → төлбөр. Сонголтуудыг картан
   * дээр багтаавал карт нь маягт болж, гурван бараа үзэх гэсэн хүн
   * гурван маягтыг гүйлгэнэ.
   */
  const list = read('src/pages/Stock.tsx');
  assert.match(list, /to=\{`\/baraa\/\$\{item\.id\}`\}/, 'карт дэлгэрэнгүй рүү хөтлөхгүй');
  assert.ok(!list.includes('useBasket'), 'жагсаалт сагс руу нэмсээр байна');

  const detail = read('src/pages/StockDetail.tsx');
  for (const [needle, what] of [
    ['quantityChoices', 'тоо ширхэгийн сонголт'],
    ['Авах хэлбэр', 'авах хэлбэр'],
    ['и-Баримт', 'НӨАТ сонголт'],
    ['Тэмдэглэл', 'тэмдэглэл'],
    ['StockPayment', 'төлбөрийн цонх'],
  ] as const) {
    assert.ok(detail.includes(needle), `${what} алга`);
  }
});

test('бэлэн бараа САГС ашиглахгүй — нэг бараа, нэг захиалга', () => {
  /*
   * Сагс нь хэвлэлийн урсгалд хэрэгтэй (нэг хүн олон хэмжээний зураг
   * угаалгана) ч бэлэн бараанд илүүц алхам: ppm-ийн урсгал нэг бараа
   * = нэг захиалга.
   */
  const modal = read('src/components/StockPayment.tsx');
  assert.ok(!modal.includes('useBasket'), 'төлбөрийн цонх сагс хэрэглэж байна');
  assert.match(modal, /submitOrder\(/, 'захиалга серверт илгээгдэхгүй');
  // ГАНЦ мөр явна.
  assert.match(modal, /\[\s*lineFromService\(/, 'нэг мөрөөр илгээгдэхгүй');
});

test('дансны мэдээлэл ГАНЦ эх сурвалжтай', () => {
  /*
   * Дансны дугаар хоёр газар бичигдвэл нэгийг нь зассан үед нөгөөгөөс
   * нь мөнгө хаашаа ч юм явна.
   */
  const modal = read('src/components/StockPayment.tsx');
  assert.match(modal, /BANK_ACCOUNT/, 'данс site.ts-ээс уншигдахгүй');
  assert.ok(!/\d{4}\s?\d{4}\s?\d{4}/.test(modal), 'цонхонд данс хатуу бичигдсэн');
});

test('барааны зураг public дотор БАЙНА', () => {
  /*
   * ⚠️ Замын алдаа нь зөвхөн ҮЙЛДВЭРЛЭЛ дээр илэрдэг.
   *
   * macOS үсгийн том/жижгийг ялгадаггүй тул `/stock/Medal.WEBP` гэж
   * бичсэн зам локал дээр асуудалгүй ажиллаад, Vercel (Linux) дээр
   * 404 өгнө. Тэр үед хэрэглэгч зураггүй карт харна.
   */
  for (const item of STOCK) {
    if (!item.image) continue;

    assert.ok(item.image.startsWith('/'), `${item.id}: зам «/»-ээр эхлэх ёстой`);
    assert.equal(item.image, item.image.toLowerCase(), `${item.id}: замд том үсэг бий`);

    const file = path.join(process.cwd(), 'public', item.image);
    assert.ok(existsSync(file), `${item.id}: ${item.image} файл алга`);
    assert.ok(statSync(file).size > 1024, `${item.id}: зураг хэт жижиг — гэмтсэн байж болзошгүй`);
  }
});

test('зураг дутуу байсан ч карт ЭВДРЭХГҮЙ', () => {
  /*
   * Хөтөч байхгүй зургийн оронд «эвдэрсэн зураг» дүрс харуулдаг тул
   * карт бүхэлдээ гэмтсэн мэт харагдана.
   */
  const image = read('src/components/StockImage.tsx');
  assert.match(image, /onError=\{\(\) => setFailed\(true\)\}/, 'нөхөх арга алга');
  assert.match(image, /IconAward/, 'дүрс рүү буцахгүй');

  // Хуудсууд ШУУД `<img>` бичихгүй — нөхөлт нэг л газар байна.
  for (const page of ['src/pages/Stock.tsx', 'src/pages/StockDetail.tsx']) {
    assert.ok(!read(page).includes('<img'), `${page}: нөхөлтгүй зураг бичсэн`);
    assert.ok(read(page).includes('StockImage'), `${page}: StockImage ашиглаагүй`);
  }
});
