/**
 * Canvas 2D-ийн `ctx.filter`-т байхгүй пикселийн үйлдлүүд.
 *
 * `brightness`/`blur` хоёрыг `ctx.filter`-ээр шууд хийж болдог тул энд
 * ирэхгүй (`photoRender.ts`-г үз) — sharpen л гар аргаар convolution
 * шаарддаг тул энд, canvas-гүйгээр unit test бичих боломжтой pure функц
 * хэлбэрээр.
 */

/** 3×3 Laplacian-суурьт unsharp kernel. Тогтмол хүчтэй — slider биш. */
const SHARPEN_KERNEL = [0, -1, 0, -1, 5, -1, 0, -1, 0] as const;

/**
 * Зургийг тодотгоно (sharpen). Ирмэгийн пикселийг хамгийн ойрын дотоод
 * пикселээр clamp хийж уншина (edge — гадна тал давтагдана).
 *
 * Альфа сувгийг хөндөхгүй — тодотгол зөвхөн өнгөнд хамаарна.
 */
export function sharpenKernel3x3(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);

  const at = (x: number, y: number): number => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return (cy * width + cx) * 4;
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;

      for (let c = 0; c < 3; c += 1) {
        let sum = 0;
        let k = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const weight = SHARPEN_KERNEL[k];
            k += 1;
            if (weight !== 0) sum += data[at(x + dx, y + dy) + c] * weight;
          }
        }
        out[i + c] = sum;
      }
      out[i + 3] = data[i + 3];
    }
  }

  return out;
}
