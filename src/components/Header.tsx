import { Link } from 'react-router-dom';
import { CONTACT, PRIMARY_PHONE } from '../data/site';
import { useLang } from '../state/lang';
import LangToggle from './LangToggle';
import BasketButton from './BasketButton';
import { IconPhone } from './icons';

/**
 * ── Цэсний өнгө ба зай ───────────────────────────────────────────
 *
 * Тайван төлөвт ердийн текстийн өнгөтэй, hover дээр ЛАВЛАХ ногоон
 * (`--color-neon`) болно.
 *
 * Дугаар нь ЗААВАЛ нэг мөрөнд байх ёстой — `8022-` / `2323` гэж тасарвал
 * уншигдахгүй. Тиймээс `whitespace-nowrap`, оронд нь хажуугийн зайг
 * нарийн дэлгэцэнд багасгав.
 */
const linkBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2 ' +
  'text-xs font-bold sm:px-3 sm:text-sm text-ink-soft transition-colors hover:text-neon';

/**
 * Толгой — зөвхөн лого, утас, сагс, хэл.
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
          {/*
            * Нэрийг 360px-ээс НАРИЙН дэлгэцэнд нуулаа.
            *
            * Утасны дугаар нэг мөрөнд байх ёстой (`8022-` / `2323` гэж
            * тасарвал уншигдахгүй) тул тэр нь өргөнөө өгөхгүй. iPhone SE
            * зэрэг 320px төхөөрөмж дээр «Printmn» бичиг 41px-ээр халгаж
            * байсан. `P` тэмдэг нь брэндийг таниулж, нүүр рүү ч хөтөлнө.
            */}
          <span className="hidden text-xl font-extrabold tracking-tight min-[360px]:inline">
            {CONTACT.company}
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-1.5">
          {/*
            * Утасны дугаар — дарахад ШУУД залгана.
            *
            * Өмнө нь энд «Холбоо барих» гэсэн бичиг байж, хөл рүү гүйлгэдэг
            * байв: хэрэглэгч гүйж очоод дугаарыг олж, дараа нь дарах — гурван
            * алхам. Зургийн газарт ирдэг хүсэлтийн дийлэнх нь «энэ хэмжээ
            * байна уу», «хэзээ бэлэн болох вэ» гэсэн богино асуулт тул тэр
            * гурван алхам бүр дуудлага алдагдуулна.
            *
            * Дугаарыг ил бичиж байгаа шалтгаан: зөвхөн дүрс байвал хүн юу
            * болохыг мэдэхгүй, мөн дугаараа тэмдэглэж авах хүн ч байдаг.
            */}
          <a
            href={PRIMARY_PHONE.href}
            aria-label={`${PRIMARY_PHONE.label} ${t('nav.callAria')}`}
            className={linkBase}
          >
            <IconPhone className="size-4 shrink-0 text-brand-500" />
            {PRIMARY_PHONE.label}
          </a>
          <BasketButton />
          <LangToggle />
        </nav>
      </div>
    </header>
  );
}
