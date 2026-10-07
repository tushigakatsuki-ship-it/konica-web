#!/usr/bin/env node
/**
 * Вэбийн бүрэн бүтэн байдлын шалгалт.
 *
 * ── Яагаад тестээс ТУСДАА вэ ─────────────────────────────────────
 *
 * Тест нь «энэ функц зөв ажиллаж байна уу» гэж асуудаг. Энэ нь «энэ
 * код ХЭНД ч хэрэггүй болчихоо юу» гэж асууна — тэр хоёр өөр асуулт.
 * Нэг ч тест унахгүйгээр дараах зүйлс үүсдэг:
 *
 *   • Толгойн цэсний жагсаалт байгаа атлаа `Header.tsx` түүнийг
 *     уншдаггүй — шинэ хуудсаа тэнд бичээд «яагаад гарахгүй байна вэ»
 *     гэж хайна (`NAV`-тэй яг ингэж болсон).
 *   • Тайлбарт «энэ хуудас ажиллана» гэж бичсэн атлаа маршрут нь алга.
 *   • Орчуулга үлдээд, түүнийг харуулах интерфейс нь алга болсон.
 *
 * Эдгээр нь ажиллах үедээ л илэрдэг тул CI-д барих цорын ганц арга нь
 * ийм статик шалгалт.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const files = ['src', 'api', 'test']
  .filter(existsSync)
  .flatMap(walk)
  .filter((f) => /\.(ts|tsx)$/.test(f));

const raw = Object.fromEntries(files.map((f) => [f, readFileSync(f, 'utf8')]));

/*
 * ⚠️ Тайлбарыг ХАСНА.
 *
 * Тайлбар доторх жишээ код («<Link to="/…">» гэх мэт) нь «ашиглагдаж
 * байна» гэж тоологдвол үхмэл экспорт амьд мэт харагдана.
 */
const code = Object.fromEntries(
  files.map((f) => [f, raw[f].replace(/\/\*[\s\S]*?\*\/|(^|[^:])\/\/.*/g, '$1')]),
);
const src = files.filter((f) => f.startsWith('src'));

const found = [];
const report = (kind, message) => found.push({ kind, message });

/* ── 1. Маршрут ба холбоос ─────────────────────────────────────── */
const routes = new Set(['/']);
for (const [, p] of code['src/App.tsx'].matchAll(/path="([^"]+)"/g)) {
  if (p !== '*') routes.add(`/${p}`.replace(/\/:.*$/, ''));
}
for (const f of src) {
  for (const [, to] of code[f].matchAll(/\bto="(\/[^"#?${]*)/g)) {
    const base = (to.replace(/\/$/, '') || '/').replace(/\/:.*$/, '');
    if (!routes.has(base)) report('МАРШРУТ', `${f}: to="${to}" → маршрут алга`);
  }
}
// Тайлбар дотор «ажиллана» гэж амласан зам үнэхээр байгаа эсэх.
for (const f of src) {
  for (const [, p] of raw[f].matchAll(/`(\/[a-z-]+(?:\/[a-z-]+)+)`[^\n]*ажиллана/g)) {
    if (!routes.has(p)) report('ТАЙЛБАР', `${f}: «${p} ажиллана» гэсэн боловч маршрут алга`);
  }
}
/*
 * Хүрэх аргагүй хуудас — бичээд мартсаны шинж.
 *
 * ⚠️ Дахин чиглүүлэлтийг (`<Navigate>`) хасна: тэдгээр нь ХУУЧИН
 * хаягийг барих зорилготой тул сайт дотроос холбоосгүй байх нь ЗӨВ.
 */
const redirects = new Set(
  [...code['src/App.tsx'].matchAll(/path="([^"]+)" element=\{<Navigate/g)].map((m) => `/${m[1]}`),
);
for (const route of routes) {
  if (route === '/' || redirects.has(route)) continue;
  const linked = src.some((f) => code[f].includes(`to="${route}`));
  if (!linked) report('ХҮРЭХГҮЙ', `${route} — хаанаас ч холбоосгүй хуудас`);
}

/* ── 2. Орчуулга ───────────────────────────────────────────────── */
const defined = new Set(
  [...raw['src/data/i18n.ts'].matchAll(/^\s{2}'([\w.]+)':\s*\{/gm)].map((m) => m[1]),
);
const usedKeys = new Set();
for (const f of files) {
  if (f.endsWith('i18n.ts')) continue;
  for (const [, key] of code[f].matchAll(/'([\w.]+)'/g)) if (defined.has(key)) usedKeys.add(key);
}
for (const key of defined) {
  if (!usedKeys.has(key)) report('ОРЧУУЛГА', `${key} — хаана ч харагдахгүй`);
}

/* ── 3. Үхмэл экспорт ──────────────────────────────────────────── */
for (const f of src) {
  for (const [, name] of code[f].matchAll(/^export (?:const|function|class) (\w+)/gm)) {
    const elsewhere = files.some((g) => g !== f && new RegExp(`\\b${name}\\b`).test(code[g]));
    if (!elsewhere) report('ҮХМЭЛ', `${f}: ${name} хаанаас ч дуудагдахгүй`);
  }
}

/* ── 4. Аюулгүй байдал ─────────────────────────────────────────── */
for (const f of src) {
  for (const secret of ['RTDB_AUTH', 'ADMIN_TOKEN', 'R2_SECRET', 'x-admin-token', '/api/admin']) {
    if (code[f].includes(secret)) report('АЮУЛГҮЙ', `${f}: «${secret}» клиент багцад`);
  }
}
for (const f of files.filter((g) => g.startsWith('api'))) {
  for (const [, name] of code[f].matchAll(/import\.meta\.env\.(\w+)/g)) {
    report('АЮУЛГҮЙ', `${f}: сервер дээр import.meta.env.${name}`);
  }
}

/* ── 5. Каталог ────────────────────────────────────────────────── */
const catalog = code['src/data/catalog.ts'];
const ids = [...catalog.matchAll(/\{ id: (\d+),/g)].map((m) => Number(m[1]));
const duplicate = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (duplicate.length) report('КАТАЛОГ', `давхардсан id: ${duplicate.join(', ')}`);

const usedCats = new Set([...catalog.matchAll(/category: '([^']+)'/g)].map((m) => m[1]));
const declared = new Set([...catalog.matchAll(/^\s*\| '([^']+)'/gm)].map((m) => m[1]));
for (const c of usedCats) if (!declared.has(c)) report('КАТАЛОГ', `«${c}» төрөлд алга`);
for (const c of declared) if (!usedCats.has(c)) report('КАТАЛОГ', `«${c}» — үйлчилгээгүй ангилал`);

/* ── 6. Үлдэгдэл ───────────────────────────────────────────────── */
for (const f of src) {
  for (const [, level] of code[f].matchAll(/console\.(log|debug)\(/g)) {
    report('ҮЛДЭГДЭЛ', `${f}: console.${level}`);
  }
  if (/\bTODO\b|\bFIXME\b/.test(code[f])) report('ҮЛДЭГДЭЛ', `${f}: TODO/FIXME`);
}

/* ── Дүн ───────────────────────────────────────────────────────── */
/*
 * ⚠️ Зөвхөн ХҮНД зэрэглэл нь код 1 буцаана.
 *
 * Ашиглагдахгүй орчуулга, үхмэл экспорт нь цэвэрлэгээ — тэдгээрээр CI
 * унагаавал хүмүүс шалгалтыг бүхэлд нь унтраана. Эвдэрсэн холбоос,
 * алдагдсан нууц нь харин үйлчлүүлэгчид шууд хүрнэ.
 */
const BLOCKING = new Set(['МАРШРУТ', 'АЮУЛГҮЙ', 'КАТАЛОГ', 'ТАЙЛБАР']);

const byKind = new Map();
for (const item of found) {
  if (!byKind.has(item.kind)) byKind.set(item.kind, []);
  byKind.get(item.kind).push(item.message);
}
for (const [kind, list] of [...byKind].sort()) {
  console.log(`\n${BLOCKING.has(kind) ? '✖' : '•'} ${kind} (${list.length})`);
  for (const message of list) console.log(`    ${message}`);
}

const blocking = found.filter((item) => BLOCKING.has(item.kind));
console.log(
  `\n${files.length} файл · ${defined.size} орчуулга · ${ids.length} үйлчилгээ · ${routes.size} маршрут`,
);
console.log(blocking.length ? `\n✖ ${blocking.length} хүнд асуудал` : '\n✅ хүнд асуудал алга');
process.exit(blocking.length ? 1 : 0);
