import { Link } from 'react-router-dom';
import { CONTACT } from '../data/site';
import { IconClock, IconMail, IconMapPin, IconPhone } from './icons';

/**
 * Хөл — жижиг бизнесийн вэбийн хамгийн их уншигддаг хэсгүүдийн нэг.
 *
 * Хүн «хаана байдаг вэ», «хэдэн цагт нээдэг вэ», «утас нь хэд вэ» гэдгийг
 * ихэвчлэн доош гүйлгээд хайдаг. Өмнө нь энд зөвхөн copyright мөр байсан тул
 * тэр гурван асуулт бүр дуудлага болж хувирдаг байв.
 *
 * Бүх утга `data/site.ts`-ээс — нэг газар засахад толгой, холбоо барих хэсэг,
 * хөл гурав зэрэг шинэчлэгдэнэ.
 */
export default function Footer() {
  const socials = Object.entries(CONTACT.social).filter(([, url]) => url);

  return (
    <footer className="mt-16 border-t border-hairline bg-ink text-white/80">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-12 md:grid-cols-2 lg:grid-cols-4">
        {/* Байгууллага */}
        <div>
          <p className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-md bg-brand-500 text-lg font-black text-white">
              P
            </span>
            <span className="text-lg font-extrabold text-white">{CONTACT.company}</span>
          </p>
          <p className="mt-3 text-sm leading-relaxed">{CONTACT.tagline}</p>

          {socials.length > 0 && (
            <ul className="mt-4 flex gap-3 text-sm">
              {socials.map(([name, url]) => (
                <li key={name}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="capitalize hover:text-white"
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Холбоо барих */}
        <div>
          <h2 className="text-sm font-bold text-white">Холбоо барих</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {CONTACT.phones.map((phone) => (
              <li key={phone.href}>
                <a href={phone.href} className="flex items-center gap-2 hover:text-white">
                  <IconPhone className="size-4 shrink-0" />
                  {phone.label}
                </a>
              </li>
            ))}
            {CONTACT.emails.map((email) => (
              <li key={email}>
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-2 break-all hover:text-white"
                >
                  <IconMail className="size-4 shrink-0" />
                  {email}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Байршил */}
        <div>
          <h2 className="text-sm font-bold text-white">Байршил</h2>
          <p className="mt-3 flex gap-2 text-sm leading-relaxed">
            <IconMapPin className="mt-0.5 size-4 shrink-0" />
            <span>
              <span className="block font-semibold text-white">
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
                Google Maps-аар нээх
              </a>
            </span>
          </p>
        </div>

        {/* Ажлын цаг */}
        <div>
          <h2 className="text-sm font-bold text-white">Ажлын цаг</h2>
          <dl className="mt-3 space-y-1.5 text-sm">
            {CONTACT.hours.map((row) => (
              <div key={row.days} className="flex items-start gap-2">
                <IconClock className="mt-0.5 size-4 shrink-0" />
                <dt className="flex-1">{row.days}</dt>
                <dd className="font-semibold text-white">{row.time}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {new Date().getFullYear()} {CONTACT.legalName}. Бүх эрх хуулиар
            хамгаалагдсан.
          </p>
          <Link to="/hevlel" className="font-semibold text-accent hover:underline">
            Зураг захиалах
          </Link>
        </div>
      </div>
    </footer>
  );
}
