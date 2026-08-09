import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV, PRIMARY_PHONE } from '../data/site';
import { IconClose, IconMenu, IconPhone, IconPrinter } from '../components/icons';

const linkBase =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ' +
  'transition-colors hover:text-brand-500';

/** Утсан дээрх цэсний мөр — хуруунд эвтэйхэн өндөртэй. */
const mobileLink =
  'flex items-center gap-2.5 rounded-md px-3 py-3 text-base font-medium ' +
  'text-ink-soft active:bg-brand-50';

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname, hash } = useLocation();

  const close = () => setOpen(false);

  /* Хуудас солигдоход цэсийг хааж, нээлттэй үед арын гүйлтийг түгжинэ. */
  useEffect(() => setOpen(false), [pathname, hash]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-hairline bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" onClick={close} className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-md bg-brand-500 text-lg font-black text-white">
            P
          </span>
          <span className="text-xl font-extrabold tracking-tight">Printmn</span>
        </Link>

        {/*
          * Утасны дугаар толгойд.
          *
          * Зургийн газарт ирдэг хүсэлтийн дийлэнх нь «энэ хэмжээ байна уу»,
          * «хэзээ бэлэн болох вэ» гэсэн богино асуулт — тэднийг вэб дээр
          * тэнүүчлүүлэхээс залгуулах нь хурдан. Тиймээс дугаар нь эхний
          * дэлгэц дээр, дарахад шууд залгагддаг байх ёстой.
          */}
        <nav className="hidden items-center gap-1 md:flex">
          <a
            href={PRIMARY_PHONE.href}
            className="mr-2 flex items-center gap-2 rounded-md px-3 py-1.5 transition-colors hover:bg-brand-50"
          >
            <IconPhone className="size-4 text-brand-500" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">{PRIMARY_PHONE.label}</span>
              {PRIMARY_PHONE.note && (
                <span className="block text-[11px] text-muted">{PRIMARY_PHONE.note}</span>
              )}
            </span>
          </a>
          <a
            href={pathname === '/' ? '#kholboo' : '/#kholboo'}
            className={`${linkBase} text-ink-soft`}
          >
            Холбоо барих
          </a>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${linkBase} ${isActive ? 'text-brand-500' : 'text-ink-soft'}`
              }
            >
              <IconPrinter className="size-4" /> {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          {/* Утсан дээр дугаарыг цэс нээхгүйгээр шууд дарж болно. */}
          <a
            href={PRIMARY_PHONE.href}
            aria-label={`${PRIMARY_PHONE.label} руу залгах`}
            className="grid size-11 place-items-center rounded-md border border-hairline text-brand-500"
          >
            <IconPhone className="size-5" />
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Цэс"
            aria-expanded={open}
            className="grid size-11 place-items-center rounded-md border border-hairline"
          >
            {open ? <IconClose className="size-5" /> : <IconMenu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-hairline bg-white px-4 py-2 shadow-lg md:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={close} className={mobileLink}>
              <IconPrinter className="size-4" /> {item.label}
            </NavLink>
          ))}
          <a href="/#kholboo" onClick={close} className={mobileLink}>
            <IconPhone className="size-4" /> Холбоо барих
          </a>
          <a href={PRIMARY_PHONE.href} className={`${mobileLink} mb-1 text-brand-500`}>
            <IconPhone className="size-4" /> {PRIMARY_PHONE.label}
          </a>
        </nav>
      )}
    </header>
  );
}
