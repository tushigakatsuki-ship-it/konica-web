import { useState } from 'react';
import { CONTACT } from '../data/site';
import { IconArrowRight, IconMapPin } from './icons';

/**
 * Байршлын газрын зураг.
 *
 * ⚠️ ОДООГООР ХААНА Ч ХОЛБОГДООГҮЙ. Нүүр хуудасны «Бидэнтэй холбоо барих»
 * хэсгийг хассан үед энэ ч хамт салсан. Файлыг устгаагүй шалтгаан: доорх
 * facade хэв маяг болон `goo.gl` товч линкийн асуудал нь дахин олж мэдэхэд
 * хэцүү мэдлэг бөгөөд зураг угаалгах газарт байршил хожим дахин хэрэгтэй
 * болох магадлал өндөр. Буцааж нэмэхэд нэг мөр импорт хангалттай.
 *
 * Хэрэглэгдээгүй тул bundle-д ОРОХГҮЙ (импортгүй модулийг rollup хаядаг).
 *
 * ⚠️ Google Maps-ийн `<iframe>` нь **1MB орчим** JS татдаг бөгөөд хуудас
 * ачаалахтай зэрэг эхэлдэг. Холбоо барих хэсэг рүү хүрэлгүй гарсан хүн ч
 * түүнийг төлдөг — гар утасны сүлжээнд энэ нь мэдэгдэхүйц.
 *
 * Тиймээс **facade** хэв маягийг ашиглав: эхлээд хөнгөн зурагт хайрцаг
 * харуулж, хэрэглэгч «Газрын зураг харах» дарсан үед л iframe ачаална.
 * Ихэнх хүн үүнийг ч дардаггүй — тэдэнд зөвхөн хаяг, чиглүүлэх товч хэрэгтэй.
 *
 * `mapUrl` нь товч линк (`maps.app.goo.gl`) — утсан дээр Google Maps апп
 * шууд нээгддэг тул чиглүүлэх гэж буй хүнд хамгийн шууд зам.
 */

const { place, full, mapUrl, lat, lng } = CONTACT.address;

/**
 * Түлхүүргүй embed хаяг.
 *
 * `maps.app.goo.gl` товч линкийг `<iframe>`-д тавьж болдоггүй (дотроо
 * чиглүүлэлт хийдэг тул хөтөч блоклоно). Координатаар шууд дуудна.
 */
const embedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=17&hl=mn&output=embed`;

export default function MapEmbed() {
  const [shown, setShown] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border border-hairline">
      <div className="relative aspect-4/3 w-full bg-brand-50 sm:aspect-video">
        {shown ? (
          <iframe
            src={embedUrl}
            title={`${place} — газрын зураг`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShown(true)}
            className="absolute inset-0 grid place-items-center px-6 text-center transition-colors hover:bg-brand-100/60"
          >
            <span>
              <IconMapPin className="mx-auto size-8 text-brand-500" />
              <span className="mt-3 block text-base font-bold">{place}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">{full}</span>
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white">
                Газрын зураг харах
              </span>
            </span>
          </button>
        )}
      </div>

      {/*
        * Чиглүүлэх товч нь ҮРГЭЛЖ харагдана.
        *
        * Хүн байршлыг вэб дээр ширтэхийг биш, утсаараа тийш явахыг хүсдэг.
        * Товч линк нь Google Maps аппыг шууд нээнэ.
        */}
      <a
        href={mapUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-3 text-sm font-semibold transition-colors hover:bg-brand-50"
      >
        <span className="flex items-center gap-2">
          <IconMapPin className="size-4 text-brand-500" />
          Google Maps-аар нээх
        </span>
        <IconArrowRight className="size-4 text-brand-500" />
      </a>
    </div>
  );
}
