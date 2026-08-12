import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { mockApi } from './dev/mock-api.ts';

export default defineConfig({
  /**
   * `mockApi` нь зөвхөн `npm run dev` үед ажиллана (`apply: 'serve'`).
   * Vercel function-ууд локал дээр ажилладаггүй тул үүнгүйгээр front-end-ийг
   * бүрэн туршиж боломгүй.
   */
  plugins: [react(), tailwindcss(), mockApi()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  /**
   * ⚠️ Worker нь ES модуль байх ЁСТОЙ.
   *
   * Vite-ийн анхдагч `worker.format` нь `'iife'`. Тэр формат нь код хуваахыг
   * (code-splitting) дэмждэггүй. Бидний worker нь `lib/processPhoto.ts`-ээр
   * дамжин `onnxruntime-web`-ийг ДИНАМИК import хийдэг тул заавал хуваагдана —
   * үүнээс болж build дараах алдаагаар унана:
   *
   *   Invalid value "iife" for option "worker.format" —
   *   UMD and IIFE output formats are not supported for code-splitting builds
   *
   * `new Worker(..., { type: 'module' })` гэж аль хэдийн дуудаж байгаа тул
   * энэ тохиргоо нь түүнтэй нийцнэ.
   *
   * Модуль worker дэмждэггүй хуучин хөтөч дээр `lib/photoBatch.ts` нь үндсэн
   * урсгал руу буцдаг (`onerror` барих).
   */
  worker: {
    format: 'es',
  },
  build: {
    /**
     * 2022 оноос хойшхи хөтөч. `import.meta`, `??=`, top-level await зэрэг нь
     * дамжуулагдахгүй тул гаралт бага зэрэг жижиг, хурдан задардаг. Монголд
     * хэрэглэгддэг утаснууд бүгд Chrome/Safari-ийн шинэ хувилбартай.
     */
    target: 'es2022',
    rollupOptions: {
      output: {
        /**
         * Гуравдагч санг тусад нь.
         *
         * React ба react-router бараг өөрчлөгддөггүй тул тусдаа файлд гаргавал
         * бидний код шинэчлэгдэх бүрт хэрэглэгч дахин татахгүй — кэшэндээ
         * үлдэнэ. Хуудсуудын chunk-ийг `React.lazy` өөрөө хуваана.
         */
        manualChunks: (id) =>
          id.includes('node_modules') ? 'vendor' : undefined,
      },
    },
  },
});
