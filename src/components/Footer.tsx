import { CONTACT } from '../data/site';
import { useLang } from '../state/lang';
import { IconClock, IconFacebook, IconMail, IconMapPin, IconPhone } from './icons';

/**
 * Хөл — жижиг бизнесийн вэбийн хамгийн их уншигддаг хэсгүүдийн нэг.
 *
 * Хүн «хаана байдаг вэ», «хэдэн цагт нээдэг вэ», «утас нь хэд вэ» гэдгийг
 * ихэвчлэн доош гүйлгээд хайдаг. Өмнө нь энд зөвхөн copyright мөр байсан тул
 * тэр гурван асуулт бүр дуудлага болж хувирдаг байв.
 *
 * Бүх утга `data/site.ts`-ээс — нэг газар засахад толгой, холбоо барих хэсэг,
 * хөл гурав зэрэг шинэчлэгдэнэ.
 *
 * ── Дэвсгэр яагаад цагаан вэ ─────────────────────────────────────
 *
 * Өмнө нь `bg-ink` (бараг хар) байсан. Хуудсын үлдсэн хэсэг цагаан тул хөл нь
 * тасарсан хар зурвас мэт харагдаж, ялангуяа утсан дээр «энд хуудас дуусав уу»
 * гэсэн эргэлзээ төрүүлдэг байв. Одоо `bg-card` — сэдэв (theme) солигдоход
 * автоматаар дагадаг тул харанхуй горимд ч зөв өнгөтэй үлдэнэ. Хилийг
 * `border-hairline` заана.
 */
export default function Footer() {
  const { t } = useLang();
  const socials = Object.entries(CONTACT.social).filter(([, url]) => url);

  return (
    /*
      * `id="kholboo"` нь өмнө нь нүүр хуудасны тусдаа хэсэг дээр байсан.
      * Тэр хэсэг хөлтэй яг ижил мэдээллийг давхардуулдаг байсан тул
      * хасагдаж, тэмдэглэгээ нь энд шилжив — толгойн «Холбоо барих» линк
      * бүх хуудаснаас ажилласаар байна.
      *
      * `scroll-mt` нь хөвөгч толгойн өндрийг нөхнө: үүнгүйгээр гүйлт
      * дуусахад эхний мөр толгойн доогуур орж далдарна.
      */
    <footer
      id="kholboo"
      /*
        Хөлийн бичиг нь ЭНГИЙН БАРААН (`text-ink-soft`).

        Урьд нь бүхэл хөл ЦЭНХЭР (`text-brand-600`) байсан: хаяг, ажлын цаг,
        уриа гээд бүх энгийн бичиг брэндийн өнгөөр гардаг тул хөл нь нэг
        том линк мэт харагдаж, уншихад ядрааж байв. Энгийн бичиг бараан
        байх нь ердийн бөгөөд уншихад амар.

        ⚠️ ТОКЕН ашиглана, хатуу hex БИШ — `--color-ink-soft` нь харанхуй
        горимд цайвар болж эргэдэг. Хатуу өнгө бичвэл харанхуйд хар дэвсгэр
        дээр хар бичиг болно (тестээр түгжигдсэн).

        Гурван баганын гарчиг нь УЛБАР ШАР (`text-accent` — «Google Maps-аар
        нээх» линктэй ЯГ ижил өнгө) — ингэснээр тэр гурван зангуу нүдэнд эхлээд
        тусч, доорх мэдээлэл нь тэдгээрийн доор эрэмбэлэгдэж уншигдана.
      */
      className="mt-16 scroll-mt-20 border-t border-hairline bg-card text-ink-soft"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-2 lg:grid-cols-4">
        {/* Байгууллага */}
        <div>
          {/*
            * ⚠️ `shrink-0` нь тэмдэг дээр ЗААВАЛ.
            *
            * Flex-ийн хүүхэд анхдагчаар шахагддаг (`flex-shrink: 1`). Хөлийн
            * багана нарийн (≈220px) тул нэр урт болоход тэмдэг 36px-ээс 24px
            * болж шахагдаж, дөрвөлжин нь ЗУУВАН болдог байв — лого гажна.
            * `size-9` нь өөрөө үүнээс хамгаалдаггүй: тэр зөвхөн үндсэн хэмжээг
            * заана, шахалтыг зогсоодоггүй.
            */}
          {/*
            * `items-start` — нэр 2 мөр болох тул тэмдгийг ЭХНИЙ мөртэй эгнүүлнэ.
            *
            * Багана 220px, тэмдэг+зай 46px тул нэрэнд 174px үлдэнэ. «Printmn.net
            * Онлайн үйлчилгээ» нэг мөрөнд 234px эзэлдэг — багтах боломжгүй тул
            * зайлшгүй мултарна. `items-center` үед тэмдэг хоёр мөрийн ГОЛД
            * хөвж, лого нэрнээсээ салсан мэт харагддаг байв.
            */}
          <p className="flex items-start gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-500 text-lg font-bold text-white">
              P
            </span>
            {/*
              * Жинг сулруулав (800 → 500). `CONTACT.company` нь урт нэр болсон
              * тул хэт бүдүүн бичиг хөлийн нарийн баганад бөөгнөрч харагдана.
              * `leading-snug` нь мултарсан хоёр мөрийг ойртуулж, тэмдгийн
              * өндөртэй тэнцүүлнэ.
              */}
            <span className="text-base font-medium leading-snug text-ink">
              {CONTACT.company}
            </span>
          </p>
          <p className="mt-3 text-sm leading-relaxed">{t('common.tagline')}</p>

        </div>

        {/* Холбоо барих */}
        <div>
          <h2 className="text-sm font-bold text-accent">{t('footer.contact')}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {CONTACT.phones.map((phone) => (
              <li key={phone.href}>
                <a href={phone.href} className="flex items-center gap-2 hover:text-brand-500">
                  <IconPhone className="size-4 shrink-0" />
                  {phone.label}
                </a>
              </li>
            ))}
            {CONTACT.emails.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 break-all hover:text-brand-500"
                >
                  <IconMail className="size-4 shrink-0" />
                  {email}
                </a>
              </li>
            ))}

            {/*
              Сошиал холбоос нь ХОЛБОО БАРИХ баганад.
              Урьд нь байгууллагын баганад, зөвхөн нэрээрээ («facebook»)
              жагсдаг байсан: тэнд утас, и-мэйлээс тусдаа байрладаг тул
              «энэ бол бас нэг холбогдох арга» гэдэг нь харагддаггүй.
              Практикт Монголд Facebook Messenger нь утаснаас илүү олон
              захиалга авчирдаг тул хамгийн ил байх ёстой.
            */}
            {socials.map(([name, url]) => (
              <li key={name}>
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 capitalize hover:text-brand-500"
                >
                  <IconFacebook className="size-4 shrink-0" />
                  {name}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Байршил */}
        <div>
          <h2 className="text-sm font-bold text-accent">{t('footer.location')}</h2>
          <p className="mt-3 flex gap-2 text-sm leading-relaxed">
            <IconMapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-semibold text-ink">
                {CONTACT.address.place}
              </span>
              {CONTACT.address.full}
              <br />
              <a
                href={CONTACT.address.mapUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-accent hover:underline"
              >
                {t('footer.openMaps')}
              </a>
            </span>
          </p>
        </div>

        {/* Ажлын цаг */}
        <div>
          <h2 className="text-sm font-bold text-accent">{t('footer.hours')}</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {CONTACT.hours.map((row) => (
              <div key={row.daysKey} className="flex items-start gap-2">
                <IconClock className="mt-0.5 size-4 shrink-0" />
                <dt className="flex-1">{t(row.daysKey)}</dt>
                <dd className="font-semibold text-ink">
                  {row.timeKey ? t(row.timeKey) : row.time}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/*
        * Хамгийн доод мөр — ГОЛЛУУЛСАН, ганц мөр.
        *
        * Өмнө нь зүүн талд эрхийн мэдэгдэл, баруун талд «Зураг захиалах»
        * линк хоёр талдаа тархсан байв. Хөлийн дээд хэсэгт аль хэдийн дөрвөн
        * баганын мэдээлэл, хуудсанд хэдэн захиалах товч байгаа тул энд дахин
        * дуудах шаардлагагүй — эцсийн мөр нь зөвхөн эрхийн мэдэгдэл байх нь
        * тайван, бүрэн төгссөн мэдрэмж өгнө.
        */}
      <div className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-5 text-center text-xs sm:px-6">
          <p>
            © {new Date().getFullYear()} {CONTACT.legalName}. {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
