import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// UMD 构建 → dist/runtime.umd.js（全局 DataSemantic = 单例实例）
export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/umd.js', import.meta.url)),
      name: 'DataSemantic',
      formats: ['umd'],
      fileName: () => 'runtime.umd.js'
    },
    outDir: 'dist',
    emptyOutDir: false,
    minify: false,
    rollupOptions: {
      output: {
        exports: 'default'
      }
    }
  }
});
