import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';

/** Хуудас солигдох бүрт дээш нь буцаана (hash линк байвал алгасна). */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);
  return null;
}

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollToTop />
      <Header />
      {/*
        * Хуудас солигдоход агуулга зөөлөн гарч ирнэ.
        *
        * `key={pathname}` нь React-д хуучин мод устгаж, шинийг УГААС нь
        * шинээр суулгахыг хэлнэ — тиймээс CSS анимаци дахин ажиллана.
        * Түлхүүргүй бол React зөвхөн ялгааг нь шинэчилж, анимаци гарахгүй.
        *
        * Хугацаа нь богино (180ms). Урт шилжилт нь өдөрт зуун удаа хуудас
        * солидог ажилтныг удаашруулж, эцэст нь бухимдуулна.
        *
        * Хөдөлгөөн хүсээгүй хэрэглэгчид энэ нь `index.css` доторх нэгдсэн
        * `prefers-reduced-motion` дүрмээр автоматаар унтарна.
        */}
      <main key={pathname} className="page-enter flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
