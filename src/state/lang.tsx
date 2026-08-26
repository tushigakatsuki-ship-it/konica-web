import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  LANGS,
  categoryIn,
  serviceNameIn,
  translate,
  type Lang,
  type StringKey,
} from '../data/i18n';

/**
 * Сонгосон хэл.
 *
 * ── Яагаад зам биш, хадгалалт вэ ────────────────────────────────
 *
 * `/en/hevlel` гэсэн зам нь SEO-д давуу талтай ч router-ийн бүх зам хоёр
 * дахин нэмэгдэж, дотоод линк бүр хэлээ мэддэг байх шаардлагатай болно.
 * Дэлгүүрийн вэбийн англи хувилбар нь ихэвчлэн гадаад иргэн НЭГ удаа орж
 * үнэ хардаг тохиолдол тул тэр өртөг зөвтгөгдөхгүй. Сонголтыг
 * `localStorage`-д хадгалж, `<html lang>`-ийг шинэчилнэ.
 *
 * ── Анивчихаас сэргийлэх ────────────────────────────────────────
 *
 * Горимтой ижил зарчим: `index.html` доторх богино скрипт React
 * ачаалагдахаас ӨМНӨ `<html lang>`-ийг тавина. Үүнгүйгээр хайлтын систем
 * болон дэлгэц уншигч эхлээд буруу хэл харна.
 */

export const LANG_KEY = 'printmn-lang';

const isLang = (value: unknown): value is Lang =>
  typeof value === 'string' && (LANGS as readonly string[]).includes(value);

/**
 * Эхлэх хэл.
 *
 * ── Яагаад хөтчийн хэлээр ТААМАГЛАХГҮЙ вэ ────────────────────────
 *
 * Урьд нь `navigator.language` нь `en`-ээр эхэлбэл англи хэл рүү шилждэг
 * байв. Улаанбаатарт энэ нь БУРУУ таамаг: маш олон монгол хүн утсаа англи
 * хэл дээр тохируулж хэрэглэдэг (Android-ын анхны тохиргоо, iPhone-ыг
 * гадаадаас авсан, эсвэл зүгээр л дассан). Тэдэнд монгол дэлгүүрийн сайт
 * англиар нээгдэх нь ямар ч ашиггүй — харин зарим нь «буруу сайт орлоо»
 * гэж бодоод гарч ч болно.
 *
 * Толгойд `MN / EN` товч байнга харагдаж байгаа тул англиар үзэх хүн нэг
 * дарахад л болно, тэр сонголт нь хадгалагдана. Таамаглал нь ашгаас илүү
 * эрсдэл авчирдаг тул хаяв.
 *
 * Дэлгүүр Улаанбаатарт, үйлчлүүлэгч нь монгол — өгөгдмөл нь монгол.
 */
export function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (isLang(stored)) return stored;
  } catch {
    /*
     * `localStorage` нь нууц горимд, эсвэл cookie хаасан тохиргоонд
     * шидэж болно. Тэр нь вэбийг зогсоох шалтгаан биш.
     */
  }
  return 'mn';
}

interface LangApi {
  lang: Lang;
  setLang(next: Lang): void;
  /** Интерфейсийн мөр. Түлхүүрийг TypeScript шалгана. `{n}` байрлагчийг орлуулна. */
  t(key: StringKey, vars?: Record<string, string | number>): string;
  /** Каталогийн үйлчилгээний нэр. */
  ts(name: string): string;
  /** Ангиллын нэр. */
  tc(category: string): string;
}

const LangContext = createContext<LangApi | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => readStoredLang());

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // Хадгалж чадаагүй нь солихыг зогсоох шалтгаан биш.
    }
  }, []);

  const value = useMemo<LangApi>(
    () => ({
      lang,
      setLang,
      t: (key, vars) => translate(key, lang, vars),
      ts: (name) => serviceNameIn(name, lang),
      tc: (category) => categoryIn(category, lang),
    }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangApi {
  const value = useContext(LangContext);
  if (!value) throw new Error('useLang нь LangProvider дотор л ажиллана.');
  return value;
}
