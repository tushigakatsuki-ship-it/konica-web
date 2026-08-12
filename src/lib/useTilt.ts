import { useEffect, useRef } from 'react';

/**
 * Заагч дагасан 3D хазайлт.
 *
 * ── Яагаад CSS-ээр л болохгүй вэ ─────────────────────────────────
 *
 * CSS-ийн `:hover` нь «дээр байна уу, үгүй юу» гэдгийг л мэднэ — заагч
 * ХААНА байгааг мэдэхгүй. Тиймээс тогтмол өнцгөөр л хазайж чадна.
 * Заагчийг дагасан хазайлт нь бодит гүн мэт мэдрэгддэг гол зүйл.
 *
 * ── Хэрхэн ажилладаг вэ ──────────────────────────────────────────
 *
 * Hook нь `--tilt-x`, `--tilt-y` (−1…1) CSS хувьсагчийг л тавина.
 * Бодит хувиргалтыг CSS шийднэ. Ингэснээр харагдац бүхэлдээ CSS-д
 * үлдэж, JS нь зөвхөн ХЭМЖИГДЭХҮҮН нийлүүлнэ.
 *
 * ── Гурван хамгаалалт ────────────────────────────────────────────
 *
 * 1. **rAF хязгаарлалт.** `pointermove` нь секундэд 100+ удаа дуудагдана.
 *    Тухай бүрд нь style тавибал зурагдалт таталдана.
 *
 * 2. **`prefers-reduced-motion`.** ⚠️ `index.css` доторх нэгдсэн дүрэм
 *    нь `transition`, `animation`-ыг л барина — JS-ээр ШУУД тавьсан
 *    `transform`-д хүрэхгүй. Тиймээс энд ТУСАД нь шалгах ёстой.
 *
 * 3. **`hover: hover`.** Хуруугаар ажилладаг төхөөрөмжид заагч гэж
 *    байхгүй; сонсогч хавсаргах нь дэмий ажил.
 */

export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof matchMedia !== 'function') return;

    const calm = matchMedia('(prefers-reduced-motion: reduce)');
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    if (calm.matches || !fine.matches) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = () => {
      frame = 0;
      if (!pending) return;
      el.style.setProperty('--tilt-x', pending.x.toFixed(3));
      el.style.setProperty('--tilt-y', pending.y.toFixed(3));
      pending = null;
    };

    const onMove = (event: PointerEvent) => {
      const box = el.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;

      /*
       * Төвөөс хойших зай −1…1. Босоо тэнхлэгийг УРВУУЛНА: заагч дээшлэхэд
       * картын дээд ирмэг ард руу хазайх ёстой (жинхэнэ биет ингэж
       * хөдөлдөг), эс бөгөөс эргэлт нь эсрэгээрээ мэдрэгдэнэ.
       */
      pending = {
        x: ((event.clientX - box.left) / box.width) * 2 - 1,
        y: -(((event.clientY - box.top) / box.height) * 2 - 1),
      };
      frame ||= requestAnimationFrame(flush);
    };

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
      el.style.setProperty('--tilt-x', '0');
      el.style.setProperty('--tilt-y', '0');
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return ref;
}
