import { useCallback, useEffect, useState } from 'react';

/**
 * Гэрэл / харанхуй горим.
 *
 * ── Гурван төлөв, хоёр биш ───────────────────────────────────────
 *
 * `system` төлөв ЗААВАЛ хэрэгтэй. Зөвхөн «гэрэл / харанхуй» гэсэн хоёр
 * сонголттой бол хэрэглэгчийн үйлдлийн систем оройдоо харанхуй болоход
 * вэб дагахгүй — нэг удаа сонгосон утга үүрд гацна.
 *
 * ── Анивчихаас сэргийлэх ─────────────────────────────────────────
 *
 * ⚠️ React ачаалагдахаас ӨМНӨ `index.html` доторх богино скрипт
 * `data-theme`-ийг тавина. Үүнгүйгээр харанхуй горимын хэрэглэгч эхлээд
 * цагаан дэлгэц харах бөгөөд энэ нь шөнө нүд гялбуулна.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_KEY = 'printmn-theme';

const isChoice = (value: unknown): value is ThemeChoice =>
  value === 'light' || value === 'dark' || value === 'system';

/**
 * Хадгалсан утга байхгүй үеийн горим.
 *
 * ⚠️ `'system'` БИШ, `'light'`. Энэ бол ЗУРГИЙН БИЗНЕСИЙН шаардлага:
 *
 * Хэрэглэгч оруулсан зургаа дэлгэц дээр хараад «ийм өнгөтэй хэвлэгдэнэ» гэж
 * шийддэг. Харанхуй дэвсгэр дээр зураг илүү тод, өнгөлөг харагддаг (нүдний
 * харьцангуй мэдрэмж) — тэгээд цаасан дээр буухдаа бүдэг санагдана. Фото
 * засварын програм, хэвлэлийн лаборатори бүр саарал/цагаан дэвсгэр
 * хэрэглэдэг нь яг үүнээс.
 *
 * `index.html` доторх блоклодог скрипт ч ЯГ ижил өгөгдмөлтэй байх ёстой —
 * зөрвөл хуудас эхлээд харанхуй гараад React ачаалагдмагц цагаан болж
 * анивчина. Хоёрын аль нэгийг сольвол нөгөөг нь ЗААВАЛ хамт сольно.
 */
const DEFAULT_CHOICE: ThemeChoice = 'light';

export function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isChoice(stored) ? stored : DEFAULT_CHOICE;
  } catch {
    /*
     * `localStorage` нь нууц горимд, эсвэл cookie хаасан тохиргоонд
     * шидэж болно. Тэр нь вэбийг зогсоох шалтгаан биш.
     */
    return DEFAULT_CHOICE;
  }
}

/**
 * Сонголтыг `<html>` дээр буулгана.
 *
 * `system` үед атрибутыг УСТГАНА — CSS дотор
 * `@media (prefers-color-scheme: dark)` дүрэм ажиллаж, системийг дагана.
 */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() =>
    typeof window === 'undefined' ? 'system' : readStoredTheme(),
  );

  useEffect(() => {
    applyTheme(choice);
    try {
      localStorage.setItem(THEME_KEY, choice);
    } catch {
      // Хадгалж чадаагүй ч тухайн хуудсанд горим ажилласаар байна.
    }
  }, [choice]);

  /** Дараагийн горим руу эргэлдэнэ: систем → гэрэл → харанхуй → систем. */
  const cycle = useCallback(() => {
    setChoice((current) =>
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system',
    );
  }, []);

  return { choice, setChoice, cycle };
}
