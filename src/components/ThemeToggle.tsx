import { IconDisplay, IconMoon, IconSun } from './icons';
import { useTheme, type ThemeChoice } from '../state/theme';

/**
 * Гэрэл / харанхуй / систем — нэг товчоор эргэлдэнэ.
 *
 * Гурван сонголтыг унтраадаг цэс болгож болох ч дарааллаар эргэлдэх нь
 * хурдан: ажилтан өдөрт нэг л удаа тааруулна, гурван товшилтын хамгийн
 * ихдээ нэг нь хэрэгтэй.
 *
 * Одоогийн төлөвийг дүрс болон `aria-label` хоёулаа хэлнэ — зөвхөн
 * дүрсээр мэдээлбэл дэлгэц уншигч ашиглагч төлөвөө мэдэхгүй.
 */

const LABELS: Record<ThemeChoice, string> = {
  system: 'Системийн горим',
  light: 'Гэрэл горим',
  dark: 'Харанхуй горим',
};

const NEXT: Record<ThemeChoice, ThemeChoice> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { choice, cycle } = useTheme();

  const Icon = choice === 'light' ? IconSun : choice === 'dark' ? IconMoon : IconDisplay;

  return (
    <button
      type="button"
      onClick={cycle}
      title={LABELS[choice]}
      aria-label={`${LABELS[choice]}. Дарвал ${LABELS[NEXT[choice]].toLowerCase()} руу шилжинэ`}
      className={`grid size-9 shrink-0 place-items-center rounded-md text-ink-soft transition-[background-color,transform] duration-150 hover:bg-brand-50 hover:text-brand-500 active:scale-90 ${className}`}
    >
      <Icon className="size-4.5" />
    </button>
  );
}
