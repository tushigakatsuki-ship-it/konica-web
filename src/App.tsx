import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Order from './pages/Order';
import Print from './pages/Print';
import IdPhoto from './pages/IdPhoto';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import { BasketProvider } from './state/basket';

export default function App() {
  return (
    <BrowserRouter>
      <BasketProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="zakhialga" element={<Order />} />
            <Route path="hevlel" element={<Print />} />
            {/* Хуучин линк — шинэ хэвлэлийн хуудас руу шилжүүлнэ. */}
            <Route path="zurag-ugaalt" element={<Navigate to="/hevlel" replace />} />
            <Route path="tseej-zurag" element={<IdPhoto />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Ажилтны хуудас — хэрэглэгчийн толгой/хөлгүй. */}
          <Route path="admin" element={<Admin />} />
        </Routes>
      </BasketProvider>
    </BrowserRouter>
  );
}
