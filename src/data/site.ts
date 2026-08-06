export const CONTACT = {
  company: 'Printmn',
  address: 'Улаанбаатар хот',
  phone: '9900-0000',
  phoneHref: 'tel:+97699000000',
  email: 'info@printmn.mn',
  hours: 'Да–Ба: 9:00–18:00',
} as const;

/**
 * Толгойн цэс. `/tseej-zurag` зам ажилласаар байгаа ч цэснээс хассан —
 * вэбийн гол зорилго нь зураг хүлээн авах.
 */
export const NAV = [{ to: '/hevlel', label: 'Хэвлэл', icon: '🖨️' }] as const;
