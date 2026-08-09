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

test('цээж зургийн хэрэгсэл нь захиалгын мэдээлэлд огт хүрэхгүй', () => {
  const studio = read('src/pages/IdPhotoStudio.tsx');

  /*
   * Энэ хуудас нь «ажилтны хуудас» биш — офлайн ажилладаг хэрэгсэл.
   * Захиалгын жагсаалт, токен, сервер рүү илгээх зүйл ОГТ байх ёсгүй:
   * бүх боловсруулалт браузер дотор canvas дээр хийгдэнэ.
   */
  assert.ok(!studio.includes('fetch('), 'сервер рүү хүсэлт явуулж байна');
  assert.ok(!studio.includes('x-admin-token'));
  assert.ok(!studio.includes('/api/'));

  // Хэрэглэгчид үүнийг тодорхой хэлсэн байх ёстой.
  assert.ok(studio.includes('сервер рүү'));
});

test('хэрэгслийн хязгаарлалтыг нуугаагүй', () => {
  const studio = read('src/pages/IdPhotoStudio.tsx');

  /*
   * Гурван хязгаарлалтыг ЗААВАЛ интерфейс дээр хэлнэ — нуувал ажилтан муу
   * үр дүнд гайхаж, хэрэгсэлд итгэхээ болино.
   */
  assert.match(studio, /жигд дэвсгэр/i, 'илрүүлэлтийн хязгаар');
  assert.ok(studio.includes('«Хэвээр»'), 'гараар засах гарц');
  assert.ok(studio.includes('MediaPipe'), 'сайжруулах зам');
  assert.ok(studio.includes('зориуд таслахгүй'), 'нүүр олдоогүй үеийн зарчим');
});

test('хэрэгсэл цэсэнд ороогүй, индексэлдэггүй', () => {
  const app = read('src/App.tsx');
  assert.ok(app.includes('tseej-zurag/avtomat'));

  const nav = read('src/data/site.ts');
  assert.ok(!nav.includes('avtomat'), 'ажилтны хэрэгсэл цэсэнд орсон байна');

  const vercel = JSON.parse(read('vercel.json')) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const rule = vercel.headers.find((h) => h.source === '/tseej-zurag/avtomat');
  assert.ok(rule, 'noindex дүрэм алга');
  assert.ok(rule.headers.some((h) => h.value.includes('noindex')));
});

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

  assert.ok(routes.length >= 4, `зам олдсонгүй: ${routes.length}`);

  // `src/` доторх БҮХ файлаас холбоосуудыг цуглуулна.
  const links = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(entry.name)) {
        for (const m of read(rel).matchAll(/(?:to|href|navigate\()\s*[=(]?\s*['"`]\/([^'"`?#]*)/g)) {
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

test('баримтын горимд царай өөрчлөх засвар ХААЛТТАЙ', () => {
  /*
   * Иргэний үнэмлэх, паспортын зураг бол хүнийг таних баримт. Царай,
   * хувцсыг өөрчилсөн зураг тавих нь баримт гуйвуулсан хэрэг бөгөөд
   * эрсдэл нь зураг авсан дэлгүүр дээр буудаг.
   *
   * Энэ туг нь шинэ засвар нэмэх бүрд шалгагдах цорын ганц газар.
   */
  const src = read('src/lib/idPhoto.ts');
  assert.match(src, /key:\s*'document'[\s\S]*?allowRetouch:\s*false/, 'баримтад засвар нээлттэй');
  assert.match(src, /key:\s*'general'[\s\S]*?allowRetouch:\s*true/, 'энгийн зурагт засвар хаалттай');

  const studio = read('src/pages/IdPhotoStudio.tsx');
  assert.ok(studio.includes('allowRetouch'), 'интерфейс тугийг хэрэглээгүй');
  // Анхдагч нь баримт байх ёстой — санамсаргүй сонголт эрсдэлгүй тал руу.
  assert.match(studio, /useState<PurposeKey>\('document'\)/, 'анхдагч горим баримт биш');
});

test('ONNX нь ДИНАМИК import — үндсэн багцад ороогүй', () => {
  /*
   * `onnxruntime-web` нь маш том. Статик import хийвэл ажилтны хэрэгслийн
   * chunk хэдэн зуун KB болж, загвар суулгаагүй дэлгүүр ч татаж эхэлнэ.
   */
  const src = read('src/lib/segment.ts');
  assert.ok(
    !/^import .*onnxruntime-web/m.test(src),
    'onnxruntime-web статикаар импортлогдсон',
  );
  assert.ok(src.includes("await import('onnxruntime-web')"), 'динамик import алга');

  // Загвар байгаа эсэхийг ЭХЛЭЭД шалгана — байхгүй бол ort огт татагдахгүй.
  const load = src.slice(src.indexOf('async function loadSession'));
  assert.ok(
    load.indexOf("method: 'HEAD'") < load.indexOf("import('onnxruntime-web')"),
    'загварыг шалгахаас өмнө ort татагдана',
  );

  for (const file of ['src/pages/IdPhotoStudio.tsx', 'src/main.tsx', 'src/App.tsx']) {
    assert.ok(!read(file).includes('onnxruntime'), `${file} ort-г шууд импортолсон`);
  }
});

test('загвар байхгүй үед хэрэгсэл ажилласаар байна', () => {
  /*
   * Загвар нь ЗААВАЛ БИШ сайжруулалт. Сүлжээ тасарсан, WASM дэмжигдээгүй,
   * файл эвдэрсэн — аль нь ч ажилтныг зогсоох ёсгүй.
   */
  const src = read('src/lib/segment.ts');
  const catches = src.match(/catch\s*{\s*(\/\*[\s\S]*?\*\/\s*)?return null;/g) ?? [];
  assert.ok(catches.length >= 2, `алдааг залгих хамгаалалт дутуу: ${catches.length}`);

  const studio = read('src/pages/IdPhotoStudio.tsx');
  assert.match(studio, /mask \?\?= backgroundMask/, 'силуэт руу буцах зам алга');
});
