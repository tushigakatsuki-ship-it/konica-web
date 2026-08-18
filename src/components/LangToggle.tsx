import { LANGS, LANG_LABEL, LANG_SHORT } from '../data/i18n';
import { useLang } from '../state/lang';

/**
 * Хэл сонгогч — хоёр товчны сегмент.
 *
 * ── Яагаад унтраах жагсаалт (dropdown) биш вэ ────────────────────
 *
 * Хоёр л сонголт байхад dropdown нь хоёр удаа дарахыг шаарддаг: нээх,
 * сонгох. Сегмент нь нэг даралт бөгөөд аль хэл идэвхтэйг НЭЭЛГҮЙГЭЭР
 * харуулна. Гурав дахь хэл нэмэгдвэл dropdown руу шилжих нь зөв.
 *
 * ── Хүртээмж ─────────────────────────────────────────────────────
 *
 * `aria-pressed` нь дэлгэц уншигчид аль нь идэвхтэйг хэлнэ. Товч дээрх
 * бичиг нь `MN` / `EN` товч хэлбэртэй ч `aria-label` дээр бүтэн нэр
 * (`Монгол` / `English`) явна — «Эм Эн» гэж үсэглэн уншихаас сэргийлнэ.
 */
export default function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div
      className={`inline-flex items-center rounded-md border border-hairline p-0.5 ${className}`}
    >
      {LANGS.map((code) => {
        const active = code === lang;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            aria-pressed={active}
            aria-label={LANG_LABEL[code]}
            className={`rounded-sm px-2 py-1 text-xs font-bold transition-colors ${
              active
                ? 'bg-neon-soft text-neon'
                : 'text-muted hover:text-neon'
            }`}
          >
            {LANG_SHORT[code]}
          </button>
        );
      })}
    </div>
  );
}
