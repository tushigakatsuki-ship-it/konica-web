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

export function readStoredTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return isChoice(stored) ? stored : 'system';
  } catch {
    /*
     * `localStorage` нь нууц горимд, эсвэл cookie хаасан тохиргоонд
     * шидэж болно. Тэр нь вэбийг зогсоох шалтгаан биш.
     */
    return 'system';
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
