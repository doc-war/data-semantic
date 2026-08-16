import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// ES 模块构建 → dist/runtime.es.js
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.js', import.meta.url)),
      formats: ['es'],
      fileName: () => 'runtime.es.js'
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: false
  }
});
