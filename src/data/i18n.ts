/**
 * Хоёр хэлний текст — ГАНЦ эх сурвалж.
 *
 * ── Яагаад i18next биш вэ ────────────────────────────────────────
 *
 * `i18next` + `react-i18next` нь gzip хийсний дараа ~40KB нэмдэг бөгөөд
 * бидэнд түүний олонх боломж (олон тооны хэлбэр, огнооны формат, зайнаас
 * татах, namespace) хэрэггүй. Хоёр хэл, тогтмол мөрүүд, build үед мэдэгддэг
 * түлхүүрүүд — энэ бүхэн ердийн объектод багтана.
 *
 * Түлхүүр нь `хэсэг.утга` хэлбэртэй. TypeScript нь `StringKey`-ээр дамжуулан
 * буруу түлхүүрийг build үед барина — алдаа ашиглалтад гарахгүй.
 *
 * ── Үйлчилгээний нэрсийг яагаад дүрмээр хөрвүүлдэг вэ ────────────
 *
 * Каталогт 82 мөр байгаа бөгөөд бүгд `<төрөл> <хэмжээ>` хэв маягтай.
 * Мөр бүрт `nameEn` гараар бичих нь: (1) 82 давхардсан мөр, (2) шинэ
 * үйлчилгээ нэмэх бүрд англи нэрийг мартах эрсдэл. Оронд нь хэллэгийн
 * хүснэгтээр хөрвүүлнэ — шинэ хэмжээ нэмэхэд ямар ч засвар шаардахгүй.
 */

export type Lang = 'mn' | 'en';

export const LANGS: readonly Lang[] = ['mn', 'en'];

/** Хэл сонгогч дээр харагдах нэр. */
export const LANG_LABEL: Record<Lang, string> = {
  mn: 'Монгол',
  en: 'English',
};

/** Товч хэлбэр — нарийн дэлгэц дээр. */
export const LANG_SHORT: Record<Lang, string> = {
  mn: 'MN',
  en: 'EN',
};

type Entry = { mn: string; en: string };

export const STRINGS = {
  /* ── Толгой, цэс ── */
  'nav.print': { mn: 'Хэвлэл', en: 'Printing' },
  'nav.stationery': { mn: 'Бичиг хэрэг', en: 'Stationery' },
  'nav.idPhoto': { mn: 'Цээж зураг', en: 'ID photos' },
  'nav.contact': { mn: 'Холбоо барих', en: 'Contact' },
  'nav.menu': { mn: 'Цэс', en: 'Menu' },
  'nav.close': { mn: 'Хаах', en: 'Close' },
  'nav.language': { mn: 'Хэл', en: 'Language' },
  'nav.callAria': { mn: 'руу залгах', en: 'call' },

  /* ── Нүүр — эхний дэлгэц ── */
  'hero.badge': {
    mn: 'Konica Minolta · FujiFilm · Мэргэжлийн зураг угаалт',
    en: 'Konica Minolta · Professional photo lab',
  },
  'hero.titleTop': { mn: 'Чанартай хэвлэл,', en: 'Quality printing,' },
  'hero.titleAccent': { mn: 'хурдан үйлчилгээ', en: 'fast service' },
  'hero.subtitle': {
    mn: 'Хэмжээгээ сонгоод зургаа шууд оруулаарай.',
    en: 'Pick your size and add your photo — the price shows up right away.',
  },

  /*
   * ── Нүүр ──
   *
   * «Юу хийлгэх вэ?» гарчиг, түүний тайлбар, хоёр картын текст бүгд
   * хасагдсан: тэдгээр нь эхний дэлгэц дээрх товчтой ижил газар руу
   * заадаг байсан тул давхардал байв. Үлдсэн нь зөвхөн «Удахгүй» —
   * Бичиг хэрэг товчны шошго.
   */
  'home.comingSoon': { mn: 'Удахгүй', en: 'Coming soon' },

  /* ── Нүүр — холбоо барих ── */
  'contact.title': { mn: 'Бидэнтэй холбоо барих', en: 'Get in touch' },
  'contact.lead': {
    mn: 'Асуулт, санал хүсэлт байвал шууд залгаарай. Ажлын цагт хурдан хариулна.',
    en: 'Call us with any question — we answer quickly during opening hours.',
  },
  'contact.orderPrint': { mn: 'Хэвлэл захиалах', en: 'Order printing' },
  'contact.address': { mn: 'Хаяг', en: 'Address' },
  'contact.phone': { mn: 'Утас', en: 'Phone' },
  'contact.email': { mn: 'И-мэйл', en: 'Email' },
  'contact.hours': { mn: 'Ажлын цаг', en: 'Opening hours' },

  /* ── Хэвлэлийн хуудас ── */
  'print.title': { mn: 'Хэмжээгээ сонгоод зургаа оруул', en: 'Pick a size, add your photo' },
  'print.subtitle': {
    mn: 'Хэмжээ бүрийн үнэ шууд харагдана. Хэмжээ дээрээ дараад зургаа оруулж, хэдэн ширхэг хэвлэхээ л сонгоно.',
    en: 'Every price is shown up front. Tap a size, add your photo and choose how many prints you need.',
  },
  'print.categories': { mn: 'Үйлчилгээний төрөл', en: 'Service categories' },
  'print.allCategories': { mn: 'Бүх төрөл', en: 'All categories' },
  'print.categoriesHint': {
    mn: 'Төрөл дээрээ дарж үнийн жагсаалтаа хараарай.',
    en: 'Tap a category to see its price list.',
  },
  'print.itemCount': { mn: 'төрөл', en: 'options' },

  /*
   * Захиалгын хязгаар, илгээх хугацаа.
   *
   * ⚠️ Хязгаар нь урьд нь ЗӨВХӨН серверт байсан тул хэрэглэгч зургаа бүгдийг
   * бэлдээд «60-аас олон файл байж болохгүй» гэсэн алдаа хардаг байв. Тэр
   * 60 гэсэн тоо хаанаас гарсныг ойлгох арга байхгүй — зураг бүрээс ХОЁР
   * файл гардгийг зөвхөн код л мэддэг байлаа.
   */
  'limit.title': {
    mn: 'Нэг захиалгад {max} хүртэл зураг',
    en: 'Up to {max} photos per order',
  },
  'limit.count': {
    mn: 'Одоо {n}/{max} зураг сонгосон — ойролцоогоор {mb}MB.',
    en: '{n}/{max} photos selected — about {mb}MB.',
  },
  'limit.time': {
    mn: 'Илгээхэд сайн WiFi-д ~{fast} минут, гар утасны сүлжээгээр ~{slow} минут болно. Цонхоо нээлттэй байлгаарай.',
    en: 'Sending takes about {fast} min on good WiFi, up to ~{slow} min on mobile data. Keep the tab open.',
  },

  /*
   * Бэлэн бус ангиллуудыг НЭГТГЭСЭН хавтан.
   *
   * Урьд нь 9 ангилал тус бүр «Удахгүй» шошготой хавтан эзэлдэг байсан тул
   * тор нь ажиллахгүй зүйлээр дүүрч, БЭЛЭН цорын ганц үйлчилгээ (зураг
   * угаалт) тэдгээрийн дунд төөрдөг байв.
   */
  'print.moreServices': { mn: 'Нэмэлт үйлчилгээ', en: 'More services' },
  'print.moreServicesHint': {
    mn: 'Өргөмжлөл, медаль, хувцас хэвлэл, тууз, хулдаас, хувилах, скан.',
    en: 'Certificates, medals, garment printing, ribbons, banners, copying, scanning.',
  },
  'print.veryComingSoon': { mn: 'Тун удахгүй', en: 'Very soon' },
  'print.showAll': { mn: 'Бүх хэмжээ харах', en: 'Show all sizes' },
  'print.continue': { mn: 'Захиалга үргэлжлүүлэх', en: 'Continue to order' },
  'print.back': { mn: 'Буцах', en: 'Back' },
  'print.staffTool': {
    mn: 'Ажилтны хэрэгсэл — цээж зураг автоматаар',
    en: 'Staff tool — automatic ID photos',
  },
  'print.showPopular': { mn: 'Түгээмэл хэмжээг харуулах', en: 'Show popular sizes' },
  'print.yourPick': { mn: 'Таны сонголт', en: 'Your selection' },
  'print.emptyBasket': {
    mn: 'Хэмжээ дээрээ дарж зургаа оруулна уу.',
    en: 'Tap a size to add your photo.',
  },
  'print.total': { mn: 'Нийт', en: 'Total' },
  'print.privacy': {
    mn: 'Зураг таны төхөөрөмжөөс гарахгүй. Захиалга илгээх товч дарсны дараа л хамгаалалттай сан руу шилжинэ.',
    en: 'Your photos stay on your device. They only move to secure storage once you send the order.',
  },
  'print.remove': { mn: 'Хасах', en: 'Remove' },
  'print.decrease': { mn: 'Хорогдуулах', en: 'Decrease' },
  'print.increase': { mn: 'Нэмэгдүүлэх', en: 'Increase' },
  'print.pieces': { mn: 'ш · нийт', en: 'pcs · total' },
  'print.continueShort': { mn: 'Үргэлжлүүлэх', en: 'Continue' },

  /* ── Өөрийн хэмжээ ── */
  'custom.card': { mn: 'Өөр хэмжээ', en: 'Custom size' },
  'custom.cardHint': { mn: 'Жагсаалтад байхгүй хэмжээ', en: 'A size not in the list' },
  'custom.title': { mn: 'Өөрийн хэмжээ оруулах', en: 'Enter your own size' },
  'custom.body': {
    mn: 'Жагсаалтад байхгүй хэмжээгээр хэвлүүлэх бол өргөн, өндрөө сантиметрээр бичээд зургаа оруулна уу.',
    en: 'To print at a size that is not in the list, enter the width and height in centimetres and add your photo.',
  },
  'custom.width': { mn: 'Өргөн (см)', en: 'Width (cm)' },
  'custom.height': { mn: 'Өндөр (см)', en: 'Height (cm)' },
  'custom.range': { mn: '{min}–{max} см хооронд', en: 'Between {min} and {max} cm' },
  'custom.invalid': {
    mn: 'Өргөн, өндөр хоёулаа {min}–{max} см хооронд байх ёстой.',
    en: 'Width and height must both be between {min} and {max} cm.',
  },
  'custom.next': { mn: 'Зургаа оруулах', en: 'Add your photo' },
  'custom.cancel': { mn: 'Болих', en: 'Cancel' },
  'custom.priceNote': {
    mn: 'Үнэ тохиролцоно — ажилтан залгаж хэлнэ',
    en: 'Price on request — our staff will call you',
  },
  'custom.byAgreement': { mn: 'Тохиролцоно', en: 'On request' },
  'custom.totalNote': {
    mn: 'Тохиролцооны хэмжээ дүнд ороогүй — ажилтан залгаж үнээ хэлнэ.',
    en: 'Custom sizes are not included in the total — our staff will call you with the price.',
  },

  /* ── Дэлгүүр дээр хийгддэг үйлчилгээ ── */
  'walkIn.title': { mn: 'Энэ үйлчилгээг дэлгүүр дээр хийнэ', en: 'This service is done in store' },
  'walkIn.body': {
    mn: 'Эдгээрийг онлайнаар захиалах боломжгүй — материал, хэмжээ, загварыг биечлэн тохирох шаардлагатай. Үнийг доор харуулав. Утсаар холбогдвол ажилтан дэлгэрэнгүй тайлбарлаж, хугацааг хэлнэ.',
    en: 'These cannot be ordered online — the material, size and design need to be agreed in person. Prices are listed below. Call us and our staff will walk you through the details and timing.',
  },
  'walkIn.idPhotoTitle': { mn: 'Цээж зураг тусдаа хуудастай', en: 'ID photos have their own page' },
  'walkIn.idPhotoBody': {
    mn: 'Зургаа оруулахад нүүрийг олж, дэвсгэрийг цагаан болгож, стандартын дагуу тайрна. Хэвлэхэд тохирох эсэхийг шалгаад л сагсанд нэмнэ. Салбар дээр ирж авахуулах ч боломжтой.',
    en: 'Upload a photo and we detect the face, whiten the background and crop it to standard. We check it is fit to print before it goes in your basket. You can also have it taken in store.',
  },
  'walkIn.idPhotoCta': { mn: 'Цээж зураг захиалах', en: 'Order ID photos' },

  /* ── Заавар ── */
  'tips.summary': {
    mn: 'Анхаарах зүйл — нягтрал, тайралт, өнгө',
    en: 'Good to know — resolution, cropping, colour',
  },
  'tips.resolution': { mn: 'Нягтрал', en: 'Resolution' },
  'tips.resolutionText': {
    mn: 'Зураг сонгоход тухайн хэмжээнд тохирох пикселийн доод хэмжээг харуулж, багадвал сануулна.',
    en: 'When you pick a photo we show the minimum pixels for that size and warn you if it falls short.',
  },
  'tips.crop': { mn: 'Тайралт', en: 'Cropping' },
  'tips.cropText': {
    mn: 'Зураг цаасны харьцаанд төвөөрөө багтана. Урьдчилсан харагдац дээрх зүйл л хэвлэгдэнэ.',
    en: 'Photos are centred to the paper ratio. What you see in the preview is exactly what prints.',
  },
  'tips.colour': { mn: 'Өнгө', en: 'Colour' },
  'tips.colourText': {
    mn: 'sRGB профайл. Хэт харанхуй эсвэл бүдэг зургийг ажилтан утсаар тохирч засаж өгнө.',
    en: 'sRGB profile. If a photo is too dark or soft, our staff will call you and correct it.',
  },

  /* ── 12 ангиллын тайлбар ── */
  'cat.wash': { mn: 'Konica Minolta лабораторын өнгө. 6×9-өөс 50×100 см.', en: 'Konica Minolta lab colour. 6×9 up to 50×100 cm.' },
  'cat.retouch': { mn: 'Хуучирсан, гэмтсэн зургийг сэргээж хэвлэнэ.', en: 'Old or damaged photos restored, then printed.' },
  'cat.scan': { mn: 'Хэвлэмэл зургийг дижитал болгох, хувилах.', en: 'Turn printed photos into digital files, or copy them.' },
  'cat.idPhoto': { mn: 'Иргэний үнэмлэх, паспорт, виз — стандартын дагуу.', en: 'ID cards, passports and visas — to standard.' },
  'cat.copy': { mn: 'Өнгөт ба хар цагаан хувилагч, бичиг баримт.', en: 'Colour and black-and-white copying, documents.' },
  'cat.paper': { mn: '200гр фото цаас — А4, А3.', en: '200 gsm photo paper — A4 and A3.' },
  'cat.medal': { mn: 'Төмөр, шилэн медаль, оосор, цом.', en: 'Metal and glass medals, lanyards, trophies.' },
  'cat.certificate': { mn: 'Цаасан ба модон өргөмжлөл — А4, А5.', en: 'Paper and wooden certificates — A4, A5.' },
  'cat.memorial': { mn: 'Дурсгалын бичиг, хүндэтгэлийн үг.', en: 'Commemorative and tribute lettering.' },
  'cat.garment': { mn: 'Фудболк, ажлын хувцас, хантааз дээр хэвлэл.', en: 'T-shirts, workwear and vests.' },
  'cat.ribbon': { mn: 'Энгэрийн тууз, тэмдэг, баантик.', en: 'Lapel ribbons, badges and bows.' },
  'cat.banner': { mn: 'Хулдаас — бөгжтэй, өөр өөр хэмжээ.', en: 'Banners — eyeleted, various sizes.' },

  /* ── Зураг сонгох цонх ── */
  'editor.add': { mn: 'Зураг оруулах', en: 'Add photo' },
  'editor.multiHint': { mn: 'Олон зураг зэрэг сонгож болно', en: 'You can pick several at once' },
  'editor.fromGallery': { mn: 'Зурган сан эсвэл камераас', en: 'From gallery or camera' },
  'editor.loading': { mn: 'Уншиж байна…', en: 'Loading…' },
  'editor.replace': { mn: 'Зураг солих', en: 'Replace photo' },
  'editor.addMore': { mn: 'Зураг нэмэх', en: 'Add more' },
  'editor.save': { mn: 'Хадгалах', en: 'Save' },
  'editor.addToBasket': { mn: 'Сагсанд нэмэх', en: 'Add to basket' },
  'editor.pickFirst': { mn: 'Эхлээд зургаа сонгоно уу', en: 'Choose a photo first' },
  'editor.tooMany': {
    mn: 'Нэг удаад {n} хүртэл зураг сонгоно.',
    en: 'You can pick up to {n} photos at a time.',
  },
  'editor.limitHit': {
    mn: 'Нэг удаад {n} зургийн хязгаарт хүрлээ.',
    en: 'You have reached the limit of {n} photos at a time.',
  },
  'editor.unreadable': {
    mn: 'Файлыг уншиж чадсангүй. JPG эсвэл PNG зураг сонгоно уу.',
    en: 'Could not read that file. Please choose a JPG or PNG image.',
  },
  'editor.someFailed': {
    mn: '{n} зураг уншигдсангүй — үлдсэнийг нь нэмлээ.',
    en: '{n} photos could not be read — the rest were added.',
  },
  'editor.overflow': {
    mn: '{n} зураг хязгаараас хэтэрсэн тул хасагдлаа.',
    en: '{n} photos were dropped because of the limit.',
  },
  'editor.photoCount': { mn: '{n} зураг', en: '{n} photos' },
  'editor.totalPieces': { mn: 'Нийт {n} ширхэг', en: '{n} prints in total' },
  'editor.selected': { mn: 'Сонгосон', en: 'Selected' },
  'editor.summary': { mn: '{a} зураг · {b} ширхэг', en: '{a} photos · {b} prints' },
  'editor.soft': { mn: 'Бүдэг', en: 'Soft' },
  'editor.softTitle': { mn: 'Нягтрал багавтар', en: 'Low resolution' },
  'editor.removeNth': { mn: '{n} дэх зургийг хасах', en: 'Remove photo {n}' },
  'editor.decreaseNth': { mn: '{n} дэх зургийн тоог хорогдуулах', en: 'Decrease count for photo {n}' },
  'editor.increaseNth': { mn: '{n} дэх зургийн тоог нэмэгдүүлэх', en: 'Increase count for photo {n}' },
  'editor.previewNote': {
    mn: 'Хэвлэгдэх байдал — зураг дээр дарж томруулж, тайрч болно',
    en: 'Print preview — tap the photo to zoom in and crop',
  },

  // ── Цээж зураг ───────────────────────────────────────────────────
  'idPhoto.note.title': {
    mn: 'Хэмжээгээ сонгоод зургаа оруулаарай',
    en: 'Pick a size and upload your photo',
  },
  'idPhoto.note.body': {
    mn: 'Ажилтан манай лабораторид стандартын дагуу тайрч, дэвсгэрийг нь бэлтгэж хэвлэнэ. Та өөрөө засах шаардлагагүй. Жигд цайвар дэвсгэр дээр, урд талаас нь, хангалттай гэрэлтэй авсан зураг байвал хамгийн сайн.',
    en: 'Our staff will crop it to the required standard and prepare the background before printing — you do not need to edit anything. A photo taken face-on against a plain light background in good light works best.',
  },

  // ── Тайрах цонх ──────────────────────────────────────────────────
  'crop.title': { mn: 'Зургаа тохируулах', en: 'Adjust your photo' },
  'crop.short': { mn: 'Тайрах', en: 'Crop' },
  'crop.open': { mn: 'Зургийг томоор харах ба тайрах', en: 'View larger and crop' },
  'crop.openNth': {
    mn: '{n} дэх зургийг томоор харах ба тайрах',
    en: 'View and crop photo {n}',
  },
  'crop.zoom': { mn: 'Томруулах', en: 'Zoom' },
  'crop.hint': {
    mn: 'Хуруугаараа чирж байрлуулна. Хоёр хуруугаар эсвэл гулсуураар томруулна.',
    en: 'Drag to position. Pinch or use the slider to zoom.',
  },
  'crop.reset': { mn: 'Буцаах', en: 'Reset' },
  'crop.cancel': { mn: 'Болих', en: 'Cancel' },
  'crop.apply': { mn: 'Болсон', en: 'Done' },
  'crop.edited': { mn: 'Тайрсан', en: 'Cropped' },
  'editor.recommended': { mn: 'Санал болгох нягтрал', en: 'Recommended resolution' },
  'editor.recommendedShort': { mn: 'Санал болгох нягтрал: {n}', en: 'Recommended resolution: {n}' },
  'editor.sizeLabel': { mn: 'Хэмжээ', en: 'Size' },
  'editor.yourPhoto': { mn: 'Таны зураг', en: 'Your photo' },
  'editor.unitPrice': { mn: 'Нэгжийн үнэ', en: 'Unit price' },
  'editor.amount': { mn: 'Дүн', en: 'Amount' },
  'editor.lowResOne': {
    mn: 'Энэ зураг {size} хэвлэхэд нягтрал багавтар байна.',
    en: 'This photo is a little low-resolution for {size} prints.',
  },
  'editor.lowResMany': {
    mn: '{n} зураг {size} хэвлэхэд нягтрал багавтар байна.',
    en: '{n} photos are a little low-resolution for {size} prints.',
  },
  'editor.lowResFix': {
    mn: 'Тод гаргахын тулд {n} орчим байвал зохимжтой.',
    en: 'Around {n} would give a sharp result.',
  },

  /* ── Хөл ── */
  'footer.contact': { mn: 'Холбоо барих', en: 'Contact' },
  'footer.location': { mn: 'Байршил', en: 'Location' },
  'footer.hours': { mn: 'Ажлын цаг', en: 'Opening hours' },
  'footer.openMaps': { mn: 'Google Maps-аар нээх', en: 'Open in Google Maps' },
  'footer.rights': {
    mn: 'Бүх эрх хуулиар хамгаалагдсан.',
    en: 'All rights reserved.',
  },

  /* ── Ажлын цаг ── */
  /*
   * ⚠️ Монгол, англи хоёр нь ИЖИЛ өдрүүдийг заах ёстой.
   *
   * `mn: 'Даваа – Ням'` / `en: 'Monday – Friday'` гэж зөрсөн байв:
   * монголоор долоо хоног бүтэн, англиар ажлын өдөр л нээлттэй гэж
   * уншигдана. Гадаад иргэн бямба гаригт дэмий ирэх эрсдэлтэй.
   */
  'hours.weekdays': { mn: 'Даваа – Ням', en: 'Monday – Sunday' },
  // 'hours.saturday': { mn: 'Бямба', en: 'Saturday' },
  'hours.tuesday': { mn: 'Мягмар', en: 'Tuesday' },
  'hours.closed': { mn: 'Амарна', en: 'Closed' },

  /* ── Нийтлэг ── */
  'common.phoneNote': { mn: 'Захиалга, лавлагаа', en: 'Orders and enquiries' },
  'common.tagline': {
    mn: 'Зураг угаалт · Хэвлэлийн үйлчилгээ',
    en: 'Photo printing · Print services',
  },
} as const satisfies Record<string, Entry>;

export type StringKey = keyof typeof STRINGS;

/**
 * Мөрийг буцаана. `{n}`, `{a}` гэх мэт байрлагчийг `vars`-аас орлуулна.
 *
 * Яагаад бүрэн загварчлалын хэл биш вэ: бидэнд тоо оруулах л хэрэгтэй.
 * Тооны хэлбэр (нэг/олон) нь монгол хэлэнд өөрчлөгддөггүй, англид ч
 * эдгээр мөрөнд шаардлагагүй тул plural дүрэм нэмэх шалтгаангүй.
 */
export const translate = (
  key: StringKey,
  lang: Lang,
  vars?: Record<string, string | number>,
): string => {
  const text: string = STRINGS[key][lang];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
};

/* ── Ангиллын нэр ─────────────────────────────────────────────────── */

export const CATEGORY_EN: Record<string, string> = {
  Угаалт: 'Photo prints',
  Засвар: 'Retouched prints',
  'Хувилах/Скан': 'Scan & copy',
  'Цээж зураг': 'ID photos',
  Канон: 'Photocopying',
  Хэвлэл: 'Paper printing',
  'Медаль & Цом': 'Medals & trophies',
  Өргөмжлөл: 'Certificates',
  'Дурсгалын үг': 'Commemorative text',
  'Хувцас хэвлэл': 'Garment printing',
  Тууз: 'Ribbons & badges',
  'Хулдаас хэвлэл': 'Banner printing',
};

/* ── Үйлчилгээний нэр ─────────────────────────────────────────────── */

/**
 * Хэллэгийн хүснэгт — УРТААС нь эхэлж солино.
 *
 * Дараалал чухал: «Зураг угаалт» нь «Зураг» гэсэн богино хэллэгээс өмнө
 * байх ёстой, эс тэгвээс эхлээд «Зураг» солигдоод үлдсэн нь танигдахаа
 * болино. Доорх массив нь ЯГ энэ дарааллаар хэрэглэгдэнэ.
 */
const PHRASES: readonly (readonly [string, string])[] = [
  /* Төрөл */
  ['Зураг скан/хувилах', 'Photo scan / copy'],
  ['Засвартай зураг', 'Retouched photo'],
  ['Зураг угаалт', 'Photo print'],
  ['Гадаад пасспорт файл', 'Passport photo file'],
  ['Файлаар зураг авах', 'Photo supplied as file'],
  ['Самбарын зураг', 'Board photo'],
  ['Цээж зураг', 'ID photo'],
  ['Бичиг баримт канон', 'Document photocopy'],
  ['Өнгөт канон', 'Colour copy'],
  ['Хар канон', 'B/W copy'],
  ['Хэвлэл: Фото цаас', 'Print: photo paper'],
  ['Медаль төмөр олон', 'Metal medal, bulk'],
  ['Медаль шилэн', 'Glass medal'],
  ['Медаль оосор логотой', 'Medal lanyard with logo'],
  ['Медаль оосор', 'Medal lanyard'],
  ['Цом', 'Trophy'],
  ['Өргөмжлөл цаасан', 'Paper certificate'],
  ['Өргөмжлөл модон', 'Wooden certificate'],
  ['Өргөмжлөл', 'Certificate'],
  ['Дурсгалын үг', 'Commemorative text'],
  ['Фудболк: Урд энгэр лого, ард нэр', 'T-shirt: front logo + back name'],
  ['Фудболк: Урд лого энгэр', 'T-shirt: front chest logo'],
  ['Фудболк: Ард нэр', 'T-shirt: back name'],
  ['Фудболк:', 'T-shirt:'],
  ['Ажлын хувцас хантааз урд, ард', 'Workwear vest, front + back'],
  ['Ажлын хувцас хантааз урд', 'Workwear vest, front'],
  ['Ажлын хувцас хантааз ар', 'Workwear vest, back'],
  ['Энгэрийн тууз:', 'Lapel ribbon:'],
  ['Төмөр нарийн шар тэмдэг', 'Slim gold metal badge'],
  ['Энгэрийн баантиктай бөөрөнхий', 'Round lapel badge with bow'],
  ['Энгэрийн туузтай бөөрөнхий', 'Round lapel badge with ribbon'],
  ['Хулдаас:', 'Banner:'],

  /* Тодотгол */
  ['Цагаанаар бичих', 'white lettering'],
  ['Алтлагаар бичих', 'gold lettering'],
  ['Туузтай', 'with ribbon'],
  ['Туузгүй', 'without ribbon'],
  ['бөгжтэй нүх', 'with eyelets'],
  ['хэмжээтэй', 'size'],
  ['1 талдаа', 'single-sided'],
  ['2 талдаа', 'double-sided'],
  ['/нимгэн/', '/thin/'],
  ['/зузаан/', '/thick/'],

  /* Тоо ширхэгийн тэмдэглэгээ */
  ['ш дээш', '+ pcs'],
  [' дээш', '+'],
  [' доош', ' or fewer'],
  [' дотор', ' or fewer'],
  ['1ш', '1 pc'],
  ['3ш', '3 pcs'],
  ['гр', 'gsm'],
];

/**
 * Үйлчилгээний нэрийг англи руу хөрвүүлнэ.
 *
 * Хэмжээ, тоо (`10*15`, `А4`, `3.5*4.5`) нь хоёр хэлэнд ижил тул хөндөхгүй.
 * Танигдаагүй хэллэг үлдвэл монголоороо гарна — хоосон мөр харуулахаас
 * дээр, мөн шинэ үйлчилгээ нэмэхэд вэб эвдрэхгүй.
 */
export const serviceNameIn = (name: string, lang: Lang): string => {
  if (lang === 'mn') return name;

  let result = name;
  for (const [mn, en] of PHRASES) result = result.split(mn).join(en);

  // Кирилл «А» (U+0410) нь латин «A» биш — цаасны хэмжээг жигдэлнэ.
  result = result.replace(/А(\d)/g, 'A$1');

  return result.replace(/\s{2,}/g, ' ').trim();
};

/**
 * Ангиллын МОНГОЛ харагдах нэр.
 *
 * Каталогийн түлхүүр нь товч (`Угаалт`, `Засвар`) бөгөөд код дотор
 * ашиглахад тохиромжтой ч хэрэглэгчид ойлгомжгүй: «Засвар» гэхэд юуны
 * засвар нь тодорхойгүй. Мөн `Хэвлэл` нь ХЭВЛЭЛИЙН хуудсан дээр өөрөө
 * «Хэвлэл» гэж гарвал давхардмал сонсогдоно — тэр нь үнэндээ фото цаас.
 *
 * Түлхүүрийг өөрчлөхгүй байгаа шалтгаан: `catalog.ts`, `WALK_IN`,
 * `POPULAR_IDS`, тестүүд бүгд түүгээр холбогдсон. Зөвхөн ХАРАГДАХ давхарга
 * нь өөр байна.
 */
const CATEGORY_MN: Record<string, string> = {
  Угаалт: 'Зураг угаалт',
  Засвар: 'Засвартай зураг',
  Хэвлэл: 'Фото цаас',
};

export const categoryIn = (category: string, lang: Lang): string =>
  lang === 'mn'
    ? (CATEGORY_MN[category] ?? category)
    : (CATEGORY_EN[category] ?? category);
