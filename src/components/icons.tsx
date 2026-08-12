import type { SVGProps } from 'react';

/**
 * Дүрс тэмдгүүд — inline SVG.
 *
 * Яагаад emoji биш вэ:
 *   • **Төхөөрөмж бүр өөрөөр зурдаг.** 🖼️ нь iOS дээр өөр, Android дээр өөр,
 *     Windows дээр бүр өөр өнгө, хэлбэртэй гардаг — брэндийн харагдац алдагдана.
 *   • **Өнгийг удирдах боломжгүй.** Emoji нь өөрийн өнгөтэй тул хажуугийн
 *     текстийн өнгөтэй нийцэхгүй, идэвхгүй төлөвт бүдгэрдэггүй.
 *   • **Зарим төхөөрөмж дээр огт байхгүй** — хайрцаг (□) болж харагдана.
 *   • **Хэмжээ нь фонтоос хамаардаг** тул мөрийн өндөр гэнэт үсэрдэг.
 *
 * Яагаад icon сан суулгаагүй вэ: бидэнд 12 дүрс л хэрэгтэй. `lucide-react` нь
 * ~40KB нэмнэ. Эдгээр нь Lucide-ийн загвараар зурсан (24×24, stroke 2,
 * бөөрөнхий үзүүр) тул хожим санд шилжихэд харагдац өөрчлөгдөхгүй.
 *
 * Бүгд `currentColor` ашигладаг тул `text-*` класс шууд ажиллана.
 */

type IconProps = SVGProps<SVGSVGElement>;

const Base = ({ children, ...props }: IconProps) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    // Хэмжээг дуудагч тал `size-*`-аар өгнө; өгөөгүй бол мөртэйгээ таарна.
    width="1em"
    height="1em"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
);

export const IconImage = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="m21 15-5-5L5 21" />
  </Base>
);

export const IconPrinter = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </Base>
);

export const IconPhone = (props: IconProps) => (
  <Base {...props}>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  </Base>
);

export const IconMapPin = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </Base>
);

export const IconClock = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </Base>
);

export const IconMail = (props: IconProps) => (
  <Base {...props}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </Base>
);

export const IconCheck = (props: IconProps) => (
  <Base {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Base>
);

/** Амжилтын том тэмдэг — тойрогтой. */
export const IconCheckCircle = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="m8 12 3 3 5-6" />
  </Base>
);

export const IconClose = (props: IconProps) => (
  <Base {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const IconMenu = (props: IconProps) => (
  <Base {...props}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Base>
);

export const IconAlert = (props: IconProps) => (
  <Base {...props}>
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const IconLock = (props: IconProps) => (
  <Base {...props}>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Base>
);

export const IconLink = (props: IconProps) => (
  <Base {...props}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Base>
);

export const IconCrop = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
  </Base>
);

export const IconRuler = (props: IconProps) => (
  <Base {...props}>
    <path d="M21.3 15.3 8.7 2.7a1 1 0 0 0-1.4 0L2.7 7.3a1 1 0 0 0 0 1.4l12.6 12.6a1 1 0 0 0 1.4 0l4.6-4.6a1 1 0 0 0 0-1.4Z" />
    <path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2" />
  </Base>
);

export const IconPalette = (props: IconProps) => (
  <Base {...props}>
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
    <path d="M12 2a10 10 0 0 0 0 20 2 2 0 0 0 2-2v-1a2 2 0 0 1 2-2h2a4 4 0 0 0 4-4 10 10 0 0 0-10-10Z" />
  </Base>
);

export const IconArrowRight = (props: IconProps) => (
  <Base {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const IconChevronDown = (props: IconProps) => (
  <Base {...props}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const IconAward = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="8" r="6" />
    <path d="m8.2 13.9-1.4 7 5.2-3 5.2 3-1.4-7" />
  </Base>
);

/** Гэрэл горим — нар. */
export const IconSun = (props: IconProps) => (
  <Base {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
);

/** Харанхуй горим — сар. */
export const IconMoon = (props: IconProps) => (
  <Base {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </Base>
);

/** Системийн горимыг дагана — дэлгэц. */
export const IconDisplay = (props: IconProps) => (
  <Base {...props}>
    <rect x="2" y="4" width="20" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Base>
);

/** Сагс. */
export const IconBasket = (props: IconProps) => (
  <Base {...props}>
    <path d="M6 2 3 7M18 2l3 5M2 7h20l-1.6 11.2A3 3 0 0 1 17.4 21H6.6a3 3 0 0 1-3-2.8L2 7Z" />
    <path d="M10 11v6M14 11v6" />
  </Base>
);
