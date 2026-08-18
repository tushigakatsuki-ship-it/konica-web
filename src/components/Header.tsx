import { Link, useLocation } from 'react-router-dom';
import { useLang } from '../state/lang';
import LangToggle from './LangToggle';
import BasketButton from './BasketButton';

/**
 * ── Цэсний өнгө ба зай ───────────────────────────────────────────
 *
 * Тайван төлөвт цэс нь ердийн текстийн өнгөтэй, hover дээр ЛАВЛАХ
 * ногоон (`--color-neon`) болно.
 *
 * Хажуугийн зай нь нарийн дэлгэцэнд бага: 320px өргөнтэй утсан дээр
 * (iPhone SE, хямд Android) лого, линк, хэл гурав `px-3`-тай бол 14px-ээр
 * халина. `sm:` дээр буцаад уужим болно.
 */
/*
 * 320px дээр «Холбоо барих» нь хоёр мөр болж эвхэгдэнэ. `whitespace-nowrap`
 * тавибал 33px-ээр халина, лого шахагдана. Хоёр мөр нь `leading-tight`-тай
 * бол 64px өндөртэй зурвасанд эмх цэгцтэй харагдана.
 */
const linkBase =
  'inline-flex items-center rounded-md px-2 py-2 text-xs font-medium leading-tight ' +
  'sm:px-3 sm:text-sm text-ink-soft transition-colors hover:text-neon';

/**
 * Толгой — зөвхөн лого, холбоо барих, сагс, хэл.
 *
 * ── Яагаад цэс байхгүй болов ─────────────────────────────────────
 *
 * Өмнө нь энд утасны дугаар, «Хэвлэл», «Цээж зураг» гурав байсан бөгөөд
 * утсан дээр эдгээр нь сагс, хэл, залгах товч, гамбургер цэстэй хамт
 * 16px өндөртэй зурвасыг дүүргэж, лого шахагдаж байв.
 *
 * ⚠️ ҮҮНИЙ ҮР ДАГАВАР: `/hevlel` руу орох цорын ганц зам нь НҮҮР хуудас
 * болсон (hero дээрх товч ба гарцын карт). Захиалгын хуудсанд байгаа хүн
 * логог дараад нүүр рүү буцаж, тэндээс дахин орно. Хэрэв энэ нь урт
 * санагдвал цэсийг буцааж нэмэх хэрэгтэй.
 *
 * Гамбургер цэс ч хасагдсан: дотор нь харуулах зүйл үлдээгүй бөгөөд
 * хоосон цэс нээгддэг товч нь эвдэрсэн мэт мэдрэгддэг.
 */
export default function Header() {
  const { pathname } = useLocation();
  const { t } = useLang();

  return (
    /*
      * ── Хөвөгч толгой ────────────────────────────────────────────
      *
      * Дэлгэцийн ирмэгээс ТАСАРСАН, бөөрөнхий, сүүдэртэй. Бүтэн өргөнтэй
      * зурвасаас ялгаатай нь: агуулга нь доогуур нь гүйж өнгөрөх нь
      * харагдаж, хуудас нэг бүтэн хуудас биш, ДАВХАРГА мэт мэдрэгдэнэ.
      *
      * Гадна `sticky` контейнер нь өндрөө эзэлдэг тул доорх агуулга
      * толгойн доогуур ороод алга болохгүй.
      */
    <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="glass mx-auto flex h-16 max-w-6xl items-center justify-between rounded-xl px-3 sm:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-brand-500 text-lg font-black text-white">
            P
          </span>
          <span className="text-xl font-extrabold tracking-tight">Printmn</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-1.5">
          {/*
            * Холбоо барих нь ХӨЛ рүү аваачна.
            *
            * Өмнө нь нүүр хуудсан дээр тусдаа «Бидэнтэй холбоо барих» хэсэг
            * байсан бөгөөд хөлтэй яг ижил мэдээллийг (утас, хаяг, цаг,
            * и-мэйл) давхардуулж харуулдаг байв. Хэсгийг хассан тул
            * `#kholboo` тэмдэглэгээ нь одоо хөл дээр сууж байна — линк
            * бүх хуудаснаас ажилласаар байна.
            */}
          <a
            href={pathname === '/' ? '#kholboo' : '/#kholboo'}
            className={linkBase}
          >
            {t('nav.contact')}
          </a>
          <BasketButton />
          <LangToggle />
        </nav>
      </div>
    </header>
  );
}
