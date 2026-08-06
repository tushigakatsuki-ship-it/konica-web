import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-32 text-center">
      <p className="text-6xl font-black text-brand-100">404</p>
      <h1 className="mt-4 text-2xl font-extrabold">Хуудас олдсонгүй</h1>
      <p className="mt-3 text-sm text-muted">
        Хайсан хуудас устсан эсвэл хаяг нь өөрчлөгдсөн байж магадгүй.
      </p>
      <Link to="/" className="btn-brand mt-8">
        Нүүр хуудас руу буцах
      </Link>
    </div>
  );
}
