import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { mockApi } from './dev/mock-api.ts';

export default defineConfig(({ mode }) => {
  /**
   * `API_ORIGIN` — бодит back-end рүү холбогдох унтраалга.
   *
   * Домэйн аваад deploy хийсний дараа хуурамч back-end нь тус болохоо больж,
   * эсрэгээрээ ТӨӨРӨГДӨЛ болдог: локал дээр «төлбөр 20 секундэд орлоо»,
   * «/admin-д ямар ч нууц үг тохирно» гэж харагдана — бодит дээр аль нь ч
   * тийм биш. Тиймээс энэ хувьсагчийг өгсөн үед хуурамч plugin ОГТ
   * ачаалагдахгүй бөгөөд `/api/*` нь тэр хаяг руу дамжина.
   *
   * `.env` дотор:  API_ORIGIN=https://konica-web.vercel.app
   * Хоосон орхивол хуучин зан хэвээр — хуурамч back-end асна (офлайн ажил,
   * интернэтгүй газар front-end засах үед хэрэгтэй хэвээр).
   *
   * ⚠️ `loadEnv`-ийн гурав дахь аргумент ('') ЗААВАЛ. Анхдагчаараа Vite нь
   * зөвхөн `VITE_` угтвартай нэрийг уншдаг — энэ нь браузерт гарах ёсгүй тул
   * угтваргүй.
   */
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.API_ORIGIN?.trim();

  return {
    /**
     * `mockApi` нь зөвхөн `npm run dev` үед ажиллана (`apply: 'serve'`).
     * Vercel function-ууд локал дээр ажилладаггүй тул үүнгүйгээр front-end-ийг
     * бүрэн туршиж боломгүй. `API_ORIGIN` өгөгдсөн үед хэрэггүй — доорх proxy
     * бодит function руу аваачна.
     */
    plugins: [react(), tailwindcss(), ...(apiOrigin ? [] : [mockApi()])],

    /**
     * Proxy нь зөвхөн `API_ORIGIN` өгөгдсөн үед. `changeOrigin` заавал —
     * Vercel нь `Host` толгойгоор аль төслийг үйлчлэхээ шийддэг тул
     * `localhost:5173` гэж очвол 404 буцаана.
     */
    server: apiOrigin
      ? { proxy: { '/api': { target: apiOrigin, changeOrigin: true } } }
      : undefined,

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
      format: 'es' as const,
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
          manualChunks: (id: string) =>
            id.includes('node_modules') ? 'vendor' : undefined,
        },
      },
    },
  };
});
