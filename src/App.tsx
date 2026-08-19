import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import { BasketProvider } from './state/basket';
import { LangProvider } from './state/lang';

/**
 * Нүүр хуудсаас бусдыг тусад нь ачаална.
 *
 * Анх орж ирсэн хүнд хэрэгтэй нь Hero + холбоо барих хоёр л. Каталог (17KB),
 * захиалгын маягт, зургийн код — бүгд эхний ачаалалтаас хасагдаж ~20KB gzip
 * буурна. Утасны сүлжээнд байт хэмнэхээс илүү чухал нь JS задлах,
 * ажиллуулах хугацаа богиносох явдал.
 */
const Print = lazy(() => import('./pages/Print'));
const Order = lazy(() => import('./pages/Order'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const IdPhoto = lazy(() => import('./pages/IdPhoto'));
const NotFound = lazy(() => import('./pages/NotFound'));

/** Хуудас солигдох агшинд харагдах — байрлалаа барьж, үсрэлт үүсгэхгүй. */
function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <p className="text-sm text-muted">Уншиж байна…</p>
    </div>
  );
}

/**
 * Гол зам (`Хэвлэл`) руу орох магадлал өндөр тул сул зуур нь урьдчилж татна.
 *
 * Ингэснээр код тусад нь хуваагдсаны цорын ганц сул тал — товч дарахад хүлээх
 * — арилна: хэрэглэгч нүүр хуудсыг уншиж байх зуур chunk аль хэдийн ирчихсэн
 * байна. `requestIdleCallback` учир анхны зурагдалтыг саатуулахгүй.
 */
function usePrefetchMainRoutes() {
  useEffect(() => {
    const prefetch = () => {
      void import('./pages/Print');
      void import('./pages/Order');
    };

    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(prefetch, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(prefetch, 1500);
    return () => clearTimeout(timer);
  }, []);
}

export default function App() {
  usePrefetchMainRoutes();

  return (
    <BrowserRouter>
      {/*
        * Хэл нь сагснаас ГАДНА байрлана: сагс дотор `File` объект байдаг тул
        * хэл солиход дахин үүсэх ёсгүй. Гадна талд байснаар хэл солиход зөвхөн
        * текст дахин зурагдана, сонгосон зураг хэвээр үлдэнэ.
        */}
      <LangProvider>
        <BasketProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="zakhialga" element={<Order />} />
                {/* Захиалгын төлөв — хэрэглэгч хэдийд ч буцаж орж болно. */}
                <Route path="zakhialga/:orderNumber" element={<OrderStatus />} />
                <Route path="hevlel" element={<Print />} />
                {/* Хуучин линк — шинэ хэвлэлийн хуудас руу шилжүүлнэ. */}
                <Route path="zurag-ugaalt" element={<Navigate to="/hevlel" replace />} />
                <Route path="tseej-zurag" element={<IdPhoto />} />
                {/* Ажилтны хэрэгсэл — бүрэн офлайн, захиалгын мэдээлэлгүй. */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </BasketProvider>
      </LangProvider>
    </BrowserRouter>
  );
}
