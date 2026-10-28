/**
 * Бараа материал — БЭЛЭН зарагддаг бүтээгдэхүүн.
 *
 * ── Юугаараа `catalog.ts`-ээс ялгаатай вэ ────────────────────────
 *
 * `catalog.ts` нь ҮЙЛЧИЛГЭЭний жагсаалт: зураг угаах, хэвлэх, сийлэх —
 * бүгд ажил хийгдэж байж бий болно. Энэ файл нь тавиур дээр БАЙГАА
 * барааны жагсаалт: хэрэглэгч ирээд авчихна, хүлээх зүйл байхгүй.
 *
 * Үнэ нь каталогоос уншигдана — мөнгөний ганц эх сурвалж тэнд байх
 * ёстой, эс бөгөөс ажилтан үнээ нэг газарт зассан атлаа нөгөөд нь
 * мартаж, вэб дээр өөр үнэ харагдана.
 */

import type { PriceTier } from '../lib/price';

/** Спортын төрөл — дэлгүүрийн хуудас эдгээрээр бүлэглэнэ. */
export type StockGroup =
  | 'basketball'
  | 'volleyball'
  | 'chess'
  | 'darts'
  | 'table-tennis'
  | 'tennis'
  | 'bowling'
  | 'billiard'
  | 'daam';

/**
 * Бүлгүүд ба тэдгээрийн дараалал.
 *
 * ⚠️ Дараалал нь ЗОРИУД — загвар олонтой спорт эхэнд. Цагаан толгойн
 * дарааллаар эрэмбэлбэл ганц загвартай «Даам» эхэнд гарч, хүн энд юу
 * их байгааг эхний дэлгэцээс ойлгохгүй.
 */
export const STOCK_GROUPS: readonly { id: StockGroup; name: { mn: string; en: string } }[] = [
  { id: 'basketball', name: { mn: 'Сагсанбөмбөг', en: 'Basketball' } },
  { id: 'volleyball', name: { mn: 'Волейбол', en: 'Volleyball' } },
  { id: 'chess', name: { mn: 'Шатар', en: 'Chess' } },
  { id: 'darts', name: { mn: 'Дартс', en: 'Darts' } },
  { id: 'table-tennis', name: { mn: 'Ширээний теннис', en: 'Table tennis' } },
  { id: 'tennis', name: { mn: 'Теннис', en: 'Tennis' } },
  { id: 'bowling', name: { mn: 'Боулинг', en: 'Bowling' } },
  { id: 'billiard', name: { mn: 'Билльярд', en: 'Billiards' } },
  { id: 'daam', name: { mn: 'Даам', en: 'Draughts' } }
];

/**
 * ⚠️ `PriceTier` нь СОНГОМОЛ (`Partial`).
 *
 * Дэлгүүр зарах медалиа гэрэл зурагтай нь өгсөн ч үнийг нь хожим
 * тогтооно гэсэн. Үнэгүй барааг жагсаалтаас нуух нь буруу: хүн ямар
 * загвар байгааг ХАРАХ хэрэгтэй, тэр нь өөрөө үнэ цэнэтэй.
 *
 * Тиймээс үнэгүй бараа нь ҮЗЭСГЭЛЭН болж харагдана: загвар, зураг нь
 * гарна, харин захиалгын товчны оронд утасны холбоос гарна.
 *
 * ⚠️ Хуурамч үнэ (тэг эсвэл «ойролцоогоор») тавьж БОЛОХГҮЙ. Буруу үнэ
 * харуулах нь үнэ огт харуулахаас дор — хүн тоо бодож ирээд өөр үнэ
 * сонсоно.
 */
export interface StockItem extends Partial<PriceTier> {
  /** Тогтвортой түлхүүр — маршрут, тест, сагсанд хэрэглэнэ. */
  id: string;
  /** Аль спортын бүлэгт харьяалагдах вэ. */
  group: StockGroup;
  name: { mn: string; en: string };
  /** Нэг өгүүлбэрийн тайлбар — юу болох, юунд тохирохыг хэлнэ. */
  blurb: { mn: string; en: string };

  /**
   * Агуулахын үлдэгдэл, ширхэгээр.
   *
   * ⚠️ СОНГОМОЛ. Тоо харуулах нь АМЛАЛТ: «15 байна» гэж бичсэн бол 15
   * байх ёстой. Дэлгүүр бодит тоогоо хэлээгүй байхад дугуйруулсан тоо
   * зохиох нь хэрэглэгчийг хуурна — 15 ширхэг захиалаад, ажилтан
   * залгаж «үгүй ээ, 3 л байна» гэж хэлэх нь итгэл алдуулна.
   *
   * Тодорхойгүй бол тоо ОГТ харуулахгүй. `0` бол «Дууссан».
   */
  stock?: number;

  /**
   * Картан дээрх зураг — `public/stock/` доторх зам.
   *
   * ⚠️ Дэлгүүрийн БОДИТ бүтээгдэхүүний зураг байх ёстой. Ойролцоо
   * зураг тавих нь худал сурталчилгаа: захиалагч нэг юм хараад өөр
   * юм гартаа авна.
   *
   * Байхгүй бол карт ЭВДРЭХГҮЙ — зургийн оронд медалийн дүрс гарна.
   *
   * ⚠️ Өргөтгөлийг ЖИЖИГ үсгээр. macOS үсгийн том/жижгийг ялгадаггүй
   * тул `.WEBP` гэвэл локал дээр ажиллаад Vercel (Linux) дээр 404
   * өгнө — `PAYMENT_QR` дээр яг ижил сургамж бий.
   */
  image?: string;
}

/**
 * Үнэтэй юу — захиалах боломжтой эсэхийг энэ шийднэ.
 *
 * ⚠️ Төрлийг НАРИЙСГАДАГ (`is`) тул энэ шалгалтыг давсан хойно
 * `serviceIdFor` зэрэг `PriceTier` хүлээдэг функц рүү шууд дамжуулж
 * болно — үгүй бол `serviceId` байхгүй байж болзошгүй гэж TypeScript
 * зогсооно.
 */
export const hasPrice = (item: StockItem): item is StockItem & PriceTier =>
  item.serviceId !== undefined;

/**
 * ⚠️ Эдгээр медалийн ҮНЭ хараахан тогтоогдоогүй.
 *
 * Дэлгүүр зургийг нь өгөөд «үнийг дараа нь оруулья» гэсэн. Каталогт
 * (`catalog.ts`) байгаа медалиуд нь ӨӨР бүтээгдэхүүн — тэдгээр нь
 * сийлбэргүй төмөр, шилэн медаль. Эдгээр нь паалантай спортын медаль,
 * алт/мөнгө/хүрэл гурвалсан, оосортой.
 *
 * Үнэ тогтмогц каталогт мөр нэмж, энд `serviceId` зааж өгнө.
 */
export const STOCK: readonly StockItem[] = [
  {
    id: 'medal-01',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — зургаан өнцөгт (загвар 1)',
      en: 'Basketball medal — hexagonal (model 1)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-01.webp',
  },
  {
    id: 'medal-02',
    group: 'chess',
    name: {
      mn: 'Шатар медаль — зургаан өнцөгт',
      en: 'Chess medal — hexagonal',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-02.webp',
  },
  {
    id: 'medal-03',
    group: 'chess',
    name: {
      mn: 'Шатар медаль — бамбай (загвар 1)',
      en: 'Chess medal — shield (model 1)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-03.webp',
  },
  {
    id: 'medal-04',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — дугуй (загвар 1)',
      en: 'Basketball medal — round (model 1)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-04.webp',
  },
  {
    id: 'medal-05',
    group: 'table-tennis',
    name: {
      mn: 'Ширээний теннис медаль — зургаан өнцөгт',
      en: 'Table tennis medal — hexagonal',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-05.webp',
  },
  {
    id: 'medal-06',
    group: 'tennis',
    name: {
      mn: 'Теннис медаль — бамбай',
      en: 'Tennis medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-06.webp',
  },
  {
    id: 'medal-07',
    group: 'volleyball',
    name: {
      mn: 'Волейбол медаль — бамбай (загвар 1)',
      en: 'Volleyball medal — shield (model 1)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-07.webp',
  },
  {
    id: 'medal-08',
    group: 'darts',
    name: {
      mn: 'Дартс медаль — бамбай (загвар 1)',
      en: 'Darts medal — shield (model 1)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-08.webp',
  },
  {
    id: 'medal-09',
    group: 'chess',
    name: {
      mn: 'Шатар медаль — бамбай (загвар 2)',
      en: 'Chess medal — shield (model 2)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-09.webp',
  },
  {
    id: 'medal-10',
    group: 'volleyball',
    name: {
      mn: 'Волейбол медаль — сонгодог дугуй',
      en: 'Volleyball medal — classic round',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-10.webp',
  },
  {
    id: 'medal-11',
    group: 'daam',
    name: {
      mn: 'Даам медаль — бамбай',
      en: 'Draughts medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-11.webp',
  },
  {
    id: 'medal-12',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — дугуй (загвар 2)',
      en: 'Basketball medal — round (model 2)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-12.webp',
  },
  {
    id: 'medal-13',
    group: 'volleyball',
    name: {
      mn: 'Волейбол медаль — дугуй',
      en: 'Volleyball medal — round',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-13.webp',
  },
  {
    id: 'medal-14',
    group: 'bowling',
    name: {
      mn: 'Боулинг медаль — бамбай',
      en: 'Bowling medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-14.webp',
  },
  {
    id: 'medal-15',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — бамбай',
      en: 'Basketball medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-15.webp',
  },
  {
    id: 'medal-16',
    group: 'darts',
    name: {
      mn: 'Дартс медаль — зургаан өнцөгт',
      en: 'Darts medal — hexagonal',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-16.webp',
  },
  {
    id: 'medal-17',
    group: 'darts',
    name: {
      mn: 'Дартс медаль — бамбай (загвар 2)',
      en: 'Darts medal — shield (model 2)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-17.webp',
  },
  {
    id: 'medal-18',
    group: 'volleyball',
    name: {
      mn: 'Волейбол медаль — зургаан өнцөгт',
      en: 'Volleyball medal — hexagonal',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-18.webp',
  },
  {
    id: 'medal-19',
    group: 'billiard',
    name: {
      mn: 'Билльярд медаль — бамбай',
      en: 'Billiards medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-19.webp',
  },
  {
    id: 'medal-20',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — сонгодог дугуй',
      en: 'Basketball medal — classic round',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-20.webp',
  },
  {
    id: 'medal-21',
    group: 'volleyball',
    name: {
      mn: 'Волейбол медаль — бамбай (загвар 2)',
      en: 'Volleyball medal — shield (model 2)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-21.webp',
  },
  {
    id: 'medal-22',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — дугуй (загвар 3)',
      en: 'Basketball medal — round (model 3)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-22.webp',
  },
  {
    id: 'medal-23',
    group: 'basketball',
    name: {
      mn: 'Сагсанбөмбөг медаль — зургаан өнцөгт (загвар 2)',
      en: 'Basketball medal — hexagonal (model 2)',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-23.webp',
  },
  {
    id: 'medal-24',
    group: 'table-tennis',
    name: {
      mn: 'Ширээний теннис медаль — бамбай',
      en: 'Table tennis medal — shield',
    },
    blurb: {
      mn: 'Алт, мөнгө, хүрэл гурван өнгийн иж бүрдэл. Паалантай, оосор дагалдана.',
      en: 'Gold, silver and bronze set. Enamelled, ribbon included.',
    },
    image: '/stock/medal/medal-24.webp',
  },
];

export const stockById = (id: string): StockItem | undefined =>
  STOCK.find((item) => item.id === id);

/** Нэг бүлэгт харьяалагдах бараанууд, жагсаалтын дарааллаар. */
export const stockByGroup = (group: StockGroup): readonly StockItem[] =>
  STOCK.filter((item) => item.group === group);
