import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { NAV } from '../data/site';

const linkBase =
  'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-brand-500';

/** Утсан дээрх цэсний мөр — хуруунд эвтэйхэн өндөртэй. */
const mobileLink =
  'block rounded-md px-3 py-3 text-base font-medium text-ink-soft active:bg-brand-50';

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

        <nav className="hidden items-center gap-1 md:flex">
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
              <span aria-hidden>{item.icon}</span> {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Цэс"
          aria-expanded={open}
          className="grid size-11 place-items-center rounded-md border border-hairline md:hidden"
        >
          <span className="text-lg leading-none">{open ? '✕' : '☰'}</span>
        </button>
      </div>

      {open && (
        <nav className="border-t border-hairline bg-white px-4 py-2 shadow-lg md:hidden">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} onClick={close} className={mobileLink}>
              <span aria-hidden>{item.icon}</span> {item.label}
            </NavLink>
          ))}
          <a href="/#kholboo" onClick={close} className={`${mobileLink} mb-1`}>
            <span aria-hidden>📞</span> Холбоо барих
          </a>
        </nav>
      )}
    </header>
  );
}
