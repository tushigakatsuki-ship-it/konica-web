import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * Энэ бол ҮЙЛЧЛҮҮЛЭГЧИЙН вэб.
 *
 * Захиалгуудын жагсаалт, зураг татах, төлбөр баталгаажуулах зэрэг ажилтны
 * хэрэгсэл нь native app-ын менежерийн хэсэгт байрлана — вэб bundle-д ОРОХ
 * ЁСГҮЙ. Хэн нэгэн санамсаргүй буцааж нэмэхээс сэргийлж энд түгжив.
 *
 * (`/api/admin` нь ХЭВЭЭР байна — түүнийг app дуудна. Хориглож байгаа зүйл нь
 * вэб дээрх интерфейс.)
 */

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

/**
 * Тайлбаргүй эх код.
 *
 * ⚠️ Хэрэгтэй шалтгаан: энэ файл дахь олон тест «ийм зүйл кодод БАЙХГҮЙ байх
 * ёстой» гэж шалгадаг. Тайлбар дотор хуучин нэрийг дурдмагц (жишээ нь «яагаад
 * `IdPhotoOrder`-ыг хассан бэ» гэж бичихэд) тэр шалгалт худал уначихдаг.
 * Үүнээс болж хөгжүүлэгч тайлбар бичихээс зайлсхийх нь буруу урамшуулал.
 */
const readCode = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const sourceFiles = (dir: string): string[] => {
  const full = path.join(root, dir);
  if (!existsSync(full)) return [];
  return readdirSync(full, { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.ts') || name.endsWith('.tsx'))
    .map((name) => path.join(dir, name));
};

test('ажилтны хуудас вэб дээр байхгүй', () => {
  assert.ok(!existsSync(path.join(root, 'src/pages/Admin.tsx')));
  assert.ok(!existsSync(path.join(root, 'src/lib/zip.ts')));
});

test('router дээр /admin зам бүртгэгдээгүй', () => {
  const app = read('src/App.tsx');
  assert.ok(!/path=["']admin["']/.test(app), 'App.tsx дээр admin зам байна');
  assert.ok(!app.includes('pages/Admin'));
});

test('клиентийн код ажилтны токен ашигладаггүй', () => {
  for (const file of sourceFiles('src')) {
    const source = read(file);
    assert.ok(
      !source.includes('x-admin-token'),
      `${file} дотор ажилтны токен байна — энэ нь вэб bundle-д орох ёсгүй`,
    );
    assert.ok(
      !source.includes('/api/admin'),
      `${file} нь /api/admin руу ханддаг — ажилтны API вэбээс дуудагдах ёсгүй`,
    );
  }
});

test('хэрэглэгч зөвхөн ӨӨРИЙН захиалгаа хардаг', () => {
  // Төлөв хуудас нь `uploadId` шаарддаг — түүнгүйгээр сервер өгөгдөл өгдөггүй.
  const status = read('src/pages/OrderStatus.tsx');
  assert.ok(status.includes("params.get('u')"));
  assert.ok(status.includes('Линк бүрэн бус байна'));

  // Жагсаалтын API-г клиент огт мэдэхгүй — зөвхөн нэг захиалгын төлөв.
  const api = read('src/lib/api.ts');
  assert.ok(api.includes('/api/payment'));
  assert.ok(!api.includes('days='));
});

/* ── Зураг сонгох цонх ────────────────────────────────────────────── */

/**
 * Цонх нь ЗААВАЛ `document.body` дээр portal-аар зурагдана.
 *
 * `<main>` дээр `page-enter` хөдөлгөөн явдаг бөгөөд `animation-fill-mode: both`
 * тул хөдөлгөөн дууссаны дараа ч `transform` нь идэвхтэй хэвээр үлдэж,
 * `matrix(1,0,0,1,0,0)` болж тооцогддог. Тэгш хэмт матриц ч гэсэн
 * `position: fixed`-ийн ЭЗЭН БЛОК-ыг үүсгэдэг тул `fixed inset-0` нь дэлгэц
 * биш, `<main>`-ы бүтэн өндөр рүү суудаг.
 *
 * Үр дүн нь: урт хуудсан дээр цонх дэлгэцийн доод захаас бүтнээрээ гарч,
 * `body { overflow: hidden }` дэвсгэрийн гүйлтийг түгжсэн байдаг тул хэрэглэгч
 * түүн рүү ГҮЙЖ ХҮРЧ ЧАДАХГҮЙ болно. Утсан дээр цонх огт нээгдээгүй мэт
 * харагдана. Portal нь энэ гинжийг тасалдаг тул буцааж авч болохгүй.
 */
test('зураг сонгох цонх portal-аар body дээр зурагдана', () => {
  const editor = read('src/components/PhotoEditor.tsx');
  assert.ok(
    editor.includes("from 'react-dom'") && editor.includes('createPortal'),
    'PhotoEditor нь createPortal ашиглахаа больжээ',
  );
  assert.ok(
    /createPortal\([\s\S]*document\.body,?\s*\)/.test(editor),
    'portal нь document.body дээр зурагдах ёстой',
  );
});

/**
 * Ихэнх хэрэглэгч утсаар ордог бөгөөд нэг захиалгад 10-20 зураг өгдөг.
 * Нэг бүрчлэн сонгуулах нь тэр урсгалыг ашиглах боломжгүй болгодог.
 *
 * Засварлаж байгаа үед л ганцаар сонгоно — тэнд «нэг мөрийн зургийг солих»
 * үйлдэл явж байгаа тул олон файл утгагүй.
 */
test('олон зургийг зэрэг сонгож болно', () => {
  const editor = read('src/components/PhotoEditor.tsx');
  assert.ok(
    /multiple=\{!editing\}/.test(editor),
    'файлын оролт олон зураг хүлээж авахаа больжээ',
  );

  // Зураг тус бүр ТУСДАА сагсны мөр болно — ширхэгийг нь тусад нь өөрчилнө.
  const print = read('src/pages/Print.tsx');
  assert.ok(
    /values:\s*EditorValue\[\]/.test(print),
    'Print.tsx нь цонхноос олон зураг хүлээж авахаа больжээ',
  );
});

/**
 * Утасны БУЦАХ товч торны сонголт руу аваачих ёстой.
 *
 * ⚠️ Энэ бол бодит алдааны түгжээ.
 *
 * Эхэндээ сонгосон ангилал нь `useState` дотор амьдардаг байв. Тэр үед
 * ангилал сонгоход хаяг өөрчлөгддөггүй тул хөтчийн ТҮҮХЭНД цэг үүсэхгүй —
 * утасны буцах зангаа эсвэл товч дарахад хэрэглэгч торны сонголт руу биш,
 * САЙТААС БҮРМӨСӨН гарч байлаа (`goBack()` → `about:blank`).
 *
 * Утсан дээр буцах зангаа бол ҮНДСЭН навигаци. Ихэнх хэрэглэгч утсаар
 * ордог тул энэ нь жирийн эвгүйдэл биш, урсгал таслах алдаа байв.
 *
 * `useState` руу буцаавал энэ тест сануулна.
 */
test('ангиллын сонголт хаягт бичигдэнэ — утасны буцах товч ажиллана', () => {
  const print = read('src/pages/Print.tsx');

  assert.ok(print.includes('useSearchParams'), 'сонголт хаягт холбогдоогүй');
  assert.match(print, /params\.get\('t'\)/, 'хаягийн параметр уншигдаагүй');
  assert.ok(
    !/const \[tab, setTab\] = useState/.test(print),
    'сонголт `useState` руу буцсан — утасны буцах товч сайтаас гаргана',
  );

  /*
   * `?t=` нь хэрэглэгчийн гараас ирж болно. Шалгаагүй утга хүлээж авбал
   * жагсаалт хоосон гарч, хуудас эвдэрсэн мэт харагдана.
   */
  assert.ok(print.includes('CATEGORY_ORDER'), 'хаягийн параметр шалгагдаагүй');
});

/**
 * Буцах товч нь ГҮЙДЭГ мөрөнд байх ёсгүй.
 *
 * Өмнө нь табуудтай нэг эгнээнд байсан бөгөөд тэр эгнээ утсан дээр 609px
 * өргөнтэй (дэлгэц 390px) тул хэрэглэгч хажуу тийш гүйлгэж байж олдог байв.
 * Буцах нь хамгийн олон дардаг үйлдэл — хайж олох ёсгүй.
 */
test('буцах товч гүйдэг мөрнөөс гадна, тусдаа байна', () => {
  const print = read('src/pages/Print.tsx');
  const back = print.indexOf("t('print.allCategories')");
  const row = print.indexOf('overflow-x-auto');
  assert.ok(back !== -1, 'буцах товч алга');
  assert.ok(row !== -1, 'табын мөр алга');
  assert.ok(back < row, 'буцах товч гүйдэг мөрний ДОТОР эсвэл ДАРАА байна');
});

/**
 * «Өөр хэмжээ» нь ҮНИЙН ХАМГААЛАЛТЫГ тойрч гарах ёсгүй.
 *
 * ⚠️ Сервер нь үнийг каталогоос ДАХИН тооцдог бөгөөд зөвхөн
 * `CUSTOM_PRICE_CATEGORIES` (Медаль & Цом, Хувцас хэвлэл)-д хэрэглэгчийн
 * үнийг хүлээж авдаг. Хэрэв «Угаалт»-ыг тэр жагсаалтад нэмбэл 500₮-ийн
 * 10×15 зургийг 1₮ болгож захиалах боломж нээгдэнэ.
 *
 * Тиймээс өөрийн хэмжээ нь `0₮`-тэй мөр бөгөөд үнэ нь тохиролцоогоор явна.
 */
test('өөрийн хэмжээ үнийн хамгаалалтыг тойрохгүй', () => {
  const order = read('src/lib/order.ts');
  assert.ok(
    !/'Угаалт'/.test(order.slice(order.indexOf('CUSTOM_PRICE_CATEGORIES'), order.indexOf('isCustomPrice'))),
    'Угаалт нь тохиролцооны үнэтэй болсон — хэрэглэгч үнээ өөрөө тавина',
  );

  const catalog = read('src/data/catalog.ts');
  assert.match(
    catalog,
    /\{ id: 199, name: 'Зураг угаалт — өөр хэмжээ', price: '0₮'/,
    'өөр хэмжээний мөр алга эсвэл үнэтэй болсон',
  );

  /*
   * `0₮` мөрийг «Тохиролцоно» гэж харуулах ёстой. «0₮» гэж харагдвал
   * хэрэглэгч үнэгүй гэж ойлгож, ажилтан үнэ хэлэхэд гайхна.
   */
  const print = read('src/pages/Print.tsx');
  assert.ok(print.includes("t('custom.byAgreement')"), 'сагсанд 0₮ гэж харагдана');
  const orderPage = read('src/pages/Order.tsx');
  assert.ok(orderPage.includes('byAgreement'), 'захиалгын хуудсанд 0₮ гэж харагдана');
});

/**
 * Цээж зургийг Хэвлэл хуудсанд ЭНД шууд захиална.
 *
 * Өмнө нь энд «тусдаа хуудастай» гэсэн хайрцаг байж `/tseej-zurag` руу
 * явуулдаг байв: хэрэглэгч хэмжээгээ сонгох гэтэл өөр хуудас руу шидэгдэж,
 * сагс нь хаана байгааг ч мэдэхгүй болдог байсан.
 *
 * ⚠️ ЧУХАЛ: шийдэл нь «ердийн зургийн урсгалыг цээж зурагт нээх» БИШ.
 * `PhotoEditor`-т нүүр илрүүлэх, дэвсгэр цайруулах, чанарын хаалт байхгүй.
 * Шийдэл нь ХААЛТТАЙ компонентыг (`IdPhotoOrder`) энд авчрах явдал.
 */
test('цээж зургийг Хэвлэл хуудсан дээр ердийн урсгалаар захиална', () => {
  /*
   * ⚠️ Энэ тест урьд нь ЭСРЭГ зүйлийг шаарддаг байсан: `IdPhotoOrder` гэсэн
   * бүрэн автомат компонент (нүүр илрүүлэх, тайрах, дэвсгэр цайруулах,
   * `isPrintReady` хаалт) энд зурагдаж, ердийн хэмжээний тор нуугдсан байх.
   *
   * Тэр загвар бодит байдалд нурсан: нүүр олдоогүй үед силуэтийн арга `null`
   * биш, БҮТЭН зургийн хэмжээтэй «нүүр» буцаадаг тул бүтэн биеийн зураг
   * «стандарт хангасан» гэж дүгнэгдэн зарагддаг байв. Мөн хэрэглэгчээс зөвхөн
   * боловсруулсан файл ирдэг тул ажилтан буруу тайралтыг засах ч аргагүй.
   *
   * Шинэ дүрэм: цээж зураг нь бусад зурагтай ЯГ ижил урсгалтай. Хэрэглэгч
   * зургаа оруулна, ажилтан серверээс эх файлыг татаж аваад бэлтгэнэ.
   */
  const print = readCode('src/pages/Print.tsx');

  assert.ok(!print.includes('IdPhotoOrder'), 'автомат компонент буцаж орсон');
  assert.ok(!/idPhoto \? 'hidden'/.test(print), 'хэмжээний тор дахин нуугдсан');
  assert.ok(print.includes("t('idPhoto.note.title')"), 'хэрэглэгчид тайлбар алга');
  assert.ok(!print.includes('to="/tseej-zurag"'), 'өөр хуудас руу шиддэг линк үлдсэн');
});

test('дэлгүүрт хийгддэг үйлчилгээг онлайнаар захиалж болохгүй', () => {
  /*
   * «Файлаар зураг авах» гэдэг нь ирж зураг АВАХУУЛАХ ажил. Жагсаалтад
   * үлдээвэл хэрэглэгч сагсанд нэмж, төлбөр төлчихөөд, ажилтан юу хэвлэхээ
   * мэдэхгүй байх болно — файл нь огт байхгүй.
   */
  const print = read('src/pages/Print.tsx');
  assert.match(print, /const IN_BRANCH_ONLY[^=]*=\s*\[\s*405/s, 'хасалт алга');
  assert.match(print, /!IN_BRANCH_ONLY\.includes\(service\.id\)/, 'шүүлт хэрэглэгдээгүй');
});

/* ── Дүрс тэмдэг ──────────────────────────────────────────────────── */

/**
 * Emoji нь төхөөрөмж бүр дээр өөр зурагддаг (iOS, Android, Windows гурав
 * гурван өөр), өнгийг нь удирдах боломжгүй, зарим төхөөрөмж дээр хайрцаг (□)
 * болж харагддаг, хэмжээ нь фонтоос хамаарч мөрийн өндрийг үсрүүлдэг.
 * Оронд нь `src/components/icons.tsx` доторх SVG-г ашиглана.
 *
 * `×` (U+00D7) нь emoji биш — «10×15 см» гэсэн зөв типографийн тэмдэг тул
 * шалгалтаас гадуур.
 */
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{FE0F}]/u;

/** Тайлбар доторх emoji хамаарахгүй — зөвхөн интерфейст гарах текст чухал. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('интерфейст emoji хэрэглэхгүй — зөвхөн SVG дүрс', () => {
  for (const file of sourceFiles('src')) {
    const found = withoutComments(read(file)).match(EMOJI);
    assert.equal(found, null, `${file} дотор emoji байна: ${found?.[0]}`);
  }
});

test('дүрсний сан нь өнгө удирдагддаг, дэлгэц уншигчид нуугдсан', () => {
  const icons = read('src/components/icons.tsx');
  assert.ok(icons.includes('stroke="currentColor"'), 'текстийн өнгөтэй нийцэх ёстой');
  assert.ok(icons.includes('aria-hidden="true"'), 'дэлгэц уншигч давхар уншихгүй');

  // Санг нэмэлт хамааралгүй байлгана — 12 дүрсэд 40KB-ийн сан оруулах нь утгагүй.
  const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
  assert.ok(!('lucide-react' in pkg.dependencies));
  assert.ok(!('react-icons' in pkg.dependencies));
});

/* ── Газрын зураг ──────────────────────────────────────────────────── */

test('газрын зураг нь хуудас нээхэд iframe ачаалдаггүй', () => {
  const map = read('src/components/MapEmbed.tsx');

  /*
   * Google Maps-ийн iframe нь ~1MB JS татдаг бөгөөд хуудас ачаалахтай зэрэг
   * эхэлдэг. Холбоо барих хэсэг рүү хүрэлгүй гарсан хүн ч түүнийг төлнө.
   * Тиймээс facade: дарсан үед л `shown` болж iframe гарна.
   */
  assert.ok(map.includes('useState'), 'facade байхгүй — iframe шууд ачаалагдана');
  assert.ok(map.includes('{shown ?'), 'iframe нөхцөлгүйгээр зурагдаж байна');
  assert.ok(map.includes("loading=\"lazy\""));
});

test('embed хаяг нь товч линк биш координат ашиглана', () => {
  const map = read('src/components/MapEmbed.tsx');

  // `maps.app.goo.gl` нь дотроо чиглүүлэлт хийдэг тул хөтөч iframe дотор
  // блоклодог. Координатаар дуудахад л ажиллана.
  assert.ok(map.includes('output=embed'));
  assert.ok(!map.includes('src={mapUrl}'));

  const site = read('src/data/site.ts');
  assert.match(site, /lat:\s*4[0-9]\./, 'өргөрөг байхгүй');
  assert.match(site, /lng:\s*10[0-9]\./, 'уртраг байхгүй');
});

/* ── Нүүр хуудасны дэвсгэр ─────────────────────────────────────────── */

test('дэвсгэр зураг солигдох нь хүртээмж, гүйцэтгэлийг зөрчөөгүй', () => {
  const hero = read('src/components/HeroSlideshow.tsx');

  // Зөвхөн эхний зураг яаралтай — бусдыг зэрэг татвал анхны зурагдалт удаана.
  assert.ok(hero.includes("i === 0 ? 'eager' : 'lazy'"));

  // Хөдөлгөөнөөс толгой эргэдэг хүнд автомат солилт ажиллах ёсгүй.
  assert.ok(hero.includes('prefers-reduced-motion'));

  // Арын табанд таймер эргүүлэх нь батарей иддэг.
  assert.ok(hero.includes('document.hidden'));

  // Цайвар зураг дээр цагаан гарчиг алга болохоос сэргийлнэ.
  assert.ok(hero.includes('brand-900/85'));

  // Зураг байхгүй үед хуудас эвдрэх ёсгүй.
  assert.ok(hero.includes('HERO_IMAGES.length === 0'));
});

/* ── Ажилтны хэрэгсэл ──────────────────────────────────────────────── */

test('зам бүр рүү орох гарц байна — хаягдсан хуудас байхгүй', () => {
  /*
   * ЯАГААД ЭНЭ ТЕСТ ХЭРЭГТЭЙ ВЭ
   *
   * `/tseej-zurag`-ыг цэснээс хассаны дараа түүн рүү заасан ганц ч холбоос
   * үлдээгүй. Хуудас ажилласаар, тест бүгд ногоон, typecheck цэвэр — гэвч
   * хэрэглэгч ч, ажилтан ч хаягийг гараар бичихээс өөр аргагүй болсон.
   *
   * Цэснээс зүйл хасах нь ердийн зүйл. Тэгэхдээ хасахдаа өөр гарц үлдээсэн
   * эсэхийг хэн ч сануулдаггүй. Энэ тест л сануулна.
   */
  const app = read('src/App.tsx');

  /*
   * `<Navigate>` замуудыг алгасна: хуучин хаягийг шинэ рүү чиглүүлэх зорилготой
   * тул тэдгээр рүү зориуд холбоос тавьдаггүй (`/zurag-ugaalt` → `/hevlel`).
   */
  const routes = [...app.matchAll(/<Route\s+path="([^"*:]+)"[^>]*?element=\{([^}]*)\}/g)]
    .filter((m) => !m[2].includes('Navigate'))
    .map((m) => m[1])
    .filter((p) => p !== '' && p !== '/');

  /*
   * Доод хязгаар нь «regex эвдэрсэн үү» гэдгийг барих эрүүл мэндийн шалгалт.
   * Ажилтны хэрэгслийн зам (`tseej-zurag/avtomat`) хасагдсаны дараа гурав
   * үлдсэн: `zakhialga`, `hevlel`, `tseej-zurag`.
   */
  assert.ok(routes.length >= 3, `зам олдсонгүй: ${routes.length}`);

  // `src/` доторх БҮХ файлаас холбоосуудыг цуглуулна.
  const links = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) {
        /*
         * ⚠️ Гурван бичлэгийг ЗЭРЭГ барина:
         *   JSX:    to="/une"
         *   дуудлага: navigate('/une')
         *   объект:  { to: '/une' }   ← `site.ts` доторх NAV
         *
         * Эхний хувилбар `:`-ийг мартсан тул зөвхөн цэсээс холбогдсон
         * хуудсыг «хаягдсан» гэж худал зарласан.
         */
        for (const m of read(rel).matchAll(/(?:to|href|navigate\()\s*[=(:]?\s*['"`]\/([^'"`?#]*)/g)) {
          links.add(m[1].replace(/\/$/, ''));
        }
      }
    }
  };
  walk('src');

  const orphans = routes.filter((route) => {
    const clean = route.replace(/^\//, '').replace(/\/$/, '');
    // Динамик сегменттэй зам (`:дугаар`) нь загвараар таарна.
    return ![...links].some((l) => l === clean || l.startsWith(`${clean}/`));
  });

  assert.deepEqual(
    orphans,
    [],
    `эдгээр хуудас руу орох холбоос байхгүй: ${orphans.join(', ')}`,
  );
});

test('арилжаанд хориотой загвар кодод ороогүй', () => {
  /*
   * ⚠️ ЭРХ ЗҮЙН ТҮГЖЭЭ — гүйцэтгэлийн биш.
   *
   * Дэлгүүр бол ХУДАЛДААНЫ байгууллага. Дараах загварууд нь худалдааны
   * хэрэглээнд хориотой бөгөөд «сайхан ажиллаж байна» гэдэг нь ашиглах
   * үндэслэл болохгүй:
   *
   *   • CodeFormer      — S-Lab License 1.0, арилжаа хориотой
   *   • IDM-VTON        — CC BY-NC-SA 4.0, тусад нь лиценз шаардана
   *   • InsightFace-ийн БЭЛЭН ЖИН — судалгааны зориулалт
   *     (код нь MIT; хориотой нь жин. Энэ ялгаа амархан алдагддаг)
   *
   * Одоо ашиглаж буй U²-Net нь Apache 2.0 — цэвэр.
   */
  const banned = ['codeformer', 'idm-vton', 'idmvton', 'tryondiffusion', 'buffalo_l', 'gfpgan'];

  const walk = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) out.push(...walk(rel));
      else if (/\.tsx?$/.test(entry.name)) out.push(rel);
    }
    return out;
  };

  for (const file of walk('src')) {
    const lower = read(file).toLowerCase();
    for (const name of banned) {
      // Тайлбар дотор дурдах нь зүгээр — ашиглах нь биш.
      const stripped = lower.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!stripped.includes(name), `${file} дотор ${name} — арилжаанд хориотой`);
    }
  }

  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    for (const name of banned) {
      assert.ok(!dep.toLowerCase().includes(name), `хамаарал ${dep} — арилжаанд хориотой`);
    }
  }
});

/* ── Багц боловсруулалт ба Worker ─────────────────────────────────── */

test('цээж зургийг онлайнаар сагсанд хийлгэхгүй', () => {
  /*
   * Цээж зургийн үнийг харуулах нь ЗӨВ — хүн ирэхээсээ өмнө мэдэх ёстой.
   * Гэхдээ сагсанд хийлгэх нь БУРУУ: гэрээсээ илгээсэн зураг гэрэлтүүлэг,
   * дэвсгэр, толгойн байрлалын стандарт хангадаггүй тул буцаагдана.
   * Мөнгө авчихаад буцаах нь хэрэглэгчийг хуурсан хэрэг.
   */
  const print = read('src/pages/Print.tsx');

  // Цонх нь `CategoryGrid`-д нүүсэн (өмнө нь `Print.tsx` доторх TABS байв).
  const grid = read('src/components/CategoryGrid.tsx');
  assert.ok(grid.includes("key: 'Цээж зураг'"), 'цээж зургийн цонх алга');

  assert.ok(print.includes('WALK_IN'), 'онлайн бус категори тэмдэглэгдээгүй');
  assert.match(print, /disabled=\{walkIn\}/, 'картыг дарж болохоор үлдсэн');

  /*
   * Залгах гарц нь ТОЛГОЙ руу нүүсэн: утасны дугаар бүх хуудсанд байнга
   * харагддаг бөгөөд дарахад шууд залгадаг. Тиймээс энэ хуудсан дээр
   * давхардуулах шаардлагагүй — гэхдээ гарц өөрөө БАЙХ ёстой хэвээр.
   */
  const header = read('src/components/Header.tsx');
  assert.ok(header.includes('PRIMARY_PHONE'), 'залгах гарц толгойноос ч алга');
  assert.match(header, /href=\{PRIMARY_PHONE\.href\}/, 'толгойн дугаар залгадаггүй');

  /*
   * 12 ангиллын тор нэмэгдсэнээр өмнө нь ХАРАГДДАГГҮЙ байсан найман
   * ангилал ил гарсан. Тэдгээрийн ихэнх нь зургийн урсгалд тохирохгүй:
   * медаль, өргөмжлөл, тууз нь материал, сийлбэрийн эхийг биечлэн
   * тохирдог; скан, канон нь ЦААСАН эх хувь шаарддаг. Эдгээрийг онлайн
   * захиалгад нээвэл ажилтанд хэвлэх юмгүй захиалга үүснэ.
   */
  for (const category of [
    'Цээж зураг',
    'Хувилах/Скан',
    'Канон',
    'Медаль & Цом',
    'Өргөмжлөл',
    'Дурсгалын үг',
    'Хувцас хэвлэл',
    'Тууз',
    'Хулдаас хэвлэл',
  ]) {
    assert.ok(
      print.includes(`'${category}'`),
      `${category} нь WALK_IN жагсаалтаас унасан — онлайнаар захиалагдана`,
    );
  }
});

/**
 * Хэмжээгүй үйлчилгээ дээр ХУДАЛ хэмжээ бичихгүй.
 *
 * `sizeOf` нь хэмжээ танигдаагүй үед 10×15-ыг буцаадаг. Дөрвөн табтай
 * байхад бүх үйлчилгээ хэмжээтэй байсан тул энэ мэдэгддэггүй байв. 12
 * ангилал ил гарсны дараа «Цом», «Дурсгалын үг», «Медаль» зэрэг дээр
 * «10×15 см» гэж худал бичих байсан.
 */
test('хэмжээгүй үйлчилгээ дээр хуурамч хэмжээ харуулахгүй', () => {
  const print = read('src/pages/Print.tsx');
  assert.ok(
    print.includes('parsePhotoSize'),
    'Print.tsx нь sizeOf руу буцсан — хэмжээгүй зүйлд 10×15 гэж бичнэ',
  );
  assert.ok(!/\bsizeOf\(/.test(print), 'sizeOf нь fallback-тай тул энд хэрэглэж болохгүй');
});

/* ── Дизайн систем ба харанхуй горим ─────────────────────────────── */

test('интерфейст ХАТУУ өнгө хэрэглээгүй — харанхуйд эргэх ёстой', () => {
  /*
   * Харанхуй горим нь `--color-*` хувьсагчийг дахин зарлаж ажилладаг.
   * `bg-white`, `text-[#333]` гэх мэт хатуу утга нь тэр механизмыг
   * тойрч гарах тул харанхуйд цагаан толбо, уншигдахгүй текст үлдэнэ.
   *
   * Хоёр ҮНДЭСЛЭЛТЭЙ үл хамаарах зүйл бий:
   *   • QR код — уншигч хар/цагаан ялгаа шаарддаг
   *   • Цаасны загвар — цаас нь үргэлж цагаан
   * Хоёулаа кодод тайлбартай.
   */
  const allowed = new Set([
    'src/components/PaymentPanel.tsx',
    'src/pages/Print.tsx',
    'src/components/HeroSlideshow.tsx',
    'src/pages/Home.tsx',
    'src/components/PhotoEditor.tsx',
  ]);

  for (const file of sourceFiles('src')) {
    if (allowed.has(file.replace(/\\/g, '/'))) continue;
    const source = withoutComments(read(file));

    assert.doesNotMatch(
      source,
      /className="[^"]*\bbg-white\b(?!\/)/,
      `${file} дотор bg-white — харанхуйд эргэхгүй`,
    );
    assert.doesNotMatch(
      source,
      /\b(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/,
      `${file} дотор хатуу hex өнгө`,
    );

    /*
     * ⚠️ Tailwind-ийн АНХДАГЧ палитр ч мөн адил хориотой.
     *
     * Эхний хувилбар зөвхөн `bg-white` болон hex утгыг хайсан тул
     * `bg-red-50`, `text-red-600` зэрэг өнгө шалгалтаас мултарсан.
     * Тэдгээр нь тогтмол утга — харанхуй горимд эргэхгүй. `bg-red-50`
     * (#fef2f2) нь бараг цагаан тул бараан карт дээр цайвар толбо болно.
     *
     * Оронд нь `--color-danger`, `--color-ok` гэх мэт утга санааны
     * токенуудыг хэрэглэнэ.
     */
    assert.doesNotMatch(
      source,
      /\b(?:bg|text|border|ring|divide)-(?:red|green|blue|slate|gray|zinc|neutral|stone|yellow|orange|lime|emerald|teal|cyan|sky|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
      `${file} дотор Tailwind-ийн анхдагч палитр — харанхуйд эргэхгүй`,
    );
  }
});

test('харанхуй горим бүрэн палитртай', () => {
  const css = read('src/index.css');

  /*
   * ⚠️ СЕЛЕКТОРыг хайна, зүгээр нэрийг нь биш.
   *
   * Эхний хувилбар `indexOf("[data-theme='dark']")` бичсэн нь буруу байв:
   * тэр мөр файлын толгойн ТАЙЛБАР дотор ч байдаг тул зүсэлт бүхэл
   * `@theme` блокийг хамруулж, тест худал ногоон/улаан болно.
   */
  const lightBlock = css.slice(css.indexOf('@theme {'), css.indexOf('@layer base'));
  const darkStart = css.indexOf("[data-theme='dark'] {");
  assert.ok(darkStart > 0, 'харанхуй горимын селектор алга');
  const darkBlock = css.slice(darkStart, css.indexOf('html {'));

  const names = [...lightBlock.matchAll(/--color-([a-z0-9-]+):/g)].map((m) => m[1]);
  const surfaces = names.filter((n) => /^(canvas|card|sunken|ink|ink-soft|muted|hairline)$/.test(n));

  assert.ok(surfaces.length >= 7, `гадаргууны токен дутуу: ${surfaces.join(', ')}`);
  for (const name of surfaces) {
    assert.ok(darkBlock.includes(`--color-${name}:`), `харанхуйд --color-${name} алга`);
  }

  // Цэвэр хар нь OLED дээр нүд ядраадаг — зориуд хэрэглээгүй.
  assert.doesNotMatch(darkBlock, /--color-canvas:\s*#000/, 'зотон цэвэр хар болсон');
});

test('амбер дээрх текст хоёр горимд уншигдана', () => {
  /*
   * `--color-on-accent` нь ЗОРИУД флипддэггүй. Амбер дэвсгэр хоёр горимд
   * хоёуланд нь цайвар байдаг тул текст нь үргэлж бараан байх ёстой.
   * Флипдэг токен (жишээ нь brand-900) хэрэглэвэл харанхуйд цайвар дээр
   * цайвар болно.
   */
  const css = read('src/index.css');
  assert.ok(css.includes('--color-on-accent:'), 'амбер дээрх текстийн токен алга');
  assert.match(css, /@utility btn-accent \{[\s\S]*?text-on-accent/, 'амбер товч буруу токен ашиглаж байна');

  const dark = css.slice(css.indexOf("[data-theme='dark'] {"), css.indexOf('html {'));
  assert.ok(!dark.includes('--color-on-accent:'), 'амбер дээрх текст харанхуйд флипдэж байна');
});

test('горим сонголт гурван төлөвтэй, анивчихаас сэргийлсэн', () => {
  const theme = read('src/state/theme.ts');

  /*
   * «Систем» төлөв заавал хэрэгтэй: зөвхөн гэрэл/харанхуй хоёртой бол
   * хэрэглэгчийн үйлдлийн систем оройдоо солигдоход вэб дагахгүй.
   */
  assert.match(theme, /'light' \| 'dark' \| 'system'/, 'системийн төлөв алга');
  assert.ok(theme.includes("removeAttribute('data-theme')"), 'систем рүү буцах зам алга');

  // localStorage нь нууц горимд шидэж болно — вэбийг унагаах ёсгүй.
  assert.match(theme, /catch\s*\{/, 'localStorage хамгаалалтгүй');

  /*
   * Анивчихаас сэргийлэх скрипт нь index.html дотор, БЛОКЛОДОГ байх ёстой.
   * React дотор хийвэл харанхуй горимын хэрэглэгч эхлээд цагаан дэлгэц
   * харна.
   */
  const html = read('index.html');
  assert.ok(html.includes('printmn-theme'), 'анивчихаас сэргийлэх скрипт алга');
  assert.ok(html.indexOf('printmn-theme') < html.indexOf('/src/main.tsx'), 'скрипт хожуу ажиллана');
  assert.ok(!/<script[^>]*\bdefer\b[^>]*>[\s\S]*?printmn-theme/.test(html), 'скрипт defer болсон');
});

test('хөдөлгөөнийг нэг газраас удирдана', () => {
  const css = read('src/index.css');

  /*
   * `prefers-reduced-motion` дүрэм НЭГ газар байх нь чухал: компонент
   * бүрт `motion-safe:` бичих шаардлагатай бол нэгийг нь мартах нь
   * цаг хугацааны асуудал.
   */
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'), 'хөдөлгөөн хумих дүрэм алга');
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /transition-duration:\s*0\.01ms\s*!important/);

  // Товч дарагдахад хариу өгнө.
  assert.match(css, /@utility btn \{[\s\S]*?active:scale/, 'товч дарагдах хариугүй');
  // Хуудас шилжих анимаци богино байх ёстой.
  assert.match(css, /page-enter\s+(\d+)ms/, 'хуудас шилжих анимаци алга');
  const ms = Number(/page-enter (\d+)ms/.exec(css)?.[1]);
  assert.ok(ms > 0 && ms <= 250, `хуудас шилжилт хэт удаан: ${ms}ms`);
});

test('хуудас шилжихэд анимаци ДАХИН ажиллана', () => {
  /*
   * `key` байхгүй бол React зөвхөн ялгааг шинэчилдэг тул CSS анимаци
   * нэг л удаа ажиллаад дахин гарахгүй — өөрөөр хэлбэл шилжилт байхгүй.
   */
  const layout = read('src/components/Layout.tsx');
  assert.match(layout, /key=\{pathname\}/, 'түлхүүргүй тул анимаци дахин ажиллахгүй');
  assert.ok(layout.includes('page-enter'), 'шилжилтийн класс алга');
});

/* ── Premium minimal харагдац ─────────────────────────────────────── */

test('түгээмэл асуултын хэсэг бүрэн устсан', () => {
  const home = read('src/pages/Home.tsx');
  assert.ok(!home.includes('function Faq'), 'FAQ компонент үлдсэн');
  assert.ok(!home.includes('FAQ'), 'FAQ импорт үлдсэн');

  // Хэрэглэгдэхээ больсон өгөгдөл ч үлдэх ёсгүй.
  const site = read('src/data/site.ts');
  assert.ok(!site.includes('export const FAQ'), 'FAQ өгөгдөл үлдсэн');
});

test('шилэн гадаргууг ХЭМНЭЛТТЭЙ хэрэглэсэн', () => {
  /*
   * `backdrop-filter` нь пиксел бүрийг дахин тооцдог тул хямд утсан дээр
   * гүйлгэлт таталддаг. Мөн доогуураа юу байгаагаас текстийн ялгаралт
   * хамаардаг тул урт текст дээр уншигдах баталгаа алдагдана.
   *
   * Хязгаар: цөөн хэдэн гадаргуу. Хэтэрвэл энэ тест сануулна.
   */
  let uses = 0;
  for (const file of sourceFiles('src')) {
    uses += (withoutComments(read(file)).match(/\bglass\b/g) ?? []).length;
  }
  assert.ok(uses > 0, 'шилэн гадаргуу огт хэрэглээгүй');
  assert.ok(uses <= 6, `шилэн гадаргуу хэт олон газар: ${uses}`);

  const css = read('src/index.css');
  assert.ok(css.includes('-webkit-backdrop-filter'), 'Safari дээр ажиллахгүй');
  // Дээд ирмэгийн гэрэл нь горим бүрт өөр — харанхуйд сул байх ёстой.
  assert.ok(css.includes('--glass-edge'), 'шилэн ирмэгийн токен алга');
});

test('aurora нь товшилт, гүйлгэлтэд саад болохгүй', () => {
  /*
   * `filter: blur()` нь GPU давхарга үүсгэдэг. Хэрэв тэр давхарга
   * товшилт барьдаг бол доорх линкүүд дарагдахаа болино — нүдээр
   * харагдахгүй, зөвхөн хэрэглэгч гомдолловол мэдэгдэнэ.
   */
  const css = read('src/index.css');
  const block = css.slice(css.indexOf('.aurora::before'), css.indexOf('}', css.indexOf('.aurora::before')));
  assert.match(block, /pointer-events:\s*none/, 'aurora товшилт барина');
  assert.match(block, /z-index:\s*-1/, 'aurora агуулгыг халхална');

  // Нэг л газар — олон газар давтвал чимэглэл болно.
  let uses = 0;
  for (const file of sourceFiles('src')) {
    uses += (withoutComments(read(file)).match(/\baurora\b/g) ?? []).length;
  }
  assert.ok(uses <= 2, `aurora хэт олон газар: ${uses}`);
});

test('3D хазайлт нь хуруунд гацахгүй', () => {
  /*
   * Хуруугаар ажилладаг төхөөрөмж дээр `hover` гэж байхгүй. Зарим хөтөч
   * товшилтыг hover гэж тайлбарладаг тул карт хазайсан хэвээр «гацдаг».
   */
  const css = read('src/index.css');
  assert.match(css, /@media \(hover: none\)[\s\S]{0,120}transform:\s*none/, 'хуруунд гацна');

  // Хазайлт бага байх ёстой — их бол текст гажигтай харагдана.
  const deg = [...css.matchAll(/rotate[XY]\((-?[\d.]+)deg\)/g)].map((m) => Math.abs(Number(m[1])));
  assert.ok(deg.length > 0, 'хазайлт алга');
  assert.ok(Math.max(...deg) <= 4, `хазайлт хэт их: ${Math.max(...deg)}°`);
});

test('нүүрэн дээр хоёр гарц, утсан дээр эвхэгдэнэ', () => {
  const home = read('src/pages/Home.tsx');

  /*
   * Түүх: эхлээд энд bento сүлжээ байсан (нэг том нүд, дөрвөн жижиг),
   * дараа нь хоёр карт болсон, одоо ЭХНИЙ ДЭЛГЭЦИЙН товч болов.
   *
   * Картууд нь эхний дэлгэц дээрх товчтой ЯГ ижил хоёр газар руу заадаг
   * байсан тул хэрэглэгч нэг зүйлийг хоёр удаа хараад аль нь «жинхэнэ»
   * нь вэ гэж эргэлздэг байв. Одоо шийдвэр эхний дэлгэц дээрээ дуусна.
   */
  assert.ok(!home.includes('function Sections'), 'давхардсан гарцын хэсэг буцаж ирсэн');
  assert.ok(!home.includes("t('home.sections')"), 'хасагдсан гарчиг буцаж ирсэн');

  assert.ok(home.includes('to="/hevlel"'), 'Хэвлэл гарц алга');
  assert.ok(home.includes("t('nav.stationery')"), 'Бичиг хэрэг гарц алга');
  assert.ok(home.includes("t('home.comingSoon')"), '«Удахгүй» тэмдэглэгээ алга');

  /*
   * «Бичиг хэрэг» нь бэлэн БИШ тул дарагдах ёсгүй. `<Link>` болговол
   * хэрэглэгч хоосон хуудсанд унана.
   */
  assert.ok(
    home.includes('aria-disabled="true"'),
    'Бичиг хэрэг дарагдахаар үлдсэн — хоосон хуудас руу хөтөлнө',
  );
  assert.ok(
    !/<Link[^>]*stationery/s.test(home),
    'Бичиг хэрэг нь Link болсон — бэлэн биш хуудас руу заана',
  );

  /*
   * Утсан дээр БОСОО эвхэгдэнэ. 320px өргөнд хоёр товч зэрэгцвэл аль аль
   * нь хуруунд жижиг болно (Apple-ийн зөвлөмж 44px).
   */
  assert.match(home, /flex-col gap-3[^"]*sm:flex-row/, 'товчнууд утсан дээр эвхэгдэхгүй');
});

/**
 * Каталогийн ангилал БҮР метадататай байх ёстой.
 *
 * Тор дээр бүгд харагдахгүй (Засвар, Цээж зураг нь Зураг угаалтын доор
 * нэгтгэгдсэн) ч ангилал сонгосны дараа дээд талд тайлбар нь гарах тул
 * метадата нь заавал байх ёстой. Каталогт шинэ ангилал нэмэгдвэл энэ тест
 * сануулна — эс тэгвээс тайлбар нь хоосон гарна.
 */
test('ангилал бүр метадататай, англи нэртэй', () => {
  const grid = read('src/components/CategoryGrid.tsx');
  const catalog = read('src/data/catalog.ts');

  // Сүүлийн мөр нь `;`-ээр төгсдөг тул заавал сонголттой байх ёстой.
  const declared = [...catalog.matchAll(/^  \| '([^']+)';?$/gm)].map((m) => m[1]);
  assert.equal(declared.length, 12, 'каталогийн ангиллын тоо өөрчлөгдсөн');

  for (const category of declared) {
    assert.ok(grid.includes(`key: '${category}'`), `${category} метадатагүй`);
  }

  /*
   * Зураг угаалтын доор нэгтгэгдсэн хоёр нь тор дээр ТУСДАА цонх болох
   * ёсгүй — дотор нь табаар шилжинэ.
   */
  assert.match(grid, /MERGED_INTO_WASH[^=]*=\s*\[[^\]]*'Засвар'[^\]]*'Цээж зураг'/s, 'нэгтгэлт алдагдсан');

  /*
   * Бэлэн БИШ ангилал дарагдах ёсгүй: дарвал хэрэглэгч захиалж чадахгүй
   * урсгалд ороод эргэж гарна.
   */
  assert.ok(grid.includes('aria-disabled="true"'), 'бэлэн бус цонх дарагдахаар үлдсэн');
  assert.ok(grid.includes("t('home.comingSoon')"), '«Удахгүй» шошго алга');

  // Англи нэр нь бүх ангилалд байх ёстой — эс тэгвээс кириллээр үлдэнэ.
  const i18n = read('src/data/i18n.ts');
  for (const category of declared) {
    assert.ok(
      new RegExp(`['\`]?${category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['\`]?:`).test(i18n),
      `${category} нь CATEGORY_EN дотор алга`,
    );
  }
});

test('ЭХ ФАЙЛ ажилтанд ЗААВАЛ очно', () => {
  /*
   * ⚠️ Энэ нь өмнөх «чанарын хаалт» тестийг ОРЛОВ.
   *
   * Автомат бэлтгэлийг түр хассан тул зураг стандартад нийцэхийг вэб
   * баталгаажуулахаа больсон. Тэр баталгааг одоо АЖИЛТАН өгнө — гэхдээ зөвхөн
   * эх файл гартаа ирвэл. Хэрэв зөвхөн автоматаар тайрсан `print` файл очвол
   * ажилтан толгой тасарсан зургийг засах аргагүй болж, хэрэглэгч рүү залгаж
   * дахин файл гуйх ажил үүснэ.
   */
  const upload = read('src/lib/upload.ts');

  assert.match(upload, /kind: 'original'/, 'эх файл илгээгддэггүй');
  assert.match(upload, /blob: original,/, 'эх файлын оронд өөр зүйл илгээж байна');
  assert.match(upload, /kind: 'print'/, 'хэвлэх файл илгээгддэггүй');
});

test('цээж зургийн АВТОМАТ бэлтгэл бүхэлдээ хасагдсан', () => {
  /*
   * ⚠️ Энэ тест хоёр удаа ЭРГЭСЭН — түүхийг нь тэмдэглэж үлдээв:
   *
   *   1. Эхлээд «хэрэглэгчийн талд чанарын хаалт байх ёстой» гэж шаарддаг байв.
   *   2. Дараа нь автоматыг хэрэглэгчээс хасахад «ажилтны хэрэгсэл ХЭВЭЭР
   *      байх ёстой» болов.
   *   3. Одоо ажилтан бүх засварыг өөрийн компьютер дээрээ (Photoshop гэх мэт)
   *      хийдэг болсон тул вэб доторх автомат бэлтгэл БҮХЭЛДЭЭ хасагдав.
   *
   * Вэбийн үүрэг одоо ганцхан: захиалга авах, файлыг найдвартай хүлээж авах.
   * Зургийн боловсруулалт вэбийн ажил биш болов.
   */
  const app = read('src/App.tsx');
  assert.ok(!app.includes('avtomat'), 'ажилтны хэрэгслийн зам буцаж орсон');
  assert.ok(!app.includes('IdPhotoStudio'), 'хэрэгслийн хуудас буцаж орсон');

  // Хамааралтай сангууд ч үлдээгүй байх ёстой — үхсэн код хуримтлагдана.
  for (const file of [
    'src/pages/IdPhotoStudio.tsx',
    'src/components/BatchProcessor.tsx',
    'src/lib/idPhoto.ts',
    'src/lib/quality.ts',
    'src/lib/faceDetect.ts',
    'src/lib/segment.ts',
    'src/lib/processPhoto.ts',
    'src/workers/photo.worker.ts',
  ]) {
    assert.ok(!existsSync(path.join(root, file)), `${file} үлдсэн байна`);
  }
});

test('onnxruntime-web хамаарал бүрмөсөн салсан', () => {
  /*
   * ⚠️ Бодит алдааны эцсийн шийдэл.
   *
   * `onnxruntime-web` нь build дээр 25.6MB WASM гаргадаг. Өмнө нь `segment.ts`
   * дотор динамикаар татагддаг байсан бөгөөд «загвар байгаа эсэх» шалгалт нь
   * vercel.json дахь SPA rewrite-аас болж ҮРГЭЛЖ давдаг байв. Улмаар загвар
   * огт суулгаагүй атал хэрэглэгч бүр 26MB татдаг байсан.
   *
   * Одоо хамаарал өөрөө салсан тул энэ ангийн алдаа дахин үүсэх боломжгүй.
   */
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!pkg.dependencies['onnxruntime-web'], 'хамаарал буцаж орсон');
  assert.ok(!pkg.devDependencies?.['onnxruntime-web'], 'devDependencies-д орсон');

  /*
   * ⚠️ Энэ эхлээд `!existsSync('public/models')` байсан нь ХЭТ ХАТУУ байв:
   * git хоосон хавтас хянадаггүй тул файлаа устгасны дараа хоосон `models/`
   * хавтас дискэн дээр үлдэж, `git status` цэвэр атал тест уначихдаг байсан.
   * Хоосон хавтас нь өөрөө хор хөнөөлгүй — жинхэнэ шалгах зүйл нь ЗАГВАРЫН
   * ФАЙЛ багцад орсон эсэх (25MB+ нэмэгдэнэ).
   */
  const models = path.join(root, 'public/models');
  const shipped = existsSync(models)
    ? readdirSync(models).filter((name) => !name.startsWith('.'))
    : [];
  assert.deepEqual(shipped, [], `public/models дотор файл үлдсэн: ${shipped.join(', ')}`);
});

test('цээж зураг хоёр замтай — онлайн ба салбар', () => {
  const page = readCode('src/pages/IdPhoto.tsx');

  // Онлайн зам — одоо ердийн урсгал руу хөтөлнө.
  assert.ok(!page.includes('IdPhotoOrder'), 'автомат самбар буцаж орсон');
  assert.match(page, /Хэмжээ сонгож захиалах/, 'онлайн захиалгын гарц алга');
  assert.match(page, /hevlel\?t=/, 'Хэвлэл хуудас руу холбоогүй');

  /*
   * Салбар дээр ирэх зам ч үлдэх ёстой. Дугаар нь толгойд бүх хуудсанд
   * харагдаж, дарахад шууд залгадаг тул энд шаардагдах зүйл нь «салбар дээр
   * ирж болно» гэсэн МЭДЭЭЛЭЛ.
   */
  assert.match(page, /салбар дээр ирж авахуулна/, 'салбарын гарц алга');

  const header = read('src/components/Header.tsx');
  assert.ok(header.includes('PRIMARY_PHONE'), 'залгах гарц толгойноос ч алга');
});

test('сагс БҮХ хуудаснаас харагдана', () => {
  /*
   * Сагсны интерфейс анх зөвхөн `/hevlel`-ийн баруун баганад байсан.
   * Цээж зургийг `/tseej-zurag`-аас захиалдаг болсноор энэ эвдэрсэн:
   * хэрэглэгч нэмэхэд дэлгэц дээр юу ч өөрчлөгдөхгүй, сагсаа хаанаас
   * харахаа ч мэдэхгүй болсон.
   *
   * Толгой бол цорын ганц зөв газар — бүх хуудсанд байдаг.
   */
  const header = read('src/components/Header.tsx');
  assert.ok(header.includes('BasketButton'), 'толгойд сагс алга');

  const button = read('src/components/BasketButton.tsx');
  assert.ok(button.includes("to=\"/zakhialga\""), 'сагс захиалгын хуудас руу заагаагүй');
  assert.match(button, /totalQty === 0\) return null/, 'хоосон сагс цэс дүүргэж байна');
  // Тоо нь дэлгэц уншигчид ч хүрэх ёстой — зөвхөн харагдах тэмдэг хангалтгүй.
  assert.match(button, /aria-label=\{`Сагс/, 'дэлгэц уншигчид тоо хүрэхгүй');
});

/*
 * ⚠️ Хоёр тест ЭНД БАЙСАН, `IdPhotoOrder` хасагдсанаар утгагүй болсон:
 *
 *   • «сагсанд нэмсний дараа юу болохыг хэлнэ» — тэр баталгааны мессежүүд
 *     тухайн компонентод байсан. Ердийн урсгалд `PhotoEditor` хаагдаж,
 *     сагсны тоо толгойд өөрчлөгддөг тул баталгаа нь харагдацаараа өгөгддөг.
 *   • «сагсанд өгсөн зургийн хаяг устгагдахгүй» — `createObjectURL`-ийн
 *     эзэмшил шилжүүлэх асуудал. `PhotoEditor` нь object URL биш, data URL
 *     ашигладаг тул чөлөөлөх зүйл байхгүй, алдаа нь бүрмөсөн алга болсон.
 *
 * Автомат бэлтгэлийг буцааж оруулбал хоёуланг нь сэргээх хэрэгтэй —
 * `git log -- src/components/IdPhotoOrder.tsx` дотор байна.
 */

/* ── 3D гүн ─────────────────────────────────────────────────────── */

test('заагч дагасан хазайлт нь ГУРВАН хамгаалалттай', () => {
  const tilt = read('src/lib/useTilt.ts');

  /*
   * 1. `pointermove` нь секундэд 100+ удаа дуудагдана. Тухай бүрд нь
   *    style тавибал зурагдалт таталдана.
   */
  assert.ok(tilt.includes('requestAnimationFrame'), 'rAF хязгаарлалтгүй');
  assert.ok(tilt.includes('cancelAnimationFrame'), 'цэвэрлэгээгүй');

  /*
   * 2. ⚠️ `index.css` доторх нэгдсэн `prefers-reduced-motion` дүрэм нь
   *    `transition`, `animation`-ыг л барина. JS-ээр ШУУД тавьсан
   *    утгад хүрэхгүй тул энд ТУСАД нь шалгах ёстой.
   */
  assert.ok(
    tilt.includes("matchMedia('(prefers-reduced-motion: reduce)')"),
    'хөдөлгөөн хумих сонголтыг үл ойшоолоо',
  );

  // 3. Хуруугаар ажилладаг төхөөрөмжид заагч байхгүй.
  assert.match(tilt, /hover: hover/, 'хуруунд дэмий сонсогч хавсаргана');

  // Сонсогчийг заавал салгана — эс бөгөөс санах ой алдагдана.
  assert.ok(tilt.includes('removeEventListener'), 'сонсогч салгагдаагүй');
});

test('JS ажиллаагүй ч 3D загвар зөв харагдана', () => {
  /*
   * `--tilt-*` анхдагч утга нь 0 байх ёстой. Байхгүй бол SSR, хуучин
   * хөтөч, эсвэл хөдөлгөөн хүсээгүй хэрэглэгч дээр `calc()` нь
   * тодорхойгүй болж, карт огт зурагдахгүй.
   */
  const css = read('src/index.css');
  const stage = css.slice(css.indexOf('@utility stage {'), css.indexOf('@utility stage-face'));
  assert.match(stage, /--tilt-x:\s*0/, 'анхдагч утга алга');
  assert.match(stage, /--tilt-y:\s*0/, 'анхдагч утга алга');
});

test('3D нь WebGL сан нэмээгүй', () => {
  /*
   * Three.js нь ~150KB gz — одоогийн бүх багц үүнээс бага. Гурав дахин
   * хүндрүүлэх нь Улаанбаатарын утасны сүлжээн дэх хэрэглэгчид рүү
   * шууд буудаг.
   */
  const pkg = JSON.parse(read('package.json')) as { dependencies?: Record<string, string> };
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    assert.ok(!/three|babylon|@react-three/.test(dep), `WebGL сан нэмэгдсэн: ${dep}`);
  }
});

test('3D загвар нь зөвхөн зураг оруулсны дараа гарна', () => {
  /*
   * Овоолол нь эхэндээ hero дээр байсан ч хасагдсан: тэр нь ЗАР
   * сурталчилгааны шинжтэй байсан бөгөөд хэрэглэгчийн асуултад
   * хариулдаггүй байв. Одоо 3D нь зөвхөн ХЭРЭГЛЭГЧИЙН ӨӨРИЙН зураг
   * дээр ажиллана — «би юу гартаа авах вэ» гэдэгт хариулна.
   */
  const preview = read('src/components/PrintPreview3D.tsx');
  assert.ok(!preview.includes('PrintStack3D'), 'хэрэглэгдэхгүй овоолол үлдсэн');

  const editor = read('src/components/PhotoEditor.tsx');
  assert.ok(editor.includes('PrintPreview3D'), '3D загвар холбогдоогүй');
});

test('дэвсгэр зураг дээрх текст уншигдана', () => {
  /*
   * Энэ тест өмнө нь нүүрийн bento картыг шалгадаг байсан. Тэр карт
   * хасагдсан ч БАТАЛГАА нь хэвээр хэрэгтэй — одоо `HeroSlideshow`
   * дээр амьдарч байна.
   *
   * Зураг нь цайвар ч бараан ч байж болно. Цагаан гарчгийн уншигдалтыг
   * ЗӨВХӨН халхавч л баталгаажуулна — зурган дээр шууд текст тавибал
   * гэрэлтэй зурагт цагаан үсэг алга болно.
   */
  const hero = read('src/components/HeroSlideshow.tsx');
  assert.match(hero, /bg-gradient-to-\w+ from-brand-\d+\/\d+/, 'халхавч алга');

  /*
   * Зураг байхгүй үед `<img src="">` нь эвдэрсэн дүрс үлдээдэг тул
   * градиент руу буцах зам байх ёстой.
   */
  assert.match(hero, /HERO_IMAGES\.length === 0/, 'зураггүй үеийн хамгаалалтгүй');

  // Зөвхөн эхний зураг яаралтай — бусдыг зэрэг татвал анхны зурагдалт удаана.
  assert.match(hero, /i === 0 \? 'eager' : 'lazy'/, 'бүх зураг яаралтай татагдана');
});

test('гүйдэг талбар нь гүйхээ ХЭЛНЭ', () => {
  /*
   * Гүйдэг талбар нь доор нь өөр агуулга байгаа эсэхээ хэлдэггүй.
   * Хэрэглэгч «энэ гүйх үү» гэдгийг таамаглах хэрэгтэй болдог —
   * ялангуяа модал цонхонд, товч нь доор нуугдсан үед.
   *
   * `background-attachment: local` ба `scroll` хоёрын хослол нь JS-гүйгээр
   * үүнийг шийднэ: ирмэгт байхад халхавч сүүдрийг дарна, гүйж эхлэхэд
   * сүүдэр илэрнэ.
   */
  const css = read('src/index.css');
  const hint = css.slice(css.indexOf('@utility scroll-hint'), css.length);

  assert.ok(hint.includes('no-repeat local'), 'агуулгатай хамт гүйх халхавч алга');
  assert.ok(hint.includes('no-repeat scroll'), 'талбартай зогсох сүүдэр алга');
  // Хуруугаар босоо чиглэлд гүйлгэхэд саад болохгүй.
  assert.match(hint, /touch-action:\s*pan-y/, 'хуруугаар гүйлгэхэд саад болно');

  const editor = read('src/components/PhotoEditor.tsx');
  assert.ok(editor.includes('scroll-hint'), 'модалд заалт алга');
  // Гүйдэг талбарын бүтэц зөв эсэх — эдгээргүйгээр огт гүйхгүй.
  assert.match(editor, /min-h-0 flex-1 overflow-y-auto/, 'гүйдэг талбарын бүтэц эвдэрсэн');
});

test('алдааны өнгө хоёр горимд ажиллана', () => {
  const css = read('src/index.css');
  assert.ok(css.includes('--color-danger:'), 'алдааны токен алга');
  assert.ok(css.includes('--color-danger-soft:'), 'алдааны дэвсгэрийн токен алга');

  const darkStart = css.indexOf("[data-theme='dark'] {");
  const dark = css.slice(darkStart, css.indexOf('html {'));
  assert.ok(dark.includes('--color-danger:'), 'харанхуйд алдааны өнгө эргэхгүй');
  assert.ok(dark.includes('--color-danger-soft:'), 'харанхуйд алдааны дэвсгэр эргэхгүй');
});

test('hero дээр хэвлэмэлийн овоолол байхгүй', () => {
  const home = read('src/pages/Home.tsx');
  assert.ok(!home.includes('PrintStack3D'), 'овоолол үлдсэн');

  /*
   * `HERO_IMAGES` нь ХЭРЭГЛЭГДСЭЭР байна — эхний дэлгэцийн дэвсгэр болж.
   * Өмнө нь нүүрийн bento картын хавтас болгож ч ашигладаг байсан; тэр
   * карт хасагдсан тул одоо цорын ганц хэрэглэгч нь `HeroSlideshow`.
   *
   * Энэ ялгаа чухал: «Home.tsx дотор байна уу» гэж шалгавал карт
   * хасагдахад тест унана — гэтэл дэвсгэр зураг хэвийн ажиллаж байгаа.
   */
  const hero = read('src/components/HeroSlideshow.tsx');
  assert.ok(hero.includes('HERO_IMAGES'), 'дэвсгэр зураг алга');
  assert.ok(home.includes('HeroSlideshow'), 'нүүр дээр дэвсгэр холбогдоогүй');
});

/* ── Build тохиргоо ──────────────────────────────────────────────── */

test('CSS нь үндсэн оролтод холбогдсон', () => {
  /*
   * `main.tsx`-ээс `index.css` импортыг санамсаргүй хасвал бүх загвар
   * алга болно — TypeScript ч, тест ч анзаарахгүй, зөвхөн нүдээр л
   * харагдана. (Build оношилгооны үеэр яг ингэж түр хассан байсан.)
   */
  const main = read('src/main.tsx');
  assert.ok(main.includes("import './index.css'"), 'CSS импорт алга — загвар ажиллахгүй');
});


test('утасны дугаар бодит', () => {
  /*
   * Орлуулга дугаар нь бүх «залгах» CTA-г чимээгүй эвдэнэ: товч дарагдана,
   * утас нээгдэнэ, дугаар нь байхгүй. Хэрэглэгч дэлгүүрийг ажиллахгүй
   * гэж бодно.
   */
  const site = read('src/data/site.ts');
  assert.ok(!site.includes('99000000'), 'орлуулга дугаар үлдсэн');
  assert.match(site, /href: 'tel:\+976\d{8}'/, 'tel: хэлбэр буруу');
});
